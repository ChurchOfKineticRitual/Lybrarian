/**
 * Lybrarian API Client
 *
 * Provides functions for the React frontend to communicate with backend Netlify Functions.
 * Handles verse generation, ratings, keepers, and session management.
 *
 * @module api/client
 */

// ============================================================================
// Configuration
// ============================================================================

/**
 * API base URL - empty string for same-origin requests
 * Can be overridden via REACT_APP_API_URL environment variable
 */
const API_BASE = process.env.REACT_APP_API_URL || '';

/**
 * Default timeout for API requests (30 seconds)
 * Generation can take 6-8 seconds, so we allow ample time
 */
const API_TIMEOUT = 30000;

/**
 * Default headers for all API requests
 */
const defaultHeaders = {
  'Content-Type': 'application/json'
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Fetch with timeout and abort support
 *
 * @param {string} url - The URL to fetch
 * @param {Object} options - Fetch options
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Object>} Parsed JSON response
 * @throws {Error} On timeout, network error, or non-OK response
 */
async function fetchWithTimeout(url, options, timeout = API_TIMEOUT) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });

    clearTimeout(id);

    // Handle non-OK responses
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw {
        status: response.status,
        statusText: response.statusText,
        body: errorBody
      };
    }

    return await response.json();
  } catch (error) {
    clearTimeout(id);

    // Handle abort (timeout)
    if (error.name === 'AbortError') {
      throw {
        success: false,
        error: 'Request timed out',
        code: 'TIMEOUT',
        details: { timeout, url }
      };
    }

    // Handle network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw {
        success: false,
        error: 'Network error - please check your connection',
        code: 'NETWORK_ERROR',
        details: { originalError: error.message }
      };
    }

    // Handle API errors (from non-OK responses)
    if (error.status) {
      throw {
        success: false,
        error: error.body?.error || error.body?.message || 'API request failed',
        code: `HTTP_${error.status}`,
        details: {
          status: error.status,
          statusText: error.statusText,
          body: error.body
        }
      };
    }

    // Re-throw other errors
    throw error;
  }
}

/**
 * Validate settings object
 *
 * @param {Object} settings - Settings to validate
 * @throws {Error} If settings are invalid
 */
function validateSettings(settings) {
  if (!settings || typeof settings !== 'object') {
    throw new Error('Settings must be an object');
  }

  const validValues = ['no', 'ish', 'yes'];
  const requiredFields = ['religiosity', 'rhythm', 'rhyming', 'meaning'];

  for (const field of requiredFields) {
    if (!settings[field]) {
      throw new Error(`Setting '${field}' is required`);
    }
    if (!validValues.includes(settings[field])) {
      throw new Error(`Setting '${field}' must be one of: ${validValues.join(', ')}`);
    }
  }

  // Optional fields: theme, steer (no validation needed)
}

/**
 * Validate iteration and feedback
 *
 * @param {number} iteration - Iteration number
 * @param {Object|null} feedback - Feedback object
 * @throws {Error} If iteration/feedback is invalid
 */
