/**
 * Fragment Retriever for Lybrarian
 * Implements dual retrieval: semantic (vector) + prosodic (SQL)
 * Combines and ranks fragments for generation prompts
 */

const { Index } = require('@upstash/vector');
const { Pool } = require('pg');
const fetch = require('node-fetch');

// Database connection pool (reuse across function invocations)
let pool = null;

function getDbPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
  }
  return pool;
}

// Upstash Vector index (reuse across function invocations)
let vectorIndex = null;

function getVectorIndex() {
  if (!vectorIndex) {
    vectorIndex = new Index({
      url: process.env.UPSTASH_VECTOR_URL,
      token: process.env.UPSTASH_VECTOR_TOKEN
    });
  }
  return vectorIndex;
}

/**
 * Generate embedding for text using OpenAI via OpenRouter
 */
async function generateEmbedding(text) {
  const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://lybrarian.app',
      'X-Title': 'Lybrarian'
    },
    body: JSON.stringify({
      model: 'openai/text-embedding-3-small',
      input: text
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Embedding generation failed: ${error}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * Semantic search using Upstash Vector
 * Returns fragments similar to the input text
 */
async function semanticSearch(text, limit = 20) {
  try {
    // Generate embedding for input text
    const embedding = await generateEmbedding(text);

    // Query vector index
    const index = getVectorIndex();
    const results = await index.query({
      vector: embedding,
      topK: limit,
      includeMetadata: true
    });

    // Return fragment IDs with similarity scores
    return results.map(result => ({
      fragmentId: result.id,
      semanticScore: result.score,
      metadata: result.metadata
    }));
  } catch (error) {
    console.error('Semantic search error:', error);
    return [];
  }
}

/**
 * Prosodic search using SQL
 * Finds fragments matching syllable count and rhyme patterns
 */
async function prosodicSearch(lineAnalyses, settings) {
  const db = getDbPool();
  const fragments = [];

  try {
    // Build SQL query based on settings
    const rhythmMode = settings.rhythm || 'ish';

    if (rhythmMode === 'no') {
      // No prosodic filtering - return empty (rely on semantic search)
      return [];
    }

    // For each input line, find fragments with matching prosody
    for (const lineAnalysis of lineAnalyses) {
      const { syllables, stressPattern, rhymeSound } = lineAnalysis;

      // Build WHERE clauses based on strictness
      const conditions = [];
      const params = [];
      let paramIndex = 1;

      // Syllable matching
      if (rhythmMode === 'yes') {
        // Exact match
        conditions.push(`fl.syllables = $${paramIndex}`);
        params.push(syllables);
        paramIndex++;
      } else if (rhythmMode === 'ish') {
        // ±2 syllables tolerance
        conditions.push(`fl.syllables BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
        params.push(syllables - 2, syllables + 2);
        paramIndex += 2;
      }

      // Rhyme matching (if enabled)
      const rhymeMode = settings.rhyming || 'ish';
      if (rhymeMode !== 'no' && rhymeSound) {
        if (rhymeMode === 'yes') {
          // Exact rhyme match (US pronunciation - we'll expand to GB later)
          conditions.push(`fl.end_rhyme_us = $${paramIndex}`);
          params.push(rhymeSound);
          paramIndex++;
        } else if (rhymeMode === 'ish') {
          // Partial rhyme match (last 2-3 phonemes)
          const rhymeSuffix = rhymeSound.split(' ').slice(-2).join(' ');
          conditions.push(`fl.end_rhyme_us LIKE $${paramIndex}`);
          params.push(`%${rhymeSuffix}%`);
          paramIndex++;
        }
      }

      // Skip if no conditions (shouldn't happen, but defensive)
      if (conditions.length === 0) {
        continue;
      }

      // Query database
      const query = `
        SELECT DISTINCT
          f.id,
          f.content,
          f.tags,
          f.rhythmic,
          f.fragment_type,
          fl.syllables,
          fl.stress_pattern,
          fl.end_rhyme_us,
          COUNT(*) OVER (PARTITION BY f.id) as matching_lines
        FROM fragments f
        JOIN fragment_lines fl ON f.id = fl.fragment_id
        WHERE ${conditions.join(' AND ')}
        ORDER BY matching_lines DESC, f.created_at DESC
        LIMIT 20
      `;

      const result = await db.query(query, params);

      // Add to results with prosodic score
      for (const row of result.rows) {
        fragments.push({
          fragmentId: row.id,
          content: row.content,
          tags: row.tags,
          rhythmic: row.rhythmic,
          fragmentType: row.fragment_type,
          prosodicScore: row.matching_lines / lineAnalyses.length, // Normalized score
          syllables: row.syllables,
          stressPattern: row.stress_pattern,
          rhymeSound: row.end_rhyme_us
        });
      }
    }

    return fragments;
  } catch (error) {
    console.error('Prosodic search error:', error);
    return [];
  }
}

/**
 * Get full fragment data from database by IDs
 */
async function getFragmentsByIds(fragmentIds) {
  const db = getDbPool();

  try {
    const query = `
      SELECT
        f.id,
        f.content,
        f.tags,
        f.rhythmic,
        f.fragment_type,
        f.context_note,
        json_agg(
          json_build_object(
            'line_number', fl.line_number,
            'text', fl.text,
            'syllables', fl.syllables,
            'stress_pattern', fl.stress_pattern,
            'end_rhyme_us', fl.end_rhyme_us,
            'end_rhyme_gb', fl.end_rhyme_gb
          ) ORDER BY fl.line_number
        ) as lines
      FROM fragments f
      LEFT JOIN fragment_lines fl ON f.id = fl.fragment_id
      WHERE f.id = ANY($1)
      GROUP BY f.id, f.content, f.tags, f.rhythmic, f.fragment_type, f.context_note
    `;

    const result = await db.query(query, [fragmentIds]);
    return result.rows;
  } catch (error) {
    console.error('Error fetching fragments:', error);
    return [];
  }
}

/**
 * Combine semantic and prosodic results with scoring
 */
function combineAndRankFragments(semanticResults, prosodicResults, settings) {
  const fragmentScores = new Map();

  // Weight factors based on settings
  const meaningMode = settings.meaning || 'ish';
  const rhythmMode = settings.rhythm || 'yes';

  const semanticWeight = meaningMode === 'no' ? 0 : (meaningMode === 'yes' ? 0.7 : 0.5);
  const prosodicWeight = rhythmMode === 'no' ? 0 : (rhythmMode === 'yes' ? 0.7 : 0.5);

  // Add semantic scores
  for (const result of semanticResults) {
    const existingScore = fragmentScores.get(result.fragmentId) || { total: 0, semantic: 0, prosodic: 0 };
    existingScore.semantic = result.semanticScore * semanticWeight;
    existingScore.total += existingScore.semantic;
    fragmentScores.set(result.fragmentId, existingScore);
  }

  // Add prosodic scores
  for (const result of prosodicResults) {
    const existingScore = fragmentScores.get(result.fragmentId) || { total: 0, semantic: 0, prosodic: 0 };
    existingScore.prosodic = result.prosodicScore * prosodicWeight;
    existingScore.total += existingScore.prosodic;
    fragmentScores.set(result.fragmentId, existingScore);
  }

  // Convert to array and sort by total score
  const ranked = Array.from(fragmentScores.entries())
    .map(([fragmentId, scores]) => ({ fragmentId, ...scores }))
    .sort((a, b) => b.total - a.total);

  return ranked;
}

/**
 * Main retrieval function - orchestrates dual search
 */
async function retrieveFragments(inputText, lineAnalyses, settings) {
  try {
    // Run both searches in parallel
    const [semanticResults, prosodicResults] = await Promise.all([
      semanticSearch(inputText, 20),
      prosodicSearch(lineAnalyses, settings)
    ]);

    // Combine and rank
    const rankedFragments = combineAndRankFragments(semanticResults, prosodicResults, settings);

    // Get top 15-20 fragment IDs
    const topFragmentIds = rankedFragments.slice(0, 20).map(f => f.fragmentId);

    // Fetch full fragment data
    const fragments = await getFragmentsByIds(topFragmentIds);

    // Return with scores
    return fragments.map(fragment => {
      const scores = rankedFragments.find(r => r.fragmentId === fragment.id);
      return {
        ...fragment,
        retrievalScore: scores ? scores.total : 0,
        semanticScore: scores ? scores.semantic : 0,
        prosodicScore: scores ? scores.prosodic : 0
      };
    });
  } catch (error) {
    console.error('Fragment retrieval error:', error);
    throw error;
  }
}

/**
 * Get style reference lyrics (completed lyrics marked for style)
 */
async function getStyleReferences(limit = 3) {
  const db = getDbPool();

  try {
    const query = `
      SELECT id, title, content, tags
      FROM completed_lyrics
      WHERE use_for_style = true
      ORDER BY created_at DESC
      LIMIT $1
    `;

    const result = await db.query(query, [limit]);
    return result.rows;
  } catch (error) {
    console.error('Error fetching style references:', error);
    return [];
  }
}

module.exports = {
  retrieveFragments,
  getStyleReferences,
  semanticSearch,
  prosodicSearch
};
