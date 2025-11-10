# Fragment Import & Processing Specification

## Overview

This document specifies how to process the initial fragment CSV (`fragment-corpus-cleaned.csv`) and convert it into the markdown-based Obsidian vault structure with full prosodic analysis and embeddings.

---

## Input: CSV Structure

**Columns:**
1. **ID**: Unique identifier (e.g., `frag0001`)
2. **Fragment**: Lyric text (may be multi-line)
3. **Attribution**: Source/author (blank if original by JC)
4. **Rhythmic**: `Y` or `N`
   - `Y`: Prosodic analysis required (syllables, stress, rhyme)
   - `N`: Semantic only; skip prosody
5. **Context**: Interpretive notes (becomes initial tags + embedding context)

**Total Fragments:** 65

---

## Processing Pipeline

### Step 1: CSV Parsing

```python
import csv
import yaml
from datetime import datetime
from pathlib import Path

def parse_csv(csv_path):
    """Parse CSV and return list of fragment dictionaries."""
    fragments = []
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            fragment = {
                'id': row['ID'],
                'text': row['Fragment'],
                'attribution': row['Attribution'].strip() if row['Attribution'] else None,
                'rhythmic': row['Rhythmic'].upper() == 'Y',
                'context': row['Context'].strip() if row['Context'] else None
            }
            fragments.append(fragment)
    
    return fragments
```

### Step 2: Tag Generation

For each fragment, generate tags using LLM analysis:

**Prompt:**
```
Given this lyric fragment and optional context, generate 3-7 relevant tags.

Fragment: "{fragment_text}"
{context_line}

Tags should capture:
- Themes (love, loss, defiance, hope, etc.)
- Imagery (urban, nocturnal, domestic, natural, etc.)
- Emotions (melancholic, hopeful, angry, tender, etc.)
- Style (satirical, sincere, abstract, narrative, etc.)

Return ONLY a comma-separated list of lowercase tags.
No explanations. No numbering.

Example output: urban, nocturnal, melancholic, walking, rain
```

Where `context_line` is:
- If context exists: `Context: "{context}"`
- If context is empty: omit this line

**Implementation:**
```python
async def generate_tags(fragment_text, context, llm_client):
    """Generate tags using LLM."""
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

    response = await llm_client.generate(
        prompt=prompt,
        max_tokens=50,
        temperature=0.3
    )
    
    # Parse response
    tags_str = response.strip()
    tags = [tag.strip() for tag in tags_str.split(',')]
    
    # Clean and deduplicate
    tags = list(set([t.lower() for t in tags if t]))
    
    return tags
```

### Step 3: Prosodic Analysis (Rhythmic=Y only)

**Dependencies:**
```python
import syllables  # or pyphen
import pronouncing
import nltk
from nltk.corpus import cmudict

# Ensure CMUdict is downloaded
nltk.download('cmudict')
cmu = cmudict.dict()
```

**Per-line analysis:**

```python
def analyze_line_prosody(line_text):
    """Analyze syllables, stress, and rhyme for a single line."""
    
    # 1. Syllable count
    syllable_count = count_syllables(line_text)
    
    # 2. Stress pattern
    stress_pattern = get_stress_pattern(line_text)
    
    # 3. End rhyme sound (last word)
    end_rhyme = get_end_rhyme_sound(line_text)
    
    return {
        'text': line_text,
        'syllables': syllable_count,
        'stress': stress_pattern,
        'end_rhyme': end_rhyme
    }

def count_syllables(text):
    """Count syllables in text using syllables library."""
    words = text.lower().split()
    total = 0
    for word in words:
        # Remove punctuation
        word = ''.join(c for c in word if c.isalpha())
        if word:
            count = syllables.estimate(word)
            total += count
    return total

def get_stress_pattern(text):
    """Get binary stress pattern using CMUdict."""
    words = text.lower().split()
    pattern = ""
    
    for word in words:
        # Clean word
        word = ''.join(c for c in word if c.isalpha())
        if not word:
            continue
            
        # Look up in CMUdict
        if word in cmu:
            phones = cmu[word][0]  # First pronunciation
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
            # Simple heuristic: first syllable stressed for 1-2 syllable words
            if syll <= 2:
                pattern += "1" + "0" * (syll - 1)
            else:
                # Longer words: stress every 2-3 syllables
                pattern += "1" + "0" * (syll - 1)
    
    return pattern

def get_end_rhyme_sound(text):
    """Get phonetic end rhyme sound using pronouncing library."""
    words = text.lower().split()
    if not words:
        return None
    
    # Get last word
    last_word = ''.join(c for c in words[-1] if c.isalpha())
    
    # Get rhymes (returns list of rhyming words)
    # We want the phonetic ending
    phones = pronouncing.phones_for_word(last_word)
    if phones:
        # Get primary phone
        phone = phones[0]
        # Extract rhyme part (from last stressed vowel to end)
        rhyme_part = pronouncing.rhyming_part(phone)
        return rhyme_part
    
    return None
```

