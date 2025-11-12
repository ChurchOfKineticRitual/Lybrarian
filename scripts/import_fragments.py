#!/usr/bin/env python3
"""
Fragment Import Script for Lybrarian
Processes fragment CSV and imports to database, vector store, and markdown vault.

Two-Phase Workflow:
    Phase 1 - Generate tags for review:
        python import_fragments.py --generate-tags fragment-corpus-cleaned.csv

    Phase 2 - Complete import with reviewed tags:
        python import_fragments.py --complete-import fragment-corpus-cleaned.csv

Requirements:
    - Environment variables set (see .env.example)
    - Database schema already created
    - Upstash Vector index created (1536 dimensions)
"""

import asyncio
import csv
import json
import logging
import os
import sys
import yaml
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

# Core imports (always needed)
from openai import AsyncOpenAI
from dotenv import load_dotenv

# Load environment variables from .env file in project root
load_dotenv(Path(__file__).parent.parent / '.env')

# Phase-specific imports (loaded conditionally)
# asyncpg, upstash_vector, syllables, pronouncing, nltk - imported when needed

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# CMUdict will be loaded when needed
CMU_DICT = None


# ============================================
# CONFIGURATION
# ============================================

class Config:
    """Configuration from environment variables."""

    # OpenRouter unified API
    OPENROUTER_API_KEY = os.getenv('OPENROUTER_API_KEY')

    # Database & Vector Store
    DATABASE_URL = os.getenv('DATABASE_URL')
    UPSTASH_VECTOR_URL = os.getenv('UPSTASH_VECTOR_URL')
    UPSTASH_VECTOR_TOKEN = os.getenv('UPSTASH_VECTOR_TOKEN')

    # Optional: GitHub sync (Phase 2)
    GITHUB_TOKEN = os.getenv('GITHUB_TOKEN')
    GITHUB_REPO = os.getenv('GITHUB_REPO')

    @classmethod
    def validate(cls, phase: str):
        """Validate required environment variables for the given phase."""
        if phase == 'tags':
            required = ['OPENROUTER_API_KEY']
        elif phase == 'complete':
            required = [
                'OPENROUTER_API_KEY',
                'DATABASE_URL',
                'UPSTASH_VECTOR_URL',
                'UPSTASH_VECTOR_TOKEN'
            ]
        else:
            required = []

        missing = [var for var in required if not getattr(cls, var)]

        if missing:
            logger.error(f"Missing required environment variables: {', '.join(missing)}")
            logger.error("Please check .env.example for required configuration")
            sys.exit(1)


# ============================================
# CSV PARSING
# ============================================

def parse_csv(csv_path: str) -> List[Dict]:
    """Parse CSV and return list of fragment dictionaries."""
    fragments = []

    logger.info(f"Reading CSV from {csv_path}...")

    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            fragment = {
                'id': row['ID'].strip(),
                'text': row['Fragment'].strip(),
                'attribution': row['Attribution'].strip() if row['Attribution'].strip() else None,
                'rhythmic': row['Rhythmic'].strip().upper() == 'Y',
                'context': row['Context'].strip() if row['Context'].strip() else None
            }
            fragments.append(fragment)

    logger.info(f"Parsed {len(fragments)} fragments from CSV")
    return fragments


# ============================================
# TAG GENERATION (via OpenRouter)
# ============================================

async def generate_tags_openrouter(fragment_text: str, context: Optional[str], openrouter_client) -> List[str]:
    """Generate tags using Claude via OpenRouter."""

    context_line = f'Context: "{context}"' if context else ""

    prompt = f"""Given this lyric fragment and optional context, generate 3-7 relevant tags.

Fragment: "{fragment_text}"
{context_line}

Tags should capture:
- Themes (love, loss, defiance, hope, etc.)
- Imagery (urban, nocturnal, domestic, natural, etc.)
- Emotions (melancholic, hopeful, angry, tender, etc.)
- Style (satirical, sincere, abstract, narrative, etc.)

Return ONLY a comma-separated list of lowercase tags.
No explanations. No numbering.

Example output: urban, nocturnal, melancholic, walking, rain"""

    try:
        response = await openrouter_client.chat.completions.create(
            model="anthropic/claude-sonnet-4-5",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=100,
            temperature=0.3
        )

        # Extract text from response
        tags_str = response.choices[0].message.content.strip()

        # Parse comma-separated tags
        tags = [tag.strip().lower() for tag in tags_str.split(',')]

        # Clean and deduplicate
        tags = list(set([t for t in tags if t and len(t) > 1]))

        return tags

    except Exception as e:
        logger.error(f"Error generating tags: {e}")
        # Fallback to context-based tags
        if context:
            return [w.lower() for w in context.split() if len(w) > 3][:5]
        return ['lyric', 'fragment']


