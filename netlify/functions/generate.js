/**
 * Main Generation Endpoint
 * Orchestrates the complete lyric generation pipeline:
 * 1. Validate request
 * 2. Analyze input prosody
 * 3. Retrieve fragments (semantic + prosodic)
 * 4. Get style references
 * 5. Build prompt
 * 6. Call Claude API
 * 7. Validate output
 * 8. Save to database
 * 9. Return results
 */

const { analyzeVerse, analyzeLine, getRhymeSound, rhymesMatch } = require('./lib/prosody');
const { retrieveFragments } = require('./lib/retrieval');
const { buildGenerationPrompt } = require('./lib/promptBuilder');
const db = require('./lib/db');
const fetch = require('node-fetch');

/**
 * Validate request body
 * @param {Object} body - Request body
 * @returns {Object|null} - Error object if invalid, null if valid
 */
function validateRequest(body) {
  if (!body) {
    return { error: 'Request body is required', code: 400 };
  }

  // Input verse is required
  if (!body.input || typeof body.input !== 'string' || body.input.trim().length === 0) {
    return { error: 'Input verse is required and must be a non-empty string', code: 400 };
  }

  // Settings are required
  if (!body.settings || typeof body.settings !== 'object') {
    return { error: 'Settings object is required', code: 400 };
  }

  // Validate setting values
  const validValues = ['no', 'ish', 'yes'];
  const settings = body.settings;

  if (settings.religiosity && !validValues.includes(settings.religiosity)) {
    return { error: 'religiosity must be "no", "ish", or "yes"', code: 400 };
  }

  if (settings.rhythm && !validValues.includes(settings.rhythm)) {
    return { error: 'rhythm must be "no", "ish", or "yes"', code: 400 };
  }

  if (settings.rhyming && !validValues.includes(settings.rhyming)) {
    return { error: 'rhyming must be "no", "ish", or "yes"', code: 400 };
  }

  if (settings.meaning && !validValues.includes(settings.meaning)) {
    return { error: 'meaning must be "no", "ish", or "yes"', code: 400 };
  }

  // Iteration must be positive integer if provided
  if (body.iteration && (!Number.isInteger(body.iteration) || body.iteration < 1)) {
    return { error: 'iteration must be a positive integer', code: 400 };
  }

  // Feedback validation for iteration 2+
  if (body.iteration && body.iteration > 1) {
    if (!body.feedback) {
      return { error: 'feedback is required for iteration 2+', code: 400 };
    }
  }

  return null; // Valid
}

/**
 * Generate a unique ID for database records
 * @param {string} prefix - ID prefix (e.g., 'sess', 'proj')
 * @returns {string} - Unique ID
 */
function generateId(prefix) {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `${prefix}-${timestamp}${random}`;
}

/**
 * Get or create a default project for the session
 * @param {Object} db - Database connection
 * @param {string} userId - User ID (default: 'user-jc')
 * @returns {Promise<string>} - Project ID
 */
async function getOrCreateProject(db, userId = 'user-jc') {
  try {
    // Check if a default project exists
    const result = await db.query(
      `SELECT id FROM projects
       WHERE user_id = $1 AND name = 'Untitled Project'
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    if (result.rows.length > 0) {
      return result.rows[0].id;
    }

    // Create a new default project
    const projectId = generateId('proj');
    await db.query(
      `INSERT INTO projects (id, name, user_id, file_path, workspace_content, created_at, last_modified)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [projectId, 'Untitled Project', userId, `/projects/${projectId}.md`, '']
    );

    console.log(`Created new project: ${projectId}`);
    return projectId;
  } catch (error) {
    console.error('Error getting/creating project:', error);
    throw error;
  }
}

/**
 * Get style references from completed_lyrics table
 * @param {Object} db - Database connection
 * @param {number} limit - Number of songs to retrieve (default: 3)
 * @returns {Promise<Array>} - Array of completed songs
 */
