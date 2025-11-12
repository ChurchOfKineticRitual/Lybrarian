/**
 * Prompt Builder for Lyric Generation
 *
 * Constructs prompts for Claude API to generate verse variations.
 * Combines input verse, settings, retrieved fragments, and style references.
 */

/**
 * Build core system prompt with instructions for Claude
 * @returns {string} System prompt explaining the task
 */
function buildSystemPrompt() {
  return `You are an expert lyric writing assistant helping a songwriter generate verse variations. Your task is to create exactly 10 unique verse variations based on:
1. The input verse provided by the user
2. The creative settings and constraints specified
3. A library of lyric fragments to draw inspiration from
4. Style references from the user's completed songs

Your goal is to generate variations that feel authentic to the user's voice while exploring creative possibilities within the given constraints.

CRITICAL OUTPUT FORMAT:
You must respond with valid JSON only. No additional text, explanations, or markdown formatting outside the JSON structure.

Return a JSON array of exactly 10 verse objects with this structure:
[
  {
    "verse": "The verse text here\\nCan span multiple lines\\nUse \\\\n for line breaks",
    "fragmentsUsed": [1, 3, 7],
    "explanation": "Brief note on the creative approach taken"
  }
]

IMPORTANT RULES:
- Generate exactly 10 variations, no more, no less
- Each verse should be distinct and explore different creative angles
- Reference fragments by their numbers when you use them
- Respect the prosodic constraints (syllable counts, rhyme schemes) as specified
- Match the style and tone evident in the user's completed songs
- Be creative within constraints - don't just rearrange the same words
- Return ONLY the JSON array, nothing else`;
}

/**
 * Convert settings object to natural language constraints
 * @param {Object} settings - Generation settings
 * @param {string} settings.religiosity - Fragment adherence: "no" | "ish" | "yes"
 * @param {string} settings.rhythm - Prosodic matching: "no" | "ish" | "yes"
 * @param {string} settings.rhyming - Rhyme requirement: "no" | "ish" | "yes"
 * @param {string} settings.meaning - Semantic interpretation: "no" | "ish" | "yes"
 * @param {string} settings.theme - Optional thematic keyword
 * @param {string} settings.steer - Optional creative direction
 * @returns {string} Human-readable constraints description
 */
function formatSettings(settings) {
  if (!settings) {
    throw new Error('Settings object is required');
  }

  // Default to "ish" if not specified
  const religiosity = (settings.religiosity || 'ish').toLowerCase();
  const rhythm = (settings.rhythm || 'yes').toLowerCase();
  const rhyming = (settings.rhyming || 'ish').toLowerCase();
  const meaning = (settings.meaning || 'yes').toLowerCase();

  const lines = ['CREATIVE CONSTRAINTS:\n'];

  // Fragment Adherence (Religiosity)
  lines.push('**Fragment Adherence:**');
  if (religiosity === 'no') {
    lines.push('- Generate freely. Fragments are optional inspiration only. Feel free to create original content.');
  } else if (religiosity === 'ish') {
    lines.push('- Draw inspiration from fragments but paraphrase and adapt them. Mix fragment ideas with original content.');
  } else {
    lines.push('- Use exact phrases and lines from fragments. Stay close to fragment wording.');
  }

  // Prosodic Matching (Rhythm)
  lines.push('\n**Rhythm & Syllable Matching:**');
  if (rhythm === 'no') {
    lines.push('- Approximate length only. Syllable counts don\'t need to match.');
  } else if (rhythm === 'ish') {
    lines.push('- Similar syllable count to input (±2 syllables per line is acceptable).');
  } else {
    lines.push('- Exact syllable match per line. Count carefully and match the input precisely.');
  }

  // Rhyme Requirements
  lines.push('\n**Rhyming:**');
  if (rhyming === 'no') {
    lines.push('- Rhyming is optional. Focus on meaning and flow over rhyme.');
  } else if (rhyming === 'ish') {
    lines.push('- Slant rhymes and near-rhymes are acceptable. Aim for sonic cohesion.');
  } else {
    lines.push('- Perfect rhyme match. Ensure end rhymes match the input verse\'s rhyme scheme precisely.');
  }

  // Semantic Interpretation (Meaning)
  lines.push('\n**Meaning & Interpretation:**');
  if (meaning === 'no') {
    lines.push('- Reinterpret freely. You can change the topic or theme entirely.');
  } else if (meaning === 'ish') {
    lines.push('- Keep the general theme but explore variations. Stay in the same emotional territory.');
  } else {
    lines.push('- Stay close to the input\'s meaning and imagery. Preserve the core message.');
  }

  // Optional theme
  if (settings.theme) {
    lines.push(`\n**Theme Focus:** ${settings.theme}`);
  }

  // Optional steering direction
  if (settings.steer) {
    lines.push(`\n**Creative Direction:** ${settings.steer}`);
  }

  return lines.join('\n');
}