# ============================================
# PROSODIC ANALYSIS
# ============================================

def _ensure_prosody_imports():
    """Lazy import of prosody libraries."""
    global CMU_DICT

    if CMU_DICT is not None:
        return

    try:
        import nltk
        from nltk.corpus import cmudict

        # Download NLTK data if not present
        try:
            nltk.data.find('corpora/cmudict')
        except LookupError:
            logger.info("Downloading CMUdict...")
            nltk.download('cmudict', quiet=True)

        CMU_DICT = cmudict.dict()
    except Exception as e:
        logger.error(f"Failed to load prosody libraries: {e}")
        CMU_DICT = {}


def count_syllables(text: str) -> int:
    """Count syllables in text."""
    import syllables

    words = text.lower().split()
    total = 0

    for word in words:
        # Remove punctuation
        word = ''.join(c for c in word if c.isalpha())
        if word:
            try:
                count = syllables.estimate(word)
                total += count
            except:
                # Fallback: rough estimate
                total += max(1, len([c for c in word.lower() if c in 'aeiouy']))

    return max(1, total)


def get_stress_pattern(text: str) -> str:
    """Get binary stress pattern using CMUdict."""
    import syllables
    _ensure_prosody_imports()

    words = text.lower().split()
    pattern = ""

    for word in words:
        # Clean word
        word = ''.join(c for c in word if c.isalpha())
        if not word:
            continue

        # Look up in CMUdict
        if word in CMU_DICT:
            phones = CMU_DICT[word][0]  # First pronunciation
            for phone in phones:
                if phone[-1].isdigit():  # Vowel with stress marker
                    stress = phone[-1]
                    if stress == '1':  # Primary stress
                        pattern += "1"
                    else:  # Secondary or no stress
                        pattern += "0"
        else:
            # Fallback: estimate based on syllables
            syll = syllables.estimate(word)
            # Simple heuristic: first syllable stressed for short words
            if syll <= 2:
                pattern += "1" + "0" * (syll - 1)
            else:
                # Longer words: first syllable stressed
                pattern += "1" + "0" * (syll - 1)

    return pattern if pattern else "1"


def get_end_rhyme_sound(text: str) -> Optional[str]:
    """Get phonetic end rhyme sound using pronouncing library."""
    try:
        import pronouncing
    except ImportError:
        logger.warning("pronouncing library not available, skipping rhyme analysis")
        return None

    words = text.lower().split()
    if not words:
        return None

    # Get last word
    last_word = ''.join(c for c in words[-1] if c.isalpha())

    # Get phonetic representation
    phones = pronouncing.phones_for_word(last_word)
    if phones:
        try:
            import pronouncing
            # Get primary pronunciation
            phone = phones[0]
            # Extract rhyme part (from last stressed vowel to end)
            rhyme_part = pronouncing.rhyming_part(phone)
            return rhyme_part if rhyme_part else phone
        except:
            return None

    return None


def analyze_line_prosody(line_text: str) -> Dict:
    """Analyze syllables, stress, and rhyme for a single line."""

    return {
        'text': line_text,
        'syllables': count_syllables(line_text),
        'stress': get_stress_pattern(line_text),
        'end_rhyme': get_end_rhyme_sound(line_text)
    }


def analyze_fragment_prosody(fragment_text: str) -> Dict:
    """Analyze prosody for entire fragment (per-line)."""
    lines = [line.strip() for line in fragment_text.split('\n') if line.strip()]

    prosody = []
    for i, line in enumerate(lines, 1):
        line_data = analyze_line_prosody(line)
        line_data['line'] = i
        prosody.append(line_data)

    # Classify fragment type
    line_count = len(lines)
    if line_count == 1:
        fragment_type = "single-line"
    elif line_count == 2:
        fragment_type = "couplet"
    elif line_count == 4:
        fragment_type = "quatrain"
    elif line_count <= 8:
        fragment_type = "verse"
    else:
        fragment_type = "stanza"

    return {
        'lines': line_count,
        'prosody': prosody,
        'fragment_type': fragment_type
    }