async function getStyleReferences(db, limit = 3) {
  try {
    const result = await db.query(
      `SELECT id, title, content, tags
       FROM completed_lyrics
       WHERE use_for_style = true
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows;
  } catch (error) {
    console.error('Error fetching style references:', error);
    return []; // Graceful degradation
  }
}

/**
 * Call Claude API via OpenRouter
 * @param {string} systemPrompt - System prompt
 * @param {string} userPrompt - User prompt
 * @returns {Promise<Array>} - Array of 10 verse objects
 */
async function callClaudeAPI(systemPrompt, userPrompt) {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable is not set');
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://lybrarian.app',
      'X-Title': 'Lybrarian'
    },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4.5',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 4000
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenRouter API error:', errorText);
    throw new Error(`OpenRouter API request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  // Extract content from response
  const content = data.choices[0].message.content;

  // Parse JSON response
  try {
    // Remove markdown code blocks if present
    let jsonStr = content.trim();
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/```\s*$/, '');
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```\s*/, '').replace(/```\s*$/, '');
    }

    const verses = JSON.parse(jsonStr);

    if (!Array.isArray(verses)) {
      throw new Error('Response is not an array');
    }

    if (verses.length !== 10) {
      console.warn(`Expected 10 verses, got ${verses.length}`);
    }

    return verses;
  } catch (parseError) {
    console.error('Failed to parse Claude API response:', parseError);
    console.error('Raw content:', content);
    throw new Error('Failed to parse verse generation response as JSON');
  }
}

/**
 * Validate a single generated verse against prosodic constraints
 * @param {string} verseText - Generated verse text
 * @param {Array} inputProsody - Input verse prosody analysis
 * @param {Object} settings - Generation settings
 * @returns {Object} - { valid: boolean, errors: Array }
 */
function validateVerse(verseText, inputProsody, settings) {
  const errors = [];

  // Skip validation if settings are not strict
  if (settings.rhythm !== 'yes' && settings.rhyming !== 'yes') {
    return { valid: true, errors: [] };
  }

  try {
    // Analyze the generated verse
    const generatedProsody = analyzeVerse(verseText);

    // Validate rhythm (syllable counts)
    if (settings.rhythm === 'yes') {
      if (inputProsody.length !== generatedProsody.length) {
        errors.push(`Line count mismatch: expected ${inputProsody.length}, got ${generatedProsody.length}`);
      } else {
        inputProsody.forEach((inputLine, i) => {
          const generatedLine = generatedProsody[i];
          if (inputLine.syllables !== generatedLine.syllables) {
            errors.push(`Line ${i + 1}: expected ${inputLine.syllables} syllables, got ${generatedLine.syllables}`);
          }
        });
      }
    }

    // Validate rhyming (last line rhyme sound)
    if (settings.rhyming === 'yes' && inputProsody.length > 0 && generatedProsody.length > 0) {
      const inputLastLine = inputProsody[inputProsody.length - 1];
      const generatedLastLine = generatedProsody[generatedProsody.length - 1];

      if (inputLastLine.rhymeSound && generatedLastLine.rhymeSound) {
        if (!rhymesMatch(inputLastLine.rhymeSound, generatedLastLine.rhymeSound)) {
          errors.push(`Rhyme mismatch: expected rhyme with "${inputLastLine.endWord}", got "${generatedLastLine.endWord}"`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  } catch (error) {
    console.error('Validation error:', error);
    return { valid: true, errors: [] }; // Skip validation on error
  }
}

/**
 * Regenerate failed verses (max 2 attempts per verse)
 * @param {Array} verses - All verses
 * @param {Array} inputProsody - Input prosody
 * @param {Object} settings - Settings
 * @param {string} systemPrompt - System prompt
 * @param {string} userPrompt - User prompt
 * @returns {Promise<Array>} - Verses with regenerated replacements
 */
async function regenerateFailedVerses(verses, inputProsody, settings, systemPrompt, userPrompt) {
  const maxRetries = 2;
  const failedIndices = [];

  // Identify failed verses
  verses.forEach((verse, i) => {
    const validation = validateVerse(verse.verse, inputProsody, settings);
    if (!validation.valid) {
      console.log(`Verse ${i + 1} failed validation:`, validation.errors);
      failedIndices.push(i);
    }
  });

  if (failedIndices.length === 0) {
    return verses; // All valid
  }

  console.log(`${failedIndices.length} verses failed validation, attempting regeneration...`);

  // Attempt to regenerate each failed verse
  for (const index of failedIndices) {
    let attempts = 0;
    let regenerated = verses[index];

    while (attempts < maxRetries) {
      attempts++;
      console.log(`Regenerating verse ${index + 1}, attempt ${attempts}/${maxRetries}`);

      try {
        // Request a new batch and take the first one
        const newVerses = await callClaudeAPI(systemPrompt, userPrompt);
        regenerated = newVerses[0];

        // Validate the new verse
        const validation = validateVerse(regenerated.verse, inputProsody, settings);
        if (validation.valid) {
          console.log(`Verse ${index + 1} regenerated successfully`);
          verses[index] = regenerated;
          break;
        }
      } catch (error) {
        console.error(`Regeneration attempt ${attempts} failed:`, error);
      }
    }

    // If still failed after retries, accept it with a warning
    if (attempts >= maxRetries) {
      console.warn(`Verse ${index + 1} failed validation after ${maxRetries} retries, accepting anyway`);
      verses[index] = regenerated;
    }
  }

  return verses;
}

/**
 * Save session and verses to database
 * @param {Object} db - Database connection
 * @param {string} projectId - Project ID
 * @param {string} input - Input verse
 * @param {Object} settings - Generation settings
 * @param {number} iteration - Iteration number
 * @param {Array} verses - Generated verses
 * @returns {Promise<string>} - Session ID
 */
async function saveToDatabase(db, projectId, input, settings, iteration, verses) {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    // Create session record
    const sessionId = generateId('sess');
    await client.query(
      `INSERT INTO generation_sessions (
        id, project_id, input_verse,
        setting_religiosity, setting_rhythm, setting_rhyming, setting_meaning,
        theme_selection, steer_text, iteration_count, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
      [
        sessionId,
        projectId,
        input,
        settings.religiosity || 'ish',
        settings.rhythm || 'yes',
        settings.rhyming || 'ish',
        settings.meaning || 'yes',
        settings.theme || 'Let me tell you a story',
        settings.steer || '',
        iteration
      ]
    );

    // Insert all verses
    for (const verse of verses) {
      await client.query(
        `INSERT INTO generated_verses (
          session_id, iteration_number, verse_content, rating, is_keeper, created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())`,
        [
          sessionId,
          iteration,
          verse.verse,
          'fine', // Default rating
          false
        ]
      );
    }

    await client.query('COMMIT');
    console.log(`Saved session ${sessionId} with ${verses.length} verses`);

    return sessionId;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Database transaction error:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Netlify serverless function handler
 */
exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse request body
    const body = JSON.parse(event.body);

    // Step 1: Validate request
    const validationError = validateRequest(body);
    if (validationError) {
      return {
        statusCode: validationError.code,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: validationError.error })
      };
    }

    console.log('=== Generation Pipeline Started ===');
    console.log('Input:', body.input.substring(0, 100) + '...');
    console.log('Settings:', body.settings);
    console.log('Iteration:', body.iteration || 1);

    // Extract and normalize settings
    const settings = {
      religiosity: (body.settings.religiosity || 'ish').toLowerCase(),
      rhythm: (body.settings.rhythm || 'yes').toLowerCase(),
      rhyming: (body.settings.rhyming || 'ish').toLowerCase(),
      meaning: (body.settings.meaning || 'yes').toLowerCase(),
      theme: body.settings.theme || 'Let me tell you a story',
      steer: body.settings.steer || ''
    };

    const iteration = body.iteration || 1;
    const feedback = body.feedback || null;

    // Step 2: Analyze input prosody (if rhythm ≠ "no")
    let inputProsody = [];
    if (settings.rhythm !== 'no') {
      console.log('Analyzing input prosody...');
      inputProsody = analyzeVerse(body.input);
      console.log(`Analyzed ${inputProsody.length} lines:`,
        inputProsody.map(l => `${l.syllables} syllables`).join(', '));
    }

    // Step 3: Retrieve fragments
    console.log('Retrieving fragments...');
    const fragments = await retrieveFragments(
      body.input,
      { lines: inputProsody },
      settings,
      db
    );
    console.log(`Retrieved ${fragments.length} fragments`);

    // Step 4: Get style references
    console.log('Fetching style references...');
    const styleRefs = await getStyleReferences(db, 3);
    console.log(`Retrieved ${styleRefs.length} style references`);

    // Step 5: Build prompt
    console.log('Building generation prompt...');
    const { systemPrompt, userPrompt } = buildGenerationPrompt(
      body.input,
      settings,
      fragments,
      styleRefs,
      iteration,
      feedback
    );
    console.log('Prompt built successfully');

    // Step 6: Call Claude API
    console.log('Calling Claude API...');
    const startTime = Date.now();
    let verses = await callClaudeAPI(systemPrompt, userPrompt);
    const generationTime = Date.now() - startTime;
    console.log(`Generated ${verses.length} verses in ${generationTime}ms`);

    // Step 7: Validate output (if strict settings)
    if (settings.rhythm === 'yes' || settings.rhyming === 'yes') {
      console.log('Validating verses...');
      verses = await regenerateFailedVerses(
        verses,
        inputProsody,
        settings,
        systemPrompt,
        userPrompt
      );
    }

    // Step 8: Get or create project
    const projectId = body.projectId || await getOrCreateProject(db);

    // Step 9: Save to database
    console.log('Saving to database...');
    const sessionId = await saveToDatabase(
      db,
      projectId,
      body.input,
      settings,
      iteration,
      verses
    );

    // Step 10: Return response
    console.log('=== Generation Pipeline Complete ===');

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        sessionId,
        projectId,
        verses: verses.map(v => ({
          verse: v.verse,
          fragmentsUsed: v.fragmentsUsed || [],
          explanation: v.explanation || '',
          rating: null
        })),
        metadata: {
          generationTime: `${generationTime}ms`,
          fragmentCount: fragments.length,
          styleRefCount: styleRefs.length,
          iteration
        },
        // Debug info
        debug: {
          inputProsody: inputProsody.map(l => ({
            text: l.text,
            syllables: l.syllables,
            rhymeSound: l.rhymeSound
          })),
          retrievedFragments: fragments.slice(0, 5).map(f => ({
            id: f.id,
            score: f.retrievalScore,
            content: f.content.substring(0, 60) + '...'
          }))
        }
      })
    };

  } catch (error) {
    console.error('Generation pipeline error:', error);

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    };
  }
};

