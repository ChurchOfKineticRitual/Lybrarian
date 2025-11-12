/**
 * Prosodic Analyzer for Lybrarian
 * Analyzes input text for syllables, stress patterns, and rhyme sounds
 * Mirrors the Python import_fragments.py prosodic analysis
 */

const { syllable } = require('syllable');
const cmudict = require('cmu-pronouncing-dictionary');

/**
 * Clean a word for phonetic analysis, handling contractions and acronyms
 */
function cleanWordForPhonetics(word) {
  word = word.toLowerCase().trim();

  // Handle common contractions
  const contractions = {
    "don't": "dont",
    "won't": "wont",
    "can't": "cant",
    "isn't": "isnt",
    "aren't": "arent",
    "wasn't": "wasnt",
    "weren't": "werent",
    "haven't": "havent",
    "hasn't": "hasnt",
    "hadn't": "hadnt",
    "wouldn't": "wouldnt",
    "couldn't": "couldnt",
    "shouldn't": "shouldnt",
    "mustn't": "mustnt",
    "it's": "its",
    "that's": "thats",
    "there's": "theres",
    "here's": "heres",
    "what's": "whats",
    "where's": "wheres",
    "who's": "whos",
    "i'm": "im",
    "you're": "youre",
    "we're": "were",
    "they're": "theyre",
    "i've": "ive",
    "you've": "youve",
    "we've": "weve",
    "they've": "theyve",
    "i'll": "ill",
    "you'll": "youll",
    "we'll": "well",
    "they'll": "theyll",
    "i'd": "id",
    "you'd": "youd",
    "we'd": "wed",
    "they'd": "theyd"
  };

  // Handle common acronyms
  const acronyms = {
    "dms": "deems",
    "dm": "deem",
    "ai": "ayeye",
    "ui": "youeye",
    "api": "aypeeye"
  };

  if (contractions[word]) {
    return contractions[word];
  }

  if (acronyms[word]) {
    return acronyms[word];
  }

  // Remove punctuation but preserve letters
  return word.replace(/[^a-z]/g, '');
}

/**
 * Get syllable count for a line of text
 */
function getSyllableCount(text) {
  if (!text || !text.trim()) {
    return 0;
  }

  // Use syllable package
  const count = syllable(text);
  return count;
}

/**
 * Get binary stress pattern using CMUdict
 * Returns a string like "10101010" where 1=stressed, 0=unstressed
 */
function getStressPattern(text) {
  const words = text.toLowerCase().split(/\s+/);
  let pattern = "";

  for (let word of words) {
    // Clean word
    word = cleanWordForPhonetics(word);
    if (!word) continue;

    // Look up in CMUdict
    const phones = cmudict[word];
    if (phones) {
      // CMUdict format: "HH AH0 L OW1" -> extract stress markers
      const phoneList = phones.split(' ');
      for (let phone of phoneList) {
        // Check if last character is a digit (stress marker for vowels)
        const lastChar = phone.slice(-1);
        if (lastChar >= '0' && lastChar <= '2') {
          // 0=no stress, 1=primary stress, 2=secondary stress
          if (lastChar === '1') {
            pattern += "1";
          } else {
            pattern += "0";
          }
        }
      }
    } else {
      // Fallback: estimate based on syllables
      const syllCount = syllable(word);
      if (syllCount <= 2) {
        // Simple heuristic: first syllable stressed for short words
        pattern += "1" + "0".repeat(Math.max(0, syllCount - 1));
      } else {
        // For longer words, alternate stress
        for (let i = 0; i < syllCount; i++) {
          pattern += (i % 2 === 0) ? "1" : "0";
        }
      }
    }
  }

  return pattern;
}

/**
 * Get rhyme sound (phonetic representation) for the last word
 * Returns the "rhyming part" of the word - from the last stressed vowel to the end
 */
function getRhymeSound(text) {
  const words = text.toLowerCase().split(/\s+/);
  if (words.length === 0) {
    return null;
  }

  // Clean the last word
  let lastWord = cleanWordForPhonetics(words[words.length - 1]);
  if (!lastWord) {
    return null;
  }

  // Look up in CMUdict
  const phones = cmudict[lastWord];
  if (!phones) {
    // Fallback: return the last 2-3 characters as a simple rhyme
    return lastWord.slice(-3);
  }

  // Extract rhyming part: from last stressed vowel (1) to end
  const phoneList = phones.split(' ');

  // Find the last primary stress
  let lastStressIndex = -1;
  for (let i = phoneList.length - 1; i >= 0; i--) {
    if (phoneList[i].endsWith('1')) {
      lastStressIndex = i;
      break;
    }
  }

  // If no primary stress found, use last secondary stress (2)
  if (lastStressIndex === -1) {
    for (let i = phoneList.length - 1; i >= 0; i--) {
      if (phoneList[i].endsWith('2')) {
        lastStressIndex = i;
        break;
      }
    }
  }

  // If still no stress found, use the whole word
  if (lastStressIndex === -1) {
    return phones;
  }

  // Return everything from last stress to end
  return phoneList.slice(lastStressIndex).join(' ');
}

/**
 * Analyze a single line for prosodic features
 */
function analyzeLine(text) {
  if (!text || !text.trim()) {
    return {
      syllables: 0,
      stressPattern: null,
      rhymeSound: null
    };
  }

  return {
    syllables: getSyllableCount(text),
    stressPattern: getStressPattern(text),
    rhymeSound: getRhymeSound(text)
  };
}

/**
 * Analyze multiple lines (verse input)
 * Returns array of line analyses
 */
function analyzeVerse(text) {
  const lines = text.split('\n').filter(line => line.trim());
  return lines.map(line => ({
    text: line.trim(),
    ...analyzeLine(line)
  }));
}

module.exports = {
  cleanWordForPhonetics,
  getSyllableCount,
  getStressPattern,
  getRhymeSound,
  analyzeLine,
  analyzeVerse
};