# ============================================
# EMBEDDING GENERATION (via OpenRouter)
# ============================================

async def generate_embedding_openrouter(fragment_text: str, context: Optional[str], openrouter_client) -> List[float]:
    """Generate semantic embedding via OpenRouter."""

    # Construct embedding text
    if context:
        embedding_text = f"{fragment_text}\n\nContext: {context}"
    else:
        embedding_text = fragment_text

    try:
        response = await openrouter_client.embeddings.create(
            model="openai/text-embedding-3-small",
            input=embedding_text
        )

        return response.data[0].embedding

    except Exception as e:
        logger.error(f"Error generating embedding: {e}")
        raise


# ============================================
# MARKDOWN FILE CREATION
# ============================================

def create_fragment_markdown(fragment_data: Dict, output_dir: Path) -> Path:
    """Create markdown file with YAML frontmatter."""

    # Construct frontmatter
    frontmatter = {
        'id': fragment_data['id'],
        'created': datetime.now().isoformat(),
        'source': fragment_data['attribution'] if fragment_data['attribution'] else 'JC',
        'rhythmic': fragment_data['rhythmic'],
        'tags': fragment_data['tags']
    }

    # Add context note
    frontmatter['context_note'] = fragment_data['context'] if fragment_data['context'] else ""

    # Add prosody if rhythmic
    if fragment_data['rhythmic'] and 'prosody_data' in fragment_data:
        frontmatter['lines'] = fragment_data['prosody_data']['lines']
        frontmatter['prosody'] = fragment_data['prosody_data']['prosody']
        frontmatter['fragment_type'] = fragment_data['prosody_data']['fragment_type']

    # Convert to YAML
    yaml_content = yaml.dump(frontmatter, default_flow_style=False, allow_unicode=True, sort_keys=False)

    # Construct markdown content
    markdown_content = f"""---
{yaml_content}---

{fragment_data['text']}
"""

    # Write file
    file_path = output_dir / f"{fragment_data['id']}.md"
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(markdown_content)

    return file_path


# ============================================
# DATABASE OPERATIONS
# ============================================

async def save_to_database(fragment_data: Dict, db_conn):
    """Save fragment to Postgres database."""
    import asyncpg

    try:
        # Insert into fragments table
        await db_conn.execute("""
            INSERT INTO fragments (
                id, created_at, source, rhythmic, fragment_type,
                content, tags, context_note, embedding_id, file_path
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        """,
            fragment_data['id'],
            datetime.now(),
            fragment_data['attribution'] or 'JC',
            fragment_data['rhythmic'],
            fragment_data.get('prosody_data', {}).get('fragment_type'),
            fragment_data['text'],
            fragment_data['tags'],
            fragment_data['context'] or '',
            fragment_data['embedding_id'],
            f"fragments/{fragment_data['id']}.md"
        )

        # If rhythmic, insert prosody data
        if fragment_data['rhythmic'] and 'prosody_data' in fragment_data:
            for line_data in fragment_data['prosody_data']['prosody']:
                await db_conn.execute("""
                    INSERT INTO fragment_lines (
                        fragment_id, line_number, text, syllables,
                        stress_pattern, end_rhyme_sound
                    ) VALUES ($1, $2, $3, $4, $5, $6)
                """,
                    fragment_data['id'],
                    line_data['line'],
                    line_data['text'],
                    line_data['syllables'],
                    line_data['stress'],
                    line_data['end_rhyme']
                )

        logger.debug(f"Saved {fragment_data['id']} to database")

    except Exception as e:
        logger.error(f"Error saving to database: {e}")
        raise


# ============================================
# VECTOR STORE OPERATIONS
# ============================================

async def save_to_vector_store(fragment_data: Dict, vector_index) -> str:
    """Save embedding to Upstash Vector."""
    from upstash_vector import Index as UpstashIndex

    try:
        # Prepare metadata
        metadata = {
            'id': fragment_data['id'],
            'source': fragment_data['attribution'] or 'JC',
            'tags': fragment_data['tags'][:10],  # Limit for metadata size
            'rhythmic': fragment_data['rhythmic']
        }

        # If rhythmic, add prosody summary
        if fragment_data['rhythmic'] and 'prosody_data' in fragment_data:
            syllables = [line['syllables'] for line in fragment_data['prosody_data']['prosody']]
            metadata['avg_syllables'] = round(sum(syllables) / len(syllables), 1)

        # Upsert to vector store
        await asyncio.to_thread(
            vector_index.upsert,
            vectors=[{
                'id': fragment_data['id'],
                'vector': fragment_data['embedding'],
                'metadata': metadata
            }]
        )

        logger.debug(f"Saved {fragment_data['id']} to vector store")

        return fragment_data['id']  # This is the embedding_id

    except Exception as e:
        logger.error(f"Error saving to vector store: {e}")
        raise