// ============================================
// TESTING (commented out)
// ============================================
/*
To test this endpoint locally with curl:

curl -X POST http://localhost:8888/.netlify/functions/generate \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Walking through the city at night\nStreetlights guide my way\nMemories of you still burning bright\nWishing you would stay",
    "settings": {
      "religiosity": "ish",
      "rhythm": "yes",
      "rhyming": "ish",
      "meaning": "yes",
      "theme": "urban nostalgia"
    },
    "iteration": 1
  }'

Expected response:
{
  "success": true,
  "sessionId": "sess-...",
  "projectId": "proj-...",
  "verses": [
    {
      "verse": "...",
      "fragmentsUsed": [1, 3, 7],
      "explanation": "...",
      "rating": null
    },
    ...9 more...
  ],
  "metadata": {
    "generationTime": "2500ms",
    "fragmentCount": 18,
    "styleRefCount": 2,
    "iteration": 1
  },
  "debug": {
    "inputProsody": [...],
    "retrievedFragments": [...]
  }
}

For iteration 2 with feedback:

curl -X POST http://localhost:8888/.netlify/functions/generate \
  -H "Content-Type: application/json" \
  -d '{
    "input": "...",
    "settings": {...},
    "iteration": 2,
    "sessionId": "sess-...",
    "feedback": {
      "best": [
        {"verse_text": "Best verse 1...", "explanation": "Why it worked"},
        {"verse_text": "Best verse 2...", "explanation": "Why it worked"}
      ],
      "notTheVibe": [
        {"verse_text": "Bad verse 1...", "explanation": "Why it failed"}
      ]
    }
  }'
*/
