/**
 * Generation Endpoint for Lybrarian
 * POST /api/generate
 *
 * Orchestrates the full generation pipeline:
 * 1. Analyze input prosody
 * 2. Retrieve fragments (semantic + prosodic)
 * 3. Build prompt with settings and fragments
 * 4. Call Claude API
 * 5. Parse and return generated verses
 * 6. Save session to database
 */

const fetch = require('node-fetch');
const { Pool } = require('pg');
const { analyzeVerse } = require('./utils/prosodic-analyzer');
const { retrieveFragments, getStyleReferences } = require('./utils/fragment-retriever');
const { buildPrompt, parseGeneratedVerses } = require('./utils/prompt-builder');

// Database connection pool
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

/**
 * Call Claude API via OpenRouter
 */
async function callClaudeAPI(systemPrompt, messages) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://lybrarian.app',
      'X-Title': 'Lybrarian'
    },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4.5',
      messages: messages,
      system: systemPrompt,
      temperature: 0.8, // Higher temperature for creative variation
      max_tokens: 2000
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API call failed: ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * Validate generated verses against settings
 * Returns { valid: boolean, reason: string }
 */
function validateVerse(verse, inputAnalysis, settings) {
  const { rhythm, rhyming } = settings;

  // Only validate if strict settings
  if (rhythm !== 'yes' && rhyming !== 'yes') {
    return { valid: true };
  }

  // Analyze generated verse
  const verseAnalysis = analyzeVerse(verse);

  // Check syllable count if rhythm is strict
  if (rhythm === 'yes') {
    if (verseAnalysis.length !== inputAnalysis.length) {
      return {
        valid: false,
        reason: 'Line count mismatch'
      };
    }

    for (let i = 0; i < verseAnalysis.length; i++) {
      const inputSyllables = inputAnalysis[i].syllables;
      const generatedSyllables = verseAnalysis[i].syllables;

      if (Math.abs(inputSyllables - generatedSyllables) > 1) {
        return {
          valid: false,
          reason: `Syllable mismatch on line ${i + 1}: expected ${inputSyllables}, got ${generatedSyllables}`
        };
      }
    }
  }

  // Check rhyme matching if rhyming is strict
  if (rhyming === 'yes') {
    // Simple check: last words should rhyme
    // (More sophisticated rhyme checking can be added later)
    const inputRhymes = inputAnalysis.map(l => l.rhymeSound).filter(r => r);
    const generatedRhymes = verseAnalysis.map(l => l.rhymeSound).filter(r => r);

    if (inputRhymes.length > 0 && generatedRhymes.length > 0) {
      // Basic check: at least some rhyme sounds should match
      const hasMatchingRhyme = generatedRhymes.some(gr =>
        inputRhymes.some(ir => ir && gr && ir.includes(gr.slice(-4)))
      );

      if (!hasMatchingRhyme) {
        return {
          valid: false,
          reason: 'Rhyme pattern mismatch'
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Get or create default project
 */
async function getOrCreateDefaultProject() {
  const db = getDbPool();

  try {
    // Try to get existing default project
    const selectQuery = `
      SELECT id FROM projects WHERE id = 'default' LIMIT 1
    `;
    const result = await db.query(selectQuery);

    if (result.rows.length > 0) {
      return result.rows[0].id;
    }

    // Create default project
    const insertQuery = `
      INSERT INTO projects (id, name, file_path, created_at, last_modified)
      VALUES ('default', 'Default Project', 'projects/default.md', NOW(), NOW())
      RETURNING id
    `;
    const insertResult = await db.query(insertQuery);
    return insertResult.rows[0].id;
  } catch (error) {
    console.error('Error getting/creating default project:', error);
    return 'default'; // Fallback to default even if query fails
  }
}

/**
 * Save generation session to database
 */
async function saveSession(sessionData, projectId = 'default') {
  const db = getDbPool();

  try {
    // Ensure project exists
    const actualProjectId = await getOrCreateDefaultProject();

    // Create session
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const sessionQuery = `
      INSERT INTO generation_sessions (
        id, project_id, input_verse,
        setting_religiosity, setting_rhythm, setting_rhyming, setting_meaning,
        theme_selection, steer_text, iteration_count, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      RETURNING id
    `;

    await db.query(sessionQuery, [
      sessionId,
      actualProjectId,
      sessionData.inputText,
      sessionData.settings.religiosity,
      sessionData.settings.rhythm,
      sessionData.settings.rhyming,
      sessionData.settings.meaning,
      sessionData.settings.theme,
      sessionData.settings.steer,
      sessionData.iterationCount || 1
    ]);

    // Save verses
    const versesQuery = `
      INSERT INTO generated_verses (session_id, iteration_number, verse_content, rating, created_at)
      VALUES ($1, $2, $3, $4, NOW())
    `;

    for (const verse of sessionData.verses) {
      await db.query(versesQuery, [
        sessionId,
        sessionData.iterationCount || 1,
        verse.text,
        'fine' // Default rating
      ]);
    }

    return sessionId;
  } catch (error) {
    console.error('Error saving session:', error);
    throw error;
  }
}

/**
 * Main handler function
 */
exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only accept POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse request body
    const body = JSON.parse(event.body);
    const {
      input,
      settings = {},
      previousRatings = null
    } = body;

    // Validate input
    if (!input || !input.trim()) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Input text is required' })
      };
    }

    // Set default settings
    const fullSettings = {
      religiosity: settings.religiosity || 'ish',
      rhythm: settings.rhythm || 'yes',
      rhyming: settings.rhyming || 'ish',
      meaning: settings.meaning || 'yes',
      theme: settings.theme || 'none',
      steer: settings.steer || ''
    };

    console.log('Generation request:', { input: input.substring(0, 50), settings: fullSettings });

    // Step 1: Analyze input prosody
    const inputAnalysis = analyzeVerse(input);
    console.log('Input analysis:', inputAnalysis);

    // Step 2: Retrieve fragments (semantic + prosodic)
    const fragments = await retrieveFragments(input, inputAnalysis, fullSettings);
    console.log(`Retrieved ${fragments.length} fragments`);

    // Step 3: Get style references
    const styleReferences = await getStyleReferences(3);
    console.log(`Retrieved ${styleReferences.length} style references`);

    // Step 4: Build prompt
    const prompt = buildPrompt(input, fullSettings, fragments, styleReferences, previousRatings);
    console.log('Prompt built');

    // Step 5: Call Claude API
    console.log('Calling Claude API...');
    const responseText = await callClaudeAPI(prompt.system, prompt.messages);
    console.log('Claude API response received');

    // Step 6: Parse generated verses
    const verses = parseGeneratedVerses(responseText);
    console.log(`Parsed ${verses.length} verses`);

    // Step 7: Validate verses (if strict settings)
    const validatedVerses = verses.map(verse => {
      const validation = validateVerse(verse.text, inputAnalysis, fullSettings);
      return {
        ...verse,
        valid: validation.valid,
        validationReason: validation.reason
      };
    });

    // Filter to valid verses only (or return all with validation status)
    const finalVerses = fullSettings.rhythm === 'yes' || fullSettings.rhyming === 'yes'
      ? validatedVerses.filter(v => v.valid)
      : validatedVerses;

    console.log(`Final verses count: ${finalVerses.length}`);

    // Step 8: Save session to database
    const sessionId = await saveSession({
      inputText: input,
      settings: fullSettings,
      verses: finalVerses
    });

    console.log('Session saved:', sessionId);

    // Return response
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        sessionId,
        verses: finalVerses.map(v => ({
          number: v.number,
          text: v.text
        })),
        metadata: {
          inputAnalysis,
          fragmentsRetrieved: fragments.length,
          styleReferencesUsed: styleReferences.length,
          settings: fullSettings
        }
      })
    };

  } catch (error) {
    console.error('Generation error:', error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Generation failed',
        message: error.message
      })
    };
  }
};