# ============================================
# PHASE 1: GENERATE TAGS FOR REVIEW
# ============================================

async def generate_tags_phase(csv_path: str, output_file: str = "tags-review.json"):
    """Phase 1: Generate tags and save for manual review."""

    # Validate configuration
    Config.validate('tags')

    # Initialize OpenRouter client
    logger.info("Initializing OpenRouter client...")
    openrouter_client = AsyncOpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=Config.OPENROUTER_API_KEY
    )

    # Parse CSV
    logger.info("\n" + "="*60)
    logger.info("PHASE 1: GENERATING TAGS")
    logger.info("="*60)
    fragments = parse_csv(csv_path)

    # Generate tags for each fragment
    for i, fragment in enumerate(fragments, 1):
        logger.info(f"\n[{i}/{len(fragments)}] Generating tags for {fragment['id']}...")
        logger.info(f"  Text: {fragment['text'][:60]}...")

        # Generate tags
        tags = await generate_tags_openrouter(
            fragment['text'],
            fragment['context'],
            openrouter_client
        )
        fragment['tags'] = tags
        logger.info(f"  Tags: {', '.join(tags)}")

        # Rate limiting
        await asyncio.sleep(0.5)

    # Save to JSON for review
    output_path = Path(output_file)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(fragments, f, indent=2, ensure_ascii=False)

    logger.info("\n" + "="*60)
    logger.info("TAGS GENERATED - READY FOR REVIEW")
    logger.info("="*60)
    logger.info(f"Tags saved to: {output_path}")
    logger.info("\nNext steps:")
    logger.info(f"1. Review and edit tags in: {output_file}")
    logger.info("2. Confirm/delete/amend tags as needed")
    logger.info(f"3. Run: python import_fragments.py --complete-import {csv_path}")
    logger.info("\nTag file format:")
    logger.info("  - Edit the 'tags' array for each fragment")
    logger.info("  - Add/remove/modify tags as needed")
    logger.info("  - Save the file when done")


# ============================================
# PHASE 2: COMPLETE IMPORT
# ============================================

