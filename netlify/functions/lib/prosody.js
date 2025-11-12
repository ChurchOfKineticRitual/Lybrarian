/**
 * Prosody Analysis Module for Lybrarian
 *
 * Analyzes prosodic features of lyric text:
 * - Syllable counting
 * - End word extraction
 * - Simplified rhyme sound detection
 *
 * Note: This is a simplified JS version. Full phonetic analysis (CMUdict)
 * is handled by the Python import script. This module provides basic
 * real-time analysis for the generation pipeline.
 */

const syllable = require('syllable');

/**
 * Clean a word for analysis by removing punctuation
 * @param {string} word - Raw word with possible punctuation
 * @returns {string} - Cleaned word (letters only)
 */
function cleanWord(word) {
  if (!word || typeof word !== 'string') {
    return '';
  }

  // Remove all non-alphabetic characters
  return word.replace(/[^a-zA-Z]/g, '').toLowerCase();
}

/**
 * Count syllables in text
 * @param {string} text - Text to analyze
 * @returns {number} - Syllable count (minimum 1)
 */
function countSyllables(text) {
  if (!text || typeof text !== 'string') {
    return 1;
  }

  const words = text.trim().split(/\s+/);
  let total = 0;

  for (const word of words) {
    const cleaned = cleanWord(word);
    if (!cleaned) continue;

    try {
      // Use syllable package (same as Python syllables.estimate)
      const count = syllable(cleaned);
      total += count;
    } catch (error) {
      // Fallback: estimate by counting vowel groups
      const vowelGroups = cleaned.match(/[aeiouy]+/gi);
      total += vowelGroups ? vowelGroups.length : 1;
    }
  }

  return Math.max(1, total);
}

/**
 * Get simplified rhyme sound from word
 *
 * Note: This is a simplified approximation. Full phonetic analysis
 * using CMUdict is done server-side in Python. This function extracts
 * the last 2-3 letters as a basic rhyme pattern for client-side validation.
 *
 * @param {string} word - Word to analyze
 * @returns {string} - Simplified rhyme sound (e.g., "ight" from "night")
 */
function getRhymeSound(word) {
  if (!word || typeof word !== 'string') {
    return null;
  }

  const cleaned = cleanWord(word);
  if (!cleaned || cleaned.length === 0) {
    return null;
  }

  // Extract last 2-3 letters as approximate rhyme
  // Prefer 3 letters if word is long enough, otherwise 2
  if (cleaned.length >= 4) {
    return cleaned.slice(-3);
  } else if (cleaned.length >= 2) {
    return cleaned.slice(-2);
  } else {
    return cleaned;
  }
}

/**
 * Extract the last word from text
 * @param {string} text - Text to analyze
 * @returns {string|null} - Last word or null
 */
function getEndWord(text) {
  if (!text || typeof text !== 'string') {
    return null;
  }

  const words = text.trim().split(/\s+/);
  if (words.length === 0) {
    return null;
  }

  const lastWord = words[words.length - 1];
  return cleanWord(lastWord) || null;
}

/**
 * Analyze a single line of lyrics
 * @param {string} text - Line text to analyze
 * @returns {Object} - Analysis result with syllables, endWord, and rhymeSound
 */
function analyzeLine(text) {
  // Handle invalid input gracefully
  if (!text || typeof text !== 'string') {
    console.warn('[Prosody] Invalid line text provided, using defaults');
    return {
      text: '',
      syllables: 0,
      endWord: null,
      rhymeSound: null
    };
  }

  const trimmed = text.trim();

  try {
    const syllables = countSyllables(trimmed);
    const endWord = getEndWord(trimmed);
    const rhymeSound = endWord ? getRhymeSound(endWord) : null;

    return {
      text: trimmed,
      syllables,
      endWord,
      rhymeSound
    };
  } catch (error) {
    // Never throw - return safe defaults on error
    console.error('[Prosody] Error analyzing line:', error.message);
    return {
      text: trimmed,
      syllables: 1,
      endWord: null,
      rhymeSound: null
    };
  }
}

/**
 * Analyze a multi-line verse
 * @param {string} verseText - Multi-line verse text (lines separated by \n)
 * @returns {Array<Object>} - Array of line analysis objects
 */
function analyzeVerse(verseText) {
  // Handle invalid input gracefully
  if (!verseText || typeof verseText !== 'string') {
    console.warn('[Prosody] Invalid verse text provided, returning empty array');
    return [];
  }

  try {
    // Split into lines and filter out empty ones
    const lines = verseText
      .split(/\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0);

    // Analyze each line
    return lines.map(line => analyzeLine(line));
  } catch (error) {
    // Never throw - return empty array on error
    console.error('[Prosody] Error analyzing verse:', error.message);
    return [];
  }
}

/**
 * Check if two rhyme sounds match (simplified comparison)
 * @param {string} sound1 - First rhyme sound
 * @param {string} sound2 - Second rhyme sound
 * @returns {boolean} - True if sounds match
 */
function rhymesMatch(sound1, sound2) {
  if (!sound1 || !sound2) {
    return false;
  }

  return sound1.toLowerCase() === sound2.toLowerCase();
}

module.exports = {
  analyzeLine,
  analyzeVerse,
  getRhymeSound,
  countSyllables,
  getEndWord,
  rhymesMatch
};

// ============================================
// SIMPLE TEST (commented out)
// ============================================
// Uncomment to test:
/*
console.log('\n=== Prosody Analysis Test ===\n');

const testVerse = `Roses are red
Violets are blue
Sugar is sweet
And so are you`;

console.log('Input verse:');
console.log(testVerse);
console.log('\nAnalysis:');

const analysis = analyzeVerse(testVerse);
analysis.forEach((line, i) => {
  console.log(`\nLine ${i + 1}: "${line.text}"`);
  console.log(`  Syllables: ${line.syllables}`);
  console.log(`  End word: ${line.endWord}`);
  console.log(`  Rhyme sound: ${line.rhymeSound}`);
});

console.log('\n=== Single Line Test ===\n');
const singleLine = analyzeLine("Walking through the city at night");
console.log('Line:', singleLine.text);
console.log('Syllables:', singleLine.syllables);
console.log('End word:', singleLine.endWord);
console.log('Rhyme sound:', singleLine.rhymeSound);

console.log('\n=== Rhyme Matching Test ===\n');
console.log('Does "night" rhyme with "light"?', rhymesMatch(getRhymeSound('night'), getRhymeSound('light')));
console.log('Does "night" rhyme with "day"?', rhymesMatch(getRhymeSound('night'), getRhymeSound('day')));
*/
