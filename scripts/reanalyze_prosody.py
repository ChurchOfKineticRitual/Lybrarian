#!/usr/bin/env python3
"""
Re-analyze prosody for all fragments with dual US/British pronunciations.
Run this after the database migration to update all existing fragments.

Usage:
    python reanalyze_prosody.py

Requirements:
    - Database migration already run (migrate_dual_pronunciations.sql)
    - Environment variables set in .env file
    - Python packages: asyncpg, syllables, pronouncing, nltk
"""

import asyncio
import logging
import os
import sys
from pathlib import Path
from typing import Dict, List, Optional

# Load environment variables
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / '.env')

import asyncpg

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# CMUdict will be loaded when needed
CMU_DICT = None


# ============================================
# PROSODIC ANALYSIS (copied from import_fragments.py)
# ============================================

def count_syllables(text: str) -> int:
    """Count syllables in text using syllables library."""
    try:
        import syllables
        words = text.split()
        return sum(syllables.estimate(word) for word in words)
    except Exception as e:
        logger.warning(f"Syllable counting failed: {e}")
        # Fallback: rough estimate
        vowels = "aeiouy"
        count = 0
        text = text.lower()
        previous_was_vowel = False

        for char in text:
            is_vowel = char in vowels
            if is_vowel and not previous_was_vowel:
                count += 1
            previous_was_vowel = is_vowel

        return max(1, count)


def get_stress_pattern(text: str) -> str:
    """Generate stress pattern using CMUdict."""
    global CMU_DICT

    if CMU_DICT is None:
        try:
            import nltk
            from nltk.corpus import cmudict

            # Download if not present
            try:
                nltk.data.find('corpora/cmudict')
            except LookupError:
                logger.info("Downloading CMUdict...")
                nltk.download('cmudict', quiet=True)

            CMU_DICT = cmudict.dict()
        except Exception as e:
            logger.warning(f"CMUdict loading failed: {e}")
            return "1"  # Default pattern

    words = text.lower().split()
    pattern = ""

    for word in words:
        clean_word = ''.join(c for c in word if c.isalpha())

        if clean_word in CMU_DICT:
            # Get first pronunciation
            pronunciation = CMU_DICT[clean_word][0]

            # Extract stress markers (0, 1, 2)
            stresses = [str(p[-1]) for p in pronunciation if p[-1].isdigit()]

            # Convert to binary (1=stressed, 0=unstressed)
            for stress in stresses:
                pattern += "1" if stress in ["1", "2"] else "0"
        else:
            # Estimate: first syllable stressed for unknown words
            syll = count_syllables(clean_word)
            if syll <= 2:
                pattern += "1" + "0" * (syll - 1)
            else:
                pattern += "1" + "0" * (syll - 1)

    return pattern if pattern else "1"


def get_dual_rhyme_sounds(text: str) -> Dict[str, Optional[str]]:
    """Get both American and British phonetic rhyme sounds."""
    words = text.lower().split()
    if not words:
        return {"us": None, "gb": None}

    last_word = ''.join(c for c in words[-1] if c.isalpha())

    # Initialize results
    us_rhyme = None
    gb_rhyme = None

    # Get American pronunciation (CMUdict via pronouncing)
    try:
        import pronouncing
        phones = pronouncing.phones_for_word(last_word)
        if phones:
            phone = phones[0]  # Primary pronunciation
            rhyme_part = pronouncing.rhyming_part(phone)
            us_rhyme = rhyme_part if rhyme_part else phone
    except Exception as e:
        logger.debug(f"American phonemization failed for '{last_word}': {e}")

    # Get British pronunciation - try phonemizer first, then conversion
    try:
        from phonemizer import phonemize
        british_phones = phonemize(last_word, language='en-gb', backend='espeak', strip=True)
        if british_phones and british_phones != last_word:
            gb_rhyme = british_phones
    except Exception as e:
        logger.debug(f"British phonemizer failed for '{last_word}': {e}")
        # Fallback: convert American to British
        if us_rhyme:
            gb_rhyme = _convert_american_to_british_phonemes(us_rhyme)

    return {"us": us_rhyme, "gb": gb_rhyme}


def _convert_american_to_british_phonemes(american_phones: str) -> str:
    """Convert American CMUdict phonemes to British equivalents."""
    british_mappings = {
        # TRAP-BATH split
        'AE1': 'AA1',
        'AE0': 'AA0',
        # LOT-CLOTH
        'AA1': 'AO1',
        'AA0': 'AO0',
        # Rhoticity
        'ER1': 'AH1',
        'ER0': 'AH0',
        'R': '',
        # THOUGHT-FORCE
        'AO1': 'AO1',
        'AO0': 'AO0',
    }

    result = american_phones
    for american, british in british_mappings.items():
        result = result.replace(american, british)

    return result