async def complete_import_phase(
    csv_path: str,
    tags_file: str = "tags-review.json",
    output_base_dir: str = "lyrics-vault"
):
    """Phase 2: Complete import using reviewed tags."""
    # Import Phase 2 dependencies
    import asyncpg
    from upstash_vector import Index as UpstashIndex

    # Validate configuration
    Config.validate('complete')

    # Check if tags file exists
    tags_path = Path(tags_file)
    if not tags_path.exists():
        logger.error(f"Tags file not found: {tags_file}")
        logger.error("Run Phase 1 first: python import_fragments.py --generate-tags")
        sys.exit(1)

    # Load reviewed tags
    logger.info(f"Loading reviewed tags from {tags_file}...")
    with open(tags_path, 'r', encoding='utf-8') as f:
        fragments = json.load(f)

    logger.info(f"Loaded {len(fragments)} fragments with reviewed tags")

    # Initialize clients
    logger.info("Initializing clients...")

    openrouter_client = AsyncOpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=Config.OPENROUTER_API_KEY
    )
    vector_index = UpstashIndex(
        url=Config.UPSTASH_VECTOR_URL,
        token=Config.UPSTASH_VECTOR_TOKEN
    )

    # Connect to database
    logger.info("Connecting to database...")
    db_conn = await asyncpg.connect(Config.DATABASE_URL)

    try:
        # Create output directory
        output_dir = Path(output_base_dir) / "fragments"
        output_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"Output directory: {output_dir}")

        # Process each fragment
        logger.info("\n" + "="*60)
        logger.info("PHASE 2: COMPLETING IMPORT")
        logger.info("="*60)

        success_count = 0
        fail_count = 0

        for i, fragment in enumerate(fragments, 1):
            logger.info(f"\n[{i}/{len(fragments)}] Processing {fragment['id']}...")

            try:
                # Display reviewed tags
                logger.info(f"  Tags: {', '.join(fragment['tags'])}")

                # Analyze prosody if rhythmic
                if fragment['rhythmic']:
                    logger.info(f"  → Analyzing prosody...")
                    prosody_data = analyze_fragment_prosody(fragment['text'])
                    fragment['prosody_data'] = prosody_data
                    logger.info(f"    Type: {prosody_data['fragment_type']}, Lines: {prosody_data['lines']}")

                # Generate embedding
                logger.info(f"  → Generating embedding...")
                embedding = await generate_embedding_openrouter(
                    fragment['text'],
                    fragment['context'],
                    openrouter_client
                )
                fragment['embedding'] = embedding
                logger.info(f"    Embedding: {len(embedding)} dimensions")

                # Save to vector store
                logger.info(f"  → Saving to vector store...")
                embedding_id = await save_to_vector_store(fragment, vector_index)
                fragment['embedding_id'] = embedding_id

                # Save to database
                logger.info(f"  → Saving to database...")
                await save_to_database(fragment, db_conn)

                # Create markdown file
                logger.info(f"  → Creating markdown file...")
                file_path = create_fragment_markdown(fragment, output_dir)

                logger.info(f"  ✓ Complete: {file_path.name}")
                success_count += 1

            except Exception as e:
                logger.error(f"  ✗ Failed: {e}")
                fail_count += 1

            # Rate limiting
            await asyncio.sleep(0.5)

        # Summary
        logger.info("\n" + "="*60)
        logger.info("IMPORT COMPLETE")
        logger.info("="*60)
        logger.info(f"Total fragments: {len(fragments)}")
        logger.info(f"✓ Successful: {success_count}")
        logger.info(f"✗ Failed: {fail_count}")
        logger.info(f"Output: {output_dir}")

        if fail_count == 0:
            logger.info("\n🎉 All fragments imported successfully!")
        else:
            logger.warning(f"\n⚠️  {fail_count} fragments failed. Check logs above.")

    finally:
        await db_conn.close()
        logger.info("\nDatabase connection closed.")


# ============================================
# CLI ENTRY POINT
# ============================================

def main():
    """CLI entry point."""

    if len(sys.argv) < 2:
        print("Usage:")
        print("  Phase 1 - Generate tags:")
        print("    python import_fragments.py --generate-tags <csv_file>")
        print("")
        print("  Phase 2 - Complete import:")
        print("    python import_fragments.py --complete-import <csv_file>")
        print("")
        print("Example workflow:")
        print("  python import_fragments.py --generate-tags fragment-corpus-cleaned.csv")
        print("  # Review and edit tags-review.json")
        print("  python import_fragments.py --complete-import fragment-corpus-cleaned.csv")
        sys.exit(1)

    mode = sys.argv[1]

    if mode == '--generate-tags':
        if len(sys.argv) != 3:
            print("Usage: python import_fragments.py --generate-tags <csv_file>")
            sys.exit(1)

        csv_path = sys.argv[2]

        if not os.path.exists(csv_path):
            logger.error(f"File not found: {csv_path}")
            sys.exit(1)

        logger.info("="*60)
        logger.info("LYBRARIAN FRAGMENT IMPORT - PHASE 1")
        logger.info("="*60)
        logger.info(f"CSV: {csv_path}")
        logger.info(f"Output: tags-review.json")
        logger.info("="*60 + "\n")

        asyncio.run(generate_tags_phase(csv_path))

    elif mode == '--complete-import':
        if len(sys.argv) != 3:
            print("Usage: python import_fragments.py --complete-import <csv_file>")
            sys.exit(1)

        csv_path = sys.argv[2]

        if not os.path.exists(csv_path):
            logger.error(f"File not found: {csv_path}")
            sys.exit(1)

        logger.info("="*60)
        logger.info("LYBRARIAN FRAGMENT IMPORT - PHASE 2")
        logger.info("="*60)
        logger.info(f"Tags: tags-review.json")
        logger.info(f"Output: lyrics-vault/fragments/")
        logger.info("="*60 + "\n")

        asyncio.run(complete_import_phase(csv_path))

    else:
        logger.error(f"Unknown mode: {mode}")
        logger.error("Use --generate-tags or --complete-import")
        sys.exit(1)


if __name__ == "__main__":
    main()