**Multi-line fragment processing:**

```python
def analyze_fragment_prosody(fragment_text):
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
```

### Step 4: Embedding Generation

```python
from openai import AsyncOpenAI

async def generate_embedding(fragment_text, context, embedding_client):
    """Generate semantic embedding for fragment."""
    
    # Construct embedding text
    if context:
        embedding_text = f"{fragment_text}\n\nContext: {context}"
    else:
        embedding_text = fragment_text
    
    # Call OpenAI embeddings API
    response = await embedding_client.embeddings.create(
        model="text-embedding-3-small",
        input=embedding_text
    )
    
    embedding_vector = response.data[0].embedding
    return embedding_vector
```

### Step 5: Markdown File Creation

```python
def create_fragment_markdown(fragment_data, output_dir):
    """Create markdown file with YAML frontmatter."""
    
    # Construct frontmatter
    frontmatter = {
        'id': fragment_data['id'],
        'created': datetime.now().isoformat(),
        'source': fragment_data['attribution'] if fragment_data['attribution'] else 'JC',
        'rhythmic': fragment_data['rhythmic'],
        'tags': fragment_data['tags']
    }
    
    # Add context note if present
    if fragment_data['context']:
        frontmatter['context_note'] = fragment_data['context']
    else:
        frontmatter['context_note'] = ""
    
    # Add prosody if rhythmic
    if fragment_data['rhythmic'] and 'prosody_data' in fragment_data:
        frontmatter['lines'] = fragment_data['prosody_data']['lines']
        frontmatter['prosody'] = fragment_data['prosody_data']['prosody']
        frontmatter['fragment_type'] = fragment_data['prosody_data']['fragment_type']
    
    # Convert to YAML
    yaml_content = yaml.dump(frontmatter, default_flow_style=False, allow_unicode=True)
    
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
```

### Step 6: Database Population

```python
async def save_to_database(fragment_data, db_conn):
    """Save fragment to Postgres database."""
    
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
        fragment_data['context'],
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
```

### Step 7: Vector Store Population

```python
from upstash_vector import Index

async def save_to_vector_store(fragment_data, vector_index):
    """Save embedding to Upstash Vector."""
    
    # Prepare metadata
    metadata = {
        'id': fragment_data['id'],
        'source': fragment_data['attribution'] or 'JC',
        'tags': fragment_data['tags'],
        'rhythmic': fragment_data['rhythmic']
    }
    
    # If rhythmic, add prosody summary
    if fragment_data['rhythmic'] and 'prosody_data' in fragment_data:
        # Get average syllables
        syllables = [line['syllables'] for line in fragment_data['prosody_data']['prosody']]
        metadata['avg_syllables'] = sum(syllables) / len(syllables)
    
    # Upsert to vector store
    await vector_index.upsert(
        vectors=[{
            'id': fragment_data['id'],
            'vector': fragment_data['embedding'],
            'metadata': metadata
        }]
    )
    
    return fragment_data['id']  # This is the embedding_id
```

---

## Complete Processing Script

```python
import asyncio
from pathlib import Path

async def process_all_fragments(
    csv_path: str,
    output_dir: str,
    llm_client,
    embedding_client,
    db_conn,
    vector_index
):
    """Main processing pipeline."""
    
    # Parse CSV
    print("Parsing CSV...")
    fragments = parse_csv(csv_path)
    print(f"Found {len(fragments)} fragments")
    
    # Create output directory
    output_path = Path(output_dir) / "fragments"
    output_path.mkdir(parents=True, exist_ok=True)
    
    # Process each fragment
    for i, fragment in enumerate(fragments, 1):
        print(f"\nProcessing {fragment['id']} ({i}/{len(fragments)})...")
        
        # Generate tags
        print("  Generating tags...")
        tags = await generate_tags(
            fragment['text'],
            fragment['context'],
            llm_client
        )
        fragment['tags'] = tags
        
        # Analyze prosody if rhythmic
        if fragment['rhythmic']:
            print("  Analyzing prosody...")
            prosody_data = analyze_fragment_prosody(fragment['text'])
            fragment['prosody_data'] = prosody_data
        
        # Generate embedding
        print("  Generating embedding...")
        embedding = await generate_embedding(
            fragment['text'],
            fragment['context'],
            embedding_client
        )
        fragment['embedding'] = embedding
        
        # Save to vector store
        print("  Saving to vector store...")
        embedding_id = await save_to_vector_store(fragment, vector_index)
        fragment['embedding_id'] = embedding_id
        
        # Save to database
        print("  Saving to database...")
        await save_to_database(fragment, db_conn)
        
        # Create markdown file
        print("  Creating markdown file...")
        file_path = create_fragment_markdown(fragment, output_path)
        
        print(f"  ✓ Complete: {file_path}")
    
    print(f"\n✓ All {len(fragments)} fragments processed successfully!")

# Run the pipeline
if __name__ == "__main__":
    asyncio.run(process_all_fragments(
        csv_path="fragment-corpus-cleaned.csv",
        output_dir="lyrics-vault",
        llm_client=claude_client,  # Configure with API key
        embedding_client=openai_client,  # Configure with API key
        db_conn=db_connection,  # Neon Postgres connection
        vector_index=upstash_index  # Upstash Vector client
    ))
```

