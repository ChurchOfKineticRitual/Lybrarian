/**
 * Prompt Builder for Lybrarian
 * Constructs prompts for Claude API with fragments, settings, and iteration feedback
 */

/**
 * Format settings for natural language prompt
 */
function formatSettingsInstructions(settings) {
  const { religiosity, rhythm, rhyming, meaning, theme, steer } = settings;

  let instructions = [];

  // Religiosity (fragment adherence)
  if (religiosity === 'yes') {
    instructions.push('**Fragment adherence: STRICT** - Stay very close to the provided fragments. Use their exact phrases, imagery, and language patterns.');
  } else if (religiosity === 'ish') {
    instructions.push('**Fragment adherence: MODERATE** - Draw inspiration from the fragments but feel free to adapt and rework them creatively.');
  } else {
    instructions.push('**Fragment adherence: LOOSE** - Treat fragments as loose inspiration. Prioritize originality and creative freedom.');
  }

  // Rhythm (prosodic matching)
  if (rhythm === 'yes') {
    instructions.push('**Rhythm: STRICT** - Match the syllable count per line EXACTLY. Maintain consistent stress patterns.');
  } else if (rhythm === 'ish') {
    instructions.push('**Rhythm: FLEXIBLE** - Approximate the syllable count (±2 syllables per line is acceptable). Maintain a similar flow.');
  } else {
    instructions.push('**Rhythm: NONE** - No syllable count requirement. Focus on natural speech patterns.');
  }

  // Rhyming
  if (rhyming === 'yes') {
    instructions.push('**Rhyming: REQUIRED** - Create perfect rhymes matching the input rhyme scheme exactly.');
  } else if (rhyming === 'ish') {
    instructions.push('**Rhyming: FLEXIBLE** - Use slant rhymes, assonance, or consonance. Near-rhymes are acceptable.');
  } else {
    instructions.push('**Rhyming: NONE** - No rhyme requirement. Prioritize meaning and flow.');
  }

  // Meaning (input interpretation)
  if (meaning === 'yes') {
    instructions.push('**Meaning: PRESERVE** - Stay very close to the input verse\'s meaning, themes, and emotional tone.');
  } else if (meaning === 'ish') {
    instructions.push('**Meaning: FLEXIBLE** - Keep the general vibe but feel free to explore variations in meaning and perspective.');
  } else {
    instructions.push('**Meaning: REIMAGINE** - Use the input as a structural template only. Create entirely new meanings.');
  }

  // Theme (if provided)
  if (theme && theme !== 'none') {
    instructions.push(`**Theme to explore:** ${theme}`);
  }

  // Steer text (additional creative direction)
  if (steer && steer.trim()) {
    instructions.push(`**Additional direction:** ${steer}`);
  }

  return instructions.join('\n\n');
}

/**
 * Format retrieved fragments for prompt
 */
function formatFragments(fragments) {
  if (!fragments || fragments.length === 0) {
    return 'No fragments retrieved for this input.';
  }

  const formatted = fragments.slice(0, 15).map((fragment, index) => {
    const tags = fragment.tags && fragment.tags.length > 0
      ? ` [Tags: ${fragment.tags.join(', ')}]`
      : '';

    return `${index + 1}. ${fragment.content.trim()}${tags}`;
  }).join('\n\n');

  return `Here are lyric fragments from your personal library that semantically and prosodically match your input:\n\n${formatted}`;
}

/**
 * Format style references (completed lyrics)
 */
function formatStyleReferences(styleReferences) {
  if (!styleReferences || styleReferences.length === 0) {
    return '';
  }

  const formatted = styleReferences.map((ref, index) => {
    return `### ${ref.title}\n${ref.content.trim()}`;
  }).join('\n\n---\n\n');

  return `\n\nHere are examples of your completed lyrics for style reference:\n\n${formatted}`;
}

/**
 * Format previous ratings for iteration 2+
 */
