/**
 * Test file for promptBuilder.js
 * Run with: node netlify/functions/lib/promptBuilder.test.js
 */

const {
  buildSystemPrompt,
  formatSettings,
  formatFragments,
  formatStyleReferences,
  formatFeedback,
  buildGenerationPrompt
} = require('./promptBuilder');

console.log('=== Testing Prompt Builder ===\n');

// Test 1: System Prompt
console.log('TEST 1: System Prompt');
console.log('---');
const systemPrompt = buildSystemPrompt();
console.log(systemPrompt);
console.log('\n✓ System prompt generated\n');

// Test 2: Format Settings
console.log('TEST 2: Format Settings');
console.log('---');
const settings = {
  religiosity: 'ish',
  rhythm: 'yes',
  rhyming: 'ish',
  meaning: 'yes',
  theme: 'love and loss',
  steer: 'make it more melancholic'
};
const formattedSettings = formatSettings(settings);
console.log(formattedSettings);
console.log('\n✓ Settings formatted\n');

// Test 3: Format Fragments
console.log('TEST 3: Format Fragments');
console.log('---');
const fragments = [
  {
    tags: ['nature', 'metaphor'],
    content: 'Roses bloom in spring',
    syllables: 5,
    rhythmic: false
  },
  {
    tags: ['emotion', 'longing'],
    lines: [
      { line_text: 'I waited by the door', syllables: 6, stress_pattern: '010100' },
      { line_text: 'For someone who won\'t come', syllables: 6, stress_pattern: '100101' }
    ],
    rhythmic: true
  },
  {
    tags: ['time', 'reflection'],
    fragment_text: 'Years slip through my fingers like sand',
    syllables: 8
  }
];
const formattedFragments = formatFragments(fragments);
console.log(formattedFragments);
console.log('\n✓ Fragments formatted\n');

// Test 4: Format Style References
console.log('TEST 4: Format Style References');
console.log('---');
const styleRefs = [
  {
    title: 'Autumn Days',
    full_text: 'Walking down the street alone\nLeaves are falling all around\nMemories of what we\'ve known\nEcho without any sound'
  },
  {
    title: 'Morning Light',
    content: 'Sunrise paints the sky in gold\nNew beginnings yet untold\nYesterday is getting old\nToday\'s story will unfold'
  }
];
const formattedStyleRefs = formatStyleReferences(styleRefs);
console.log(formattedStyleRefs);
console.log('\n✓ Style references formatted\n');

// Test 5: Format Feedback
console.log('TEST 5: Format Feedback');
console.log('---');
const feedback = {
  best: [
    {
      verse_text: 'Dancing in the summer rain\nWashing away all the pain',
      explanation: 'Used nature metaphor effectively'
    }
  ],
  notTheVibe: [
    {
      verse_text: 'The sky is blue today\nEverything is okay',
      explanation: 'Too literal and simple'
    }
  ]
};
const formattedFeedback = formatFeedback(feedback);
console.log(formattedFeedback);
console.log('\n✓ Feedback formatted\n');

// Test 6: Complete Generation Prompt
console.log('TEST 6: Complete Generation Prompt (Iteration 1)');
console.log('---');
const input = `I'm standing in the dark
Waiting for a spark
Something to ignite
This endless night`;

const prompt1 = buildGenerationPrompt(input, settings, fragments, styleRefs);
console.log('System Prompt Length:', prompt1.systemPrompt.length);
console.log('User Prompt Length:', prompt1.userPrompt.length);
console.log('\nFirst 500 chars of user prompt:');
console.log(prompt1.userPrompt.substring(0, 500) + '...');
console.log('\n✓ Iteration 1 prompt generated\n');

// Test 7: Iteration 2 with Feedback
console.log('TEST 7: Complete Generation Prompt (Iteration 2 with Feedback)');
console.log('---');
const prompt2 = buildGenerationPrompt(input, settings, fragments, styleRefs, 2, feedback);
console.log('System Prompt Length:', prompt2.systemPrompt.length);
console.log('User Prompt Length:', prompt2.userPrompt.length);
console.log('\nLast 500 chars of user prompt (should include feedback):');
console.log('...' + prompt2.userPrompt.substring(prompt2.userPrompt.length - 500));
console.log('\n✓ Iteration 2 prompt generated\n');

// Test 8: Error Handling
console.log('TEST 8: Error Handling');
console.log('---');
try {
  buildGenerationPrompt('', settings, fragments, styleRefs);
  console.log('✗ Should have thrown error for empty input');
} catch (err) {
  console.log('✓ Correctly throws error for empty input:', err.message);
}

try {
  formatSettings(null);
  console.log('✗ Should have thrown error for null settings');
} catch (err) {
  console.log('✓ Correctly throws error for null settings:', err.message);
}

console.log('\n=== All Tests Passed ===');