---

## Example Outputs

### Example 1: Rhythmic Fragment (frag0001)

**Markdown file: `fragments/frag0001.md`**

```yaml
---
id: frag0001
created: 2025-11-10T15:30:00Z
source: JC
rhythmic: true
tags:
  - biology
  - honesty
  - abstract
  - philosophical
  - science
context_note: ""
lines: 2
prosody:
  - line: 1
    text: An agent of biology,
    syllables: 9
    stress: "010101010"
    end_rhyme: "AH0 L AH0 JH IY0"
  - line: 2
    text: Acknowledging this honestly.
    syllables: 10
    stress: "01010101010"
    end_rhyme: "AH0 N AH0 S T L IY0"
fragment_type: couplet
---

An agent of biology,
Acknowledging this honestly.
```

**Database entry:**
```sql
-- fragments table
id: frag0001
source: JC
rhythmic: true
fragment_type: couplet
tags: {biology, honesty, abstract, philosophical, science}
context_note: ""
embedding_id: frag0001

-- fragment_lines table
fragment_id: frag0001, line_number: 1, syllables: 9, stress: "010101010"
fragment_id: frag0001, line_number: 2, syllables: 10, stress: "01010101010"
```

### Example 2: Non-Rhythmic Fragment (frag0005)

**Markdown file: `fragments/frag0005.md`**

```yaml
---
id: frag0005
created: 2025-11-10T15:30:00Z
source: JC
rhythmic: false
tags:
  - medical
  - unconscious
  - anxiety
  - anaesthetic
  - counting
  - procedure
context_note: "the experience of General Anaesthetic"
---

Count back from a hundred in sevens
```

**Database entry:**
```sql
-- fragments table
id: frag0005
source: JC
rhythmic: false
fragment_type: null
tags: {medical, unconscious, anxiety, anaesthetic, counting, procedure}
context_note: "the experience of General Anaesthetic"
embedding_id: frag0005

-- No fragment_lines entries (not rhythmic)
```

**Vector store entry:**
```json
{
  "id": "frag0005",
  "vector": [0.123, -0.456, ...],  // 1536-dim embedding
  "metadata": {
    "id": "frag0005",
    "source": "JC",
    "tags": ["medical", "unconscious", "anxiety", "anaesthetic", "counting", "procedure"],
    "rhythmic": false
  }
}
```

---

## Validation Checklist

After processing, verify:

- [ ] 65 markdown files created in `fragments/` directory
- [ ] Each file has valid YAML frontmatter
- [ ] Rhythmic fragments (Y) have `prosody` array with per-line data
- [ ] Non-rhythmic fragments (N) have no prosody fields
- [ ] All fragments have tags (3-7 tags each)
- [ ] Context notes preserved where present
- [ ] Source attribution preserved (or defaults to "JC")
- [ ] Database has 65 entries in `fragments` table
- [ ] Database has correct number of entries in `fragment_lines` table (only for rhythmic)
- [ ] Vector store has 65 embeddings
- [ ] Embedding IDs match between database and vector store
- [ ] Multi-line fragments preserved exactly (line breaks intact)

---

## Error Handling

**Common issues:**

1. **Missing CMUdict entries**: Some words not in dictionary
   - Solution: Fallback to syllable-based estimation
   
2. **Encoding issues**: Special characters in CSV
   - Solution: Use `encoding='utf-8'` for all file operations
   
3. **API rate limits**: Too many LLM/embedding calls
   - Solution: Add rate limiting (e.g., 10 requests/second)
   - Use batch processing where possible
   
4. **Multi-line CSV parsing**: Quoted fields with newlines
   - Solution: Use proper CSV library (Python's `csv` module handles this)

**Logging:**
```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

# Use throughout processing
logger.info(f"Processing fragment {fragment['id']}")
logger.error(f"Failed to analyze prosody for {fragment['id']}: {e}")
```

---

## Performance Considerations

**Estimated timing:**
- Tag generation: ~2 seconds per fragment (LLM call)
- Prosodic analysis: ~0.5 seconds per fragment
- Embedding generation: ~1 second per fragment (API call)
- Database save: ~0.1 seconds per fragment

**Total for 65 fragments:** ~4-5 minutes

**Optimization:**
- Process in parallel (asyncio for concurrent API calls)
- Batch embedding API calls (OpenAI supports batching)
- Cache CMUdict lookups

---

**Document Version:** 1.0  
**Last Updated:** November 10, 2025  
**Status:** Ready for Implementation