/**
 * Format fragment library for the prompt
 * @param {Array} fragments - Retrieved fragments from database
 * @returns {string} Formatted fragment library
 */
function formatFragments(fragments) {
  if (!fragments || fragments.length === 0) {
    return 'FRAGMENT LIBRARY:\n(No fragments retrieved - generate original content)';
  }

  const lines = [`FRAGMENT LIBRARY (${fragments.length} fragments):\n`];
  lines.push('Draw inspiration from these fragments based on the Fragment Adherence setting above.\n');

  fragments.forEach((fragment, index) => {
    const fragmentNum = index + 1;

    // Fragment header with tags
    const tags = fragment.tags ? fragment.tags.join(', ') : 'untagged';
    lines.push(`Fragment ${fragmentNum} [${tags}]:`);

    // Fragment content (handle both single string and lines array)
    const content = Array.isArray(fragment.lines)
      ? fragment.lines.map(l => l.line_text).join('\n')
      : fragment.content || fragment.fragment_text || 'No content';

    lines.push(`"${content}"`);

    // Add prosodic information if available
    if (fragment.lines && Array.isArray(fragment.lines)) {
      const syllableCounts = fragment.lines.map(l => l.syllables).join(', ');
      lines.push(`(Syllables per line: ${syllableCounts})`);

      if (fragment.rhythmic && fragment.lines[0].stress_pattern) {
        const stressPatterns = fragment.lines
          .map(l => l.stress_pattern)
          .filter(p => p)
          .join(', ');
        if (stressPatterns) {
          lines.push(`(Stress patterns: ${stressPatterns})`);
        }
      }
    } else if (fragment.syllables) {
      lines.push(`(${fragment.syllables} syllables)`);
    }

    lines.push(''); // Blank line between fragments
  });

  return lines.join('\n');
}

/**
 * Format completed lyrics as style references
 * @param {Array} completedLyrics - 2-3 completed songs from database
 * @returns {string} Formatted style references
 */
function formatStyleReferences(completedLyrics) {
  if (!completedLyrics || completedLyrics.length === 0) {
    return 'STYLE REFERENCES:\n(No completed songs available - use general songwriting best practices)';
  }

  const lines = [`STYLE REFERENCES (${completedLyrics.length} songs):\n`];
  lines.push('Match the style, tone, and voice evident in these completed songs:\n');

  completedLyrics.forEach((song, index) => {
    const songNum = index + 1;

    // Song title if available
    if (song.title) {
      lines.push(`Song ${songNum}: "${song.title}"`);
    } else {
      lines.push(`Song ${songNum}:`);
    }

    // Full lyrics content
    const lyrics = song.full_text || song.content || 'No content';
    lines.push('---');
    lines.push(lyrics);
    lines.push('---\n');
  });

  return lines.join('\n');
}

/**
 * Format iteration feedback from previous ratings
 * @param {Object} feedback - Previous iteration feedback
 * @param {Array} feedback.best - Verses rated "Best"
 * @param {Array} feedback.notTheVibe - Verses rated "Not the vibe"
 * @returns {string} Formatted feedback section
 */
