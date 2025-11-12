/**
 * Fragment Retrieval System
 * Dual retrieval strategy: Semantic (vector) + Prosodic (SQL)
 */

const { Index } = require('@upstash/vector');

/**
 * Generate text embedding via OpenRouter (OpenAI text-embedding-3-small)
 * @param {string} text - Text to embed
 * @returns {Promise<number[]>} - 1536-dimensional embedding vector
 */
async function generateEmbedding(text) {
  const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'openai/text-embedding-3-small',
      input: text,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter embedding failed: ${error}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * Semantic retrieval via Upstash Vector
 * @param {string} inputText - User's input verse
 * @param {number} topK - Number of results to retrieve
 * @returns {Promise<Array<{id: string, score: number}>>} - Fragment IDs with similarity scores
 */
async function semanticRetrieval(inputText, topK = 20) {
  try {
    // Initialize Upstash Vector client
    const index = new Index({
      url: process.env.UPSTASH_VECTOR_URL,
      token: process.env.UPSTASH_VECTOR_TOKEN,
    });

    // Generate embedding for input text
    const embedding = await generateEmbedding(inputText);

    // Query vector store
    const results = await index.query({
      vector: embedding,
      topK: topK,
      includeMetadata: false,
    });

    // Return fragment IDs with scores
    return results.map(result => ({
      id: result.id,
      score: result.score, // Cosine similarity (0-1)
    }));
  } catch (error) {
    console.error('Semantic retrieval error:', error);
    return []; // Graceful degradation
  }
}

/**
 * Prosodic retrieval via SQL queries on fragment_lines
 * @param {Object} prosodyData - Analyzed prosody of input verse
 * @param {Array<{syllables: number, stress: string, rhyme: string}>} prosodyData.lines - Per-line prosody
 * @param {Object} db - Database connection
 * @param {string} rhythmSetting - 'yes' | 'ish' | 'no'
 * @returns {Promise<Array<string>>} - Fragment IDs matching prosodic criteria
 */
async function prosodicRetrieval(prosodyData, db, rhythmSetting) {
  // Skip prosodic retrieval if rhythm setting is 'no'
  if (rhythmSetting === 'no' || !prosodyData || !prosodyData.lines) {
    return [];
  }

  try {
    const fragmentIds = new Set();

    // For each line in the input, find matching fragments
    for (const line of prosodyData.lines) {
      const { syllables, stress, rhyme } = line;

      let query;
      let params;

      if (rhythmSetting === 'yes') {
        // Exact syllable match required
        query = `
          SELECT DISTINCT fragment_id
          FROM fragment_lines
          WHERE syllables = $1
        `;
        params = [syllables];
      } else if (rhythmSetting === 'ish') {
        // ±2 syllables tolerance
        query = `
          SELECT DISTINCT fragment_id
          FROM fragment_lines
          WHERE syllables BETWEEN $1 AND $2
        `;
        params = [syllables - 2, syllables + 2];
      }

      const result = await db.query(query, params);

      // Add all matching fragment IDs to the set
      result.rows.forEach(row => fragmentIds.add(row.fragment_id));
    }

    return Array.from(fragmentIds);
  } catch (error) {
    console.error('Prosodic retrieval error:', error);
    return []; // Graceful degradation
  }
}

/**
 * Combine and rank fragments from both retrieval methods
 * @param {Array<{id: string, score: number}>} semanticResults - Results from vector search
 * @param {Array<string>} prosodicResults - Fragment IDs from prosodic search
 * @param {Object} settings - Generation settings
 * @param {string} settings.rhythm - Rhythm setting ('yes'|'ish'|'no')
 * @param {Object} db - Database connection for fetching fragment metadata
 * @returns {Promise<Array<{id: string, score: number}>>} - Top 15-20 fragment IDs ranked by combined score
 */
async function combineAndRank(semanticResults, prosodicResults, settings, db) {
  try {
    // Create a map of fragment scores
    const scoreMap = new Map();

    // Start with semantic scores (0-1 range)
    semanticResults.forEach(result => {
      scoreMap.set(result.id, {
        id: result.id,
        baseScore: result.score,
        totalScore: result.score,
        inProsodicResults: false,
        isRhythmic: false,
      });
    });

    // Mark fragments that appear in prosodic results
    const prosodicSet = new Set(prosodicResults);
    scoreMap.forEach((data, id) => {
      if (prosodicSet.has(id)) {
        data.inProsodicResults = true;
        data.totalScore += 0.3; // +0.3 bonus for prosodic match
      }
    });

    // Add fragments from prosodic results that weren't in semantic results
    prosodicResults.forEach(id => {
      if (!scoreMap.has(id)) {
        scoreMap.set(id, {
          id: id,
          baseScore: 0.5, // Default score for prosodic-only matches
          totalScore: 0.5 + 0.3, // Base + prosodic bonus
          inProsodicResults: true,
          isRhythmic: false,
        });
      }
    });

    // Fetch fragment metadata to check rhythmic status
    const fragmentIds = Array.from(scoreMap.keys());
    if (fragmentIds.length > 0) {
      const placeholders = fragmentIds.map((_, i) => `$${i + 1}`).join(',');
      const query = `
        SELECT id, rhythmic
        FROM fragments
        WHERE id IN (${placeholders})
      `;
      const result = await db.query(query, fragmentIds);

      // Add rhythmic bonus if rhythm setting is enabled
      result.rows.forEach(row => {
        const data = scoreMap.get(row.id);
        if (data && row.rhythmic && settings.rhythm === 'yes') {
          data.isRhythmic = true;
          data.totalScore += 0.2; // +0.2 bonus for rhythmic fragments when rhythm=yes
        }
      });
    }

    // Sort by total score (descending) and return top 15-20
    const rankedFragments = Array.from(scoreMap.values())
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 20)
      .map(data => ({
        id: data.id,
        score: data.totalScore,
      }));

    return rankedFragments;
  } catch (error) {
    console.error('Combine and rank error:', error);
    // Fall back to semantic results only
    return semanticResults.slice(0, 20);
  }
}