function formatIterationFeedback(previousRatings) {
  if (!previousRatings || previousRatings.length === 0) {
    return '';
  }

  const bestVarses = previousRatings.filter(r => r.rating === 'best');
  const notTheVibeVerses = previousRatings.filter(r => r.rating === 'not_the_vibe');

  let feedback = '\n\n---\n\n## ITERATION FEEDBACK - Learn from Previous Generation\n\n';

  if (bestVarses.length > 0) {
    feedback += '### ✓ User marked these as "Best" (more like this!):\n\n';
    bestVarses.forEach((verse, index) => {
      feedback += `${index + 1}. ${verse.verse}\n\n`;
    });
  }

  if (notTheVibeVerses.length > 0) {
    feedback += '\n### ✗ User marked these as "Not the vibe" (avoid this direction):\n\n';
    notTheVibeVerses.forEach((verse, index) => {
      feedback += `${index + 1}. ${verse.verse}\n\n`;
    });
  }

  feedback += '\n**Reflection:** What patterns do you notice in the "Best" verses that distinguish them from "Not the vibe"? Apply those insights to this generation.\n\n---\n\n';

  return feedback;
}

/**
 * Build system prompt for Claude
 */
function buildSystemPrompt() {
  return `You are a creative lyric writing assistant helping a songwriter generate verse variations. Your role is to:

1. Draw from the user's personal fragment library
2. Match the prosodic structure (syllables, rhythm, rhyme) when required
3. Generate 10 diverse variations that explore different angles
4. Respect the user's creative settings (religiosity, rhythm, rhyming, meaning)
5. Learn from iteration feedback to improve output quality

Key principles:
- Generate exactly 10 verse variations
- Each variation should be creative and distinct
- Format each verse clearly (preserve line breaks)
- Number each variation (1-10)
- Be concise - output ONLY the numbered verses, no additional commentary`;
}

/**
 * Build user prompt for generation
 */
function buildUserPrompt(inputText, settings, fragments, styleReferences, previousRatings = null) {
  const isIteration = previousRatings && previousRatings.length > 0;

  let prompt = '';

  // Input verse
  prompt += '## Input Verse\n\n';
  prompt += `${inputText.trim()}\n\n`;

  // Settings instructions
  prompt += '## Creative Settings\n\n';
  prompt += formatSettingsInstructions(settings);
  prompt += '\n\n';

  // Retrieved fragments
  prompt += '## Your Fragment Library\n\n';
  prompt += formatFragments(fragments);
  prompt += '\n\n';

  // Style references
  if (styleReferences && styleReferences.length > 0) {
    prompt += formatStyleReferences(styleReferences);
    prompt += '\n\n';
  }

  // Iteration feedback (if iteration 2+)
  if (isIteration) {
    prompt += formatIterationFeedback(previousRatings);
  }

  // Final instruction
  prompt += '---\n\n';
  prompt += '## Task\n\n';
  prompt += 'Generate 10 verse variations based on the input, settings, and fragments above.';

  if (isIteration) {
    prompt += ' Incorporate the feedback from the previous iteration to improve quality.';
  }

  prompt += '\n\n**Format:** Number each variation (1-10) and preserve line breaks within each verse.';

  return prompt;
}

/**
 * Main function - build complete prompt for Claude API
 */
function buildPrompt(inputText, settings, fragments, styleReferences, previousRatings = null) {
  return {
    system: buildSystemPrompt(),
    messages: [
      {
        role: 'user',
        content: buildUserPrompt(inputText, settings, fragments, styleReferences, previousRatings)
      }
    ]
  };
}

/**
 * Parse Claude's response into individual verses
 * Expects format: "1. [verse]\n\n2. [verse]..." etc.
 */
function parseGeneratedVerses(responseText) {
  // Split by numbered patterns (1., 2., etc.)
  const verses = [];
  const lines = responseText.split('\n');

  let currentVerse = null;
  let currentVerseLines = [];

  for (const line of lines) {
    // Check if line starts with a number (1., 2., etc.)
    const match = line.match(/^(\d+)\.\s*(.*)$/);

    if (match) {
      // Save previous verse if exists
      if (currentVerse !== null && currentVerseLines.length > 0) {
        verses.push({
          number: currentVerse,
          text: currentVerseLines.join('\n').trim()
        });
      }

      // Start new verse
      currentVerse = parseInt(match[1]);
      currentVerseLines = match[2] ? [match[2]] : [];
    } else if (currentVerse !== null && line.trim()) {
      // Add line to current verse
      currentVerseLines.push(line);
    }
  }

  // Save last verse
  if (currentVerse !== null && currentVerseLines.length > 0) {
    verses.push({
      number: currentVerse,
      text: currentVerseLines.join('\n').trim()
    });
  }

  return verses;
}

module.exports = {
  buildPrompt,
  parseGeneratedVerses,
  formatSettingsInstructions,
  formatFragments
};