function formatFeedback(feedback) {
  if (!feedback || (!feedback.best && !feedback.notTheVibe)) {
    return '';
  }

  const lines = ['\n\nITERATION FEEDBACK:\n'];
  lines.push('Learn from the user\'s previous ratings to improve this iteration:\n');

  // Best-rated verses (what worked)
  if (feedback.best && feedback.best.length > 0) {
    lines.push('✓ VERSES RATED "BEST" (Generate more like these):');
    feedback.best.forEach((verse, index) => {
      lines.push(`\nBest #${index + 1}:`);
      lines.push(`"${verse.verse_text}"`);
      if (verse.explanation) {
        lines.push(`(Approach: ${verse.explanation})`);
      }
    });
    lines.push('');
  }

  // Not-the-vibe verses (what didn't work)
  if (feedback.notTheVibe && feedback.notTheVibe.length > 0) {
    lines.push('✗ VERSES RATED "NOT THE VIBE" (Avoid these approaches):');
    feedback.notTheVibe.forEach((verse, index) => {
      lines.push(`\nNot the vibe #${index + 1}:`);
      lines.push(`"${verse.verse_text}"`);
      if (verse.explanation) {
        lines.push(`(Approach to avoid: ${verse.explanation})`);
      }
    });
    lines.push('');
  }

  lines.push('Based on this feedback, adjust your approach to generate verses that match the "Best" examples and avoid the "Not the vibe" patterns.');

  return lines.join('\n');
}

/**
 * Build complete generation prompt combining all components
 * @param {string} input - Input verse from user
 * @param {Object} settings - Generation settings
 * @param {Array} fragments - Retrieved fragments (15-20)
 * @param {Array} styleRefs - Completed lyrics for style (2-3)
 * @param {number} iteration - Iteration number (default 1)
 * @param {Object} feedback - Feedback from previous iteration (optional)
 * @returns {Object} { systemPrompt, userPrompt }
 */
function buildGenerationPrompt(input, settings, fragments, styleRefs, iteration = 1, feedback = null) {
  // Validation
  if (!input || typeof input !== 'string' || input.trim().length === 0) {
    throw new Error('Input verse is required and must be a non-empty string');
  }

  if (!settings || typeof settings !== 'object') {
    throw new Error('Settings object is required');
  }

  // Build system prompt (always the same)
  const systemPrompt = buildSystemPrompt();

  // Build user prompt sections
  const userPromptSections = [];

  // Iteration context
  if (iteration > 1) {
    userPromptSections.push(`ITERATION ${iteration}:`);
    userPromptSections.push('This is a follow-up iteration. Use the feedback below to improve your output.\n');
  } else {
    userPromptSections.push('ITERATION 1:\n');
  }

  // Input verse
  userPromptSections.push('INPUT VERSE:');
  userPromptSections.push('Generate 10 variations of this verse:\n');
  userPromptSections.push('---');
  userPromptSections.push(input.trim());
  userPromptSections.push('---\n');

  // Settings and constraints
  userPromptSections.push(formatSettings(settings));
  userPromptSections.push('');

  // Fragment library
  userPromptSections.push(formatFragments(fragments));
  userPromptSections.push('');

  // Style references
  userPromptSections.push(formatStyleReferences(styleRefs));

  // Iteration feedback (if applicable)
  if (iteration > 1 && feedback) {
    userPromptSections.push(formatFeedback(feedback));
  }

  // Final instructions
  userPromptSections.push('\n\nNow generate exactly 10 verse variations following all the constraints above.');
  userPromptSections.push('Remember to return ONLY the JSON array, nothing else.');

  const userPrompt = userPromptSections.join('\n');

  return {
    systemPrompt,
    userPrompt
  };
}

// Export functions
module.exports = {
  buildSystemPrompt,
  formatSettings,
  formatFragments,
  formatStyleReferences,
  formatFeedback,
  buildGenerationPrompt
};