/**
 * Main retrieval function - orchestrates semantic + prosodic retrieval
 * @param {string} inputText - User's input verse
 * @param {Object} prosodyData - Analyzed prosody (syllables, stress, rhyme per line)
 * @param {Object} settings - Generation settings
 * @param {string} settings.meaning - Meaning setting ('yes'|'ish'|'no')
 * @param {string} settings.rhythm - Rhythm setting ('yes'|'ish'|'no')
 * @param {string} settings.rhyming - Rhyming setting ('yes'|'ish'|'no')
 * @param {string} settings.religiosity - Fragment adherence ('yes'|'ish'|'no')
 * @param {Object} db - Database connection
 * @returns {Promise<Array<Object>>} - Array of full fragment objects with content, tags, prosody
 */
async function retrieveFragments(inputText, prosodyData, settings, db) {
  try {
    // Step 1: Semantic retrieval (skip if meaning='no')
    let semanticResults = [];
    if (settings.meaning !== 'no') {
      semanticResults = await semanticRetrieval(inputText, 20);
      console.log(`Semantic retrieval: ${semanticResults.length} fragments`);
    }

    // Step 2: Prosodic retrieval (skip if rhythm='no')
    let prosodicResults = [];
    if (settings.rhythm !== 'no') {
      prosodicResults = await prosodicRetrieval(prosodyData, db, settings.rhythm);
      console.log(`Prosodic retrieval: ${prosodicResults.length} fragments`);
    }

    // Step 3: Combine and rank
    const rankedFragments = await combineAndRank(
      semanticResults,
      prosodicResults,
      settings,
      db
    );
    console.log(`Combined ranking: ${rankedFragments.length} fragments`);

    // Step 4: Fetch full fragment data
    if (rankedFragments.length === 0) {
      return [];
    }

    const fragmentIds = rankedFragments.map(f => f.id);
    const placeholders = fragmentIds.map((_, i) => `$${i + 1}`).join(',');

    const query = `
      SELECT
        f.id,
        f.content,
        f.tags,
        f.context_note,
        f.rhythmic,
        f.fragment_type,
        COALESCE(
          json_agg(
            json_build_object(
              'line_number', fl.line_number,
              'text', fl.text,
              'syllables', fl.syllables,
              'stress_pattern', fl.stress_pattern,
              'end_rhyme_us', fl.end_rhyme_us,
              'end_rhyme_gb', fl.end_rhyme_gb
            ) ORDER BY fl.line_number
          ) FILTER (WHERE fl.id IS NOT NULL),
          '[]'::json
        ) as lines
      FROM fragments f
      LEFT JOIN fragment_lines fl ON f.id = fl.fragment_id
      WHERE f.id IN (${placeholders})
      GROUP BY f.id, f.content, f.tags, f.context_note, f.rhythmic, f.fragment_type
    `;

    const result = await db.query(query, fragmentIds);

    // Create a map for quick lookup
    const fragmentMap = new Map(
      result.rows.map(row => [row.id, row])
    );

    // Return fragments in ranked order with scores
    const orderedFragments = rankedFragments.map(ranked => {
      const fragment = fragmentMap.get(ranked.id);
      return {
        ...fragment,
        retrievalScore: ranked.score,
      };
    }).filter(f => f.id); // Filter out any missing fragments

    console.log(`Retrieved ${orderedFragments.length} full fragments`);
    return orderedFragments;

  } catch (error) {
    console.error('Fragment retrieval error:', error);
    return []; // Graceful degradation
  }
}

module.exports = {
  semanticRetrieval,
  prosodicRetrieval,
  combineAndRank,
  retrieveFragments,
  generateEmbedding, // Export for testing
};