def analyze_line_prosody(line_text: str) -> Dict:
    """Analyze syllables, stress, and rhyme for a single line."""
    dual_rhymes = get_dual_rhyme_sounds(line_text)

    return {
        'text': line_text,
        'syllables': count_syllables(line_text),
        'stress': get_stress_pattern(line_text),
        'end_rhyme_us': dual_rhymes["us"],
        'end_rhyme_gb': dual_rhymes["gb"],
        'end_rhyme': dual_rhymes["gb"]  # For backward compatibility
    }


# ============================================
# DATABASE OPERATIONS
# ============================================

async def fetch_all_fragments(conn):
    """Fetch all fragments from database."""
    query = """
        SELECT id, content, rhythmic
        FROM fragments
        ORDER BY id
    """
    return await conn.fetch(query)


async def fetch_fragment_lines(conn, fragment_id: str):
    """Fetch existing lines for a fragment."""
    query = """
        SELECT line_number, text
        FROM fragment_lines
        WHERE fragment_id = $1
        ORDER BY line_number
    """
    return await conn.fetch(query, fragment_id)


async def update_line_prosody(conn, fragment_id: str, line_number: int, prosody: Dict):
    """Update prosodic data for a single line."""
    query = """
        UPDATE fragment_lines
        SET syllables = $1,
            stress_pattern = $2,
            end_rhyme_sound = $3,
            end_rhyme_us = $4,
            end_rhyme_gb = $5
        WHERE fragment_id = $6 AND line_number = $7
    """

    await conn.execute(
        query,
        prosody['syllables'],
        prosody['stress'],
        prosody['end_rhyme'],  # Keep backward compatibility
        prosody['end_rhyme_us'],
        prosody['end_rhyme_gb'],
        fragment_id,
        line_number
    )


async def reanalyze_all_fragments():
    """Main function to re-analyze all fragments."""

    # Validate environment
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        logger.error("DATABASE_URL not found in environment")
        logger.error("Please ensure .env file exists with DATABASE_URL set")
        sys.exit(1)

    logger.info("=" * 60)
    logger.info("PROSODY RE-ANALYSIS - DUAL PRONUNCIATIONS")
    logger.info("=" * 60)

    # Connect to database
    try:
        conn = await asyncpg.connect(database_url)
        logger.info("✓ Connected to database")
    except Exception as e:
        logger.error(f"Failed to connect to database: {e}")
        sys.exit(1)

    try:
        # Fetch all fragments
        fragments = await fetch_all_fragments(conn)
        logger.info(f"✓ Found {len(fragments)} fragments")

        rhythmic_count = sum(1 for f in fragments if f['rhythmic'])
        logger.info(f"✓ {rhythmic_count} rhythmic fragments to analyze")
        logger.info("")

        # Process each fragment
        updated_lines = 0
        skipped_fragments = 0

        for i, fragment in enumerate(fragments, 1):
            fragment_id = fragment['id']
            content = fragment['content']
            rhythmic = fragment['rhythmic']

            if not rhythmic:
                skipped_fragments += 1
                logger.debug(f"[{i}/{len(fragments)}] Skipping {fragment_id} (semantic only)")
                continue

            logger.info(f"[{i}/{len(fragments)}] Analyzing {fragment_id}...")

            # Get existing lines from database
            db_lines = await fetch_fragment_lines(conn, fragment_id)

            # Re-analyze each line
            for db_line in db_lines:
                line_number = db_line['line_number']
                line_text = db_line['text']

                # Analyze prosody with dual pronunciations
                prosody = analyze_line_prosody(line_text)

                # Update database
                await update_line_prosody(conn, fragment_id, line_number, prosody)

                logger.info(f"  Line {line_number}: {prosody['syllables']} syllables")
                logger.info(f"    US rhyme: {prosody['end_rhyme_us']}")
                logger.info(f"    GB rhyme: {prosody['end_rhyme_gb']}")

                updated_lines += 1

            logger.info(f"  ✓ Updated {len(db_lines)} lines")
            logger.info("")

        logger.info("=" * 60)
        logger.info(f"✓ Re-analysis complete!")
        logger.info(f"  Fragments processed: {len(fragments) - skipped_fragments}")
        logger.info(f"  Lines updated: {updated_lines}")
        logger.info(f"  Semantic fragments skipped: {skipped_fragments}")
        logger.info("=" * 60)

    except Exception as e:
        logger.error(f"Error during re-analysis: {e}")
        raise
    finally:
        await conn.close()


# ============================================
# MAIN
# ============================================

if __name__ == "__main__":
    asyncio.run(reanalyze_all_fragments())