function validateIteration(iteration, feedback) {
  if (typeof iteration !== 'number' || iteration < 1) {
    throw new Error('Iteration must be a number >= 1');
  }

  if (iteration > 1 && !feedback) {
    throw new Error('Feedback is required for iteration 2 and beyond');
  }

  if (feedback) {
    if (!feedback.best || !Array.isArray(feedback.best)) {
      throw new Error('Feedback must include "best" array');
    }
    if (!feedback.notTheVibe || !Array.isArray(feedback.notTheVibe)) {
      throw new Error('Feedback must include "notTheVibe" array');
    }
  }
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Generate verse variations using Claude AI
 *
 * Calls the main generation endpoint to produce 10 verse variations based on
 * input verse, settings, and optional feedback from previous iterations.
 *
 * @param {string} input - The input verse text (can be multi-line)
 * @param {Object} settings - Generation settings
 * @param {string} settings.religiosity - Fragment adherence: "no" | "ish" | "yes"
 * @param {string} settings.rhythm - Prosodic matching: "no" | "ish" | "yes"
 * @param {string} settings.rhyming - Rhyme requirement: "no" | "ish" | "yes"
 * @param {string} settings.meaning - Semantic interpretation: "no" | "ish" | "yes"
 * @param {string} [settings.theme] - Optional thematic keyword (e.g., "urban nostalgia")
 * @param {string} [settings.steer] - Optional creative direction (e.g., "more introspective")
 * @param {number} [iteration=1] - Iteration number (1 for first generation)
 * @param {Object|null} [feedback=null] - Feedback from previous iteration (required if iteration > 1)
 * @param {Array} [feedback.best] - Array of best-rated verses with explanations
 * @param {Array} [feedback.notTheVibe] - Array of rejected verses with explanations
 * @param {string|null} [projectId=null] - Optional project ID
 * @returns {Promise<Object>} Generation result with sessionId, verses, and metadata
 *
 * @example
 * // First iteration
 * const result = await generateVerses(
 *   "Walking through the city at night\nStreetlights guide my way",
 *   {
 *     religiosity: "ish",
 *     rhythm: "yes",
 *     rhyming: "ish",
 *     meaning: "yes",
 *     theme: "urban nostalgia"
 *   }
 * );
 *
 * @example
 * // Second iteration with feedback
 * const result = await generateVerses(
 *   "Walking through the city at night\nStreetlights guide my way",
 *   { religiosity: "ish", rhythm: "yes", rhyming: "ish", meaning: "yes" },
 *   2,
 *   {
 *     best: [
 *       {
 *         verse_text: "Dancing through the district by moonlight...",
 *         explanation: "Great urban imagery"
 *       }
 *     ],
 *     notTheVibe: [
 *       {
 *         verse_text: "Running in the town when dark...",
 *         explanation: "Too simple"
 *       }
 *     ]
 *   }
 * );
 */
export async function generateVerses(input, settings, iteration = 1, feedback = null, projectId = null) {
  try {
    // Validate input
    if (!input || typeof input !== 'string' || input.trim().length === 0) {
      throw new Error('Input verse is required and must be a non-empty string');
    }

    // Validate settings
    validateSettings(settings);

    // Validate iteration and feedback
    validateIteration(iteration, feedback);

    // Build request body
    const body = {
      input: input.trim(),
      settings,
      iteration
    };

    if (projectId) {
      body.projectId = projectId;
    }

    if (feedback) {
      body.feedback = feedback;
    }

    // Make API request
    const result = await fetchWithTimeout(
      `${API_BASE}/.netlify/functions/generate`,
      {
        method: 'POST',
        headers: defaultHeaders,
        body: JSON.stringify(body)
      }
    );

    // Validate response structure
    if (!result.sessionId || !result.verses || !Array.isArray(result.verses)) {
      throw {
        success: false,
        error: 'Invalid response format from server',
        code: 'INVALID_RESPONSE',
        details: { result }
      };
    }

    return {
      success: true,
      sessionId: result.sessionId,
      projectId: result.projectId,
      verses: result.verses,
      metadata: result.metadata || {},
      debug: result.debug || {}
    };

  } catch (error) {
    // If error is already formatted, return it
    if (error.success === false) {
      return error;
    }

    // Format unexpected errors
    return {
      success: false,
      error: error.message || 'An unexpected error occurred',
      code: 'UNKNOWN_ERROR',
      details: { originalError: error }
    };
  }
}

/**
 * Update rating for a generated verse
 *
 * Updates the rating of a specific verse in a generation session.
 * Used to collect user feedback for iteration improvements.
 *
 * Note: This endpoint is not yet implemented (Phase 3), but the client
 * function is ready for when it is.
 *
 * @param {string} sessionId - Session UUID
 * @param {string} verseId - Verse UUID
 * @param {string} rating - Rating value: "best" | "fine" | "not_the_vibe"
 * @returns {Promise<Object>} Result object with success flag
 *
 * @example
 * const result = await updateRating(
 *   "sess-abc123",
 *   "verse-xyz789",
 *   "best"
 * );
 *
 * if (result.success) {
 *   console.log("Rating updated successfully");
 * }
 */
export async function updateRating(sessionId, verseId, rating) {
  try {
    // Validate input
    if (!sessionId || typeof sessionId !== 'string') {
      throw new Error('sessionId is required and must be a string');
    }

    if (!verseId || typeof verseId !== 'string') {
      throw new Error('verseId is required and must be a string');
    }

    const validRatings = ['best', 'fine', 'not_the_vibe'];
    if (!validRatings.includes(rating)) {
      throw new Error(`rating must be one of: ${validRatings.join(', ')}`);
    }

    // Build request body
    const body = {
      sessionId,
      verseId,
      rating
    };

    // Make API request
    const result = await fetchWithTimeout(
      `${API_BASE}/.netlify/functions/update-rating`,
      {
        method: 'POST',
        headers: defaultHeaders,
        body: JSON.stringify(body)
      }
    );

    return {
      success: true,
      ...result
    };

  } catch (error) {
    // If error is already formatted, return it
    if (error.success === false) {
      return error;
    }

    // Format unexpected errors
    return {
      success: false,
      error: error.message || 'Failed to update rating',
      code: 'UPDATE_RATING_ERROR',
      details: { originalError: error }
    };
  }
}

/**
 * Add verse to workspace as keeper
 *
 * Saves a generated verse to the user's workspace for later use.
 * Verses marked as keepers can be exported to completed songs.
 *
 * Note: This endpoint is not yet implemented (Phase 4), but the client
 * function is ready for when it is.
 *
 * @param {string} verseId - Verse UUID to save
 * @param {string|null} [projectId=null] - Optional project ID (defaults to "default" project)
 * @returns {Promise<Object>} Result object with success flag and keeperId
 *
 * @example
 * const result = await addKeeper(
 *   "verse-xyz789",
 *   "proj-abc123"
 * );
 *
 * if (result.success) {
 *   console.log("Keeper saved:", result.keeperId);
 * }
 */
export async function addKeeper(verseId, projectId = null) {
  try {
    // Validate input
    if (!verseId || typeof verseId !== 'string') {
      throw new Error('verseId is required and must be a string');
    }

    // Build request body
    const body = {
      verseId
    };

    if (projectId) {
      body.projectId = projectId;
    }

    // Make API request
    const result = await fetchWithTimeout(
      `${API_BASE}/.netlify/functions/add-keeper`,
      {
        method: 'POST',
        headers: defaultHeaders,
        body: JSON.stringify(body)
      }
    );

    return {
      success: true,
      keeperId: result.keeperId,
      ...result
    };

  } catch (error) {
    // If error is already formatted, return it
    if (error.success === false) {
      return error;
    }

    // Format unexpected errors
    return {
      success: false,
      error: error.message || 'Failed to add keeper',
      code: 'ADD_KEEPER_ERROR',
      details: { originalError: error }
    };
  }
}

/**
 * Get session data by ID
 *
 * Retrieves a previous generation session including all verses and metadata.
 * Useful for viewing history or continuing from a previous session.
 *
 * Note: This endpoint is not yet implemented, but the client function
 * is ready for when it is.
 *
 * @param {string} sessionId - Session UUID to retrieve
 * @returns {Promise<Object>} Result object with session data and verses
 *
 * @example
 * const result = await getSession("sess-abc123");
 *
 * if (result.success) {
 *   console.log("Session:", result.session);
 *   console.log("Verses:", result.verses);
 * }
 */
export async function getSession(sessionId) {
  try {
    // Validate input
    if (!sessionId || typeof sessionId !== 'string') {
      throw new Error('sessionId is required and must be a string');
    }

    // Make API request
    const result = await fetchWithTimeout(
      `${API_BASE}/.netlify/functions/session/${sessionId}`,
      {
        method: 'GET',
        headers: defaultHeaders
      }
    );

    return {
      success: true,
      session: result.session,
      verses: result.verses || [],
      ...result
    };

  } catch (error) {
    // If error is already formatted, return it
    if (error.success === false) {
      return error;
    }

    // Format unexpected errors
    return {
      success: false,
      error: error.message || 'Failed to get session',
      code: 'GET_SESSION_ERROR',
      details: { originalError: error }
    };
  }
}

/**
 * Get fragments (for browsing/searching)
 *
 * @param {object} filters - Optional filters
 * @returns {Promise<Array>} Fragment list
 */
export async function getFragments(filters = {}) {
  try {
    const queryParams = new URLSearchParams(filters).toString();
    const url = `${API_BASE}/.netlify/functions/fragments${queryParams ? `?${queryParams}` : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Get fragments error:', error);
    throw new Error('Failed to fetch fragments. Please try again.');
  }
}

/**
 * Get projects (workspaces)
 *
 * @returns {Promise<Array>} Project list
 */
export async function getProjects() {
  try {
    const response = await fetch(`${API_BASE}/.netlify/functions/projects`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Get projects error:', error);
    throw new Error('Failed to fetch projects. Please try again.');
  }
}

/**
 * Export completed song
 *
 * @param {number} projectId - Project ID to export
 * @param {object} metadata - Song metadata (title, artist, etc.)
 * @returns {Promise<object>} Export result
 */
export async function exportSong(projectId, metadata) {
  try {
    const response = await fetch(`${API_BASE}/.netlify/functions/export-song`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectId,
        metadata,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Export song error:', error);
    throw new Error('Failed to export song. Please try again.');
  }
}

// ============================================================================
// Exports
// ============================================================================

export default {
  generateVerses,
  updateRating,
  addKeeper,
  getSession,
  getFragments,
  getProjects,
  exportSong
};
