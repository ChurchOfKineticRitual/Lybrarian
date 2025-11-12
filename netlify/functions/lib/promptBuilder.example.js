/**
 * Usage Example for promptBuilder.js
 *
 * This shows how to use the prompt builder in the generation API endpoint.
 */

const { buildGenerationPrompt } = require('./promptBuilder');

// Example usage in generate.js endpoint:

async function generateVerses(input, settings, retrievedFragments, styleReferences, iteration = 1, feedback = null) {
  // 1. Build the prompt
  const { systemPrompt, userPrompt } = buildGenerationPrompt(
    input,
    settings,
    retrievedFragments,
    styleReferences,
    iteration,
    feedback
  );

  // 2. Call Claude API
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4.5-20250929',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt
        }
      ]
    })
  });

  const data = await response.json();

  // 3. Parse JSON response
  const generatedVerses = JSON.parse(data.content[0].text);

  return generatedVerses;
}

// Example with OpenRouter API (as configured in .env):

async function generateVersesWithOpenRouter(input, settings, retrievedFragments, styleReferences, iteration = 1, feedback = null) {
  // 1. Build the prompt
  const { systemPrompt, userPrompt } = buildGenerationPrompt(
    input,
    settings,
    retrievedFragments,
    styleReferences,
    iteration,
    feedback
  );

  // 2. Call OpenRouter API (unified access to Claude)
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
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userPrompt
        }
      ],
      temperature: 0.7,
      max_tokens: 4096
    })
  });

  const data = await response.json();

  // 3. Parse JSON response
  const generatedVerses = JSON.parse(data.choices[0].message.content);

  return generatedVerses;
}

// Example data structures:

const exampleInput = `I'm standing in the dark
Waiting for a spark
Something to ignite
This endless night`;

const exampleSettings = {
  religiosity: 'ish',  // Draw from fragments, adapt them
  rhythm: 'yes',       // Exact syllable match
  rhyming: 'ish',      // Slant rhymes OK
  meaning: 'yes',      // Stay close to input meaning
  theme: 'hope',       // Optional theme
  steer: 'make it more uplifting'  // Optional direction
};

const exampleFragments = [
  {
    id: 1,
    tags: ['light', 'hope'],
    lines: [
      { line_text: 'A candle in the window', syllables: 7, stress_pattern: '1010100' }
    ],
    rhythmic: true
  },
  {
    id: 2,
    tags: ['waiting', 'longing'],
    content: 'Hours turn to days',
    syllables: 5,
    rhythmic: false
  }
  // ... 15-20 total fragments
];

const exampleStyleRefs = [
  {
    title: 'My Previous Song',
    full_text: `Verse 1:
Walking through the storm
Finding my way home
Every step I take
Makes me less alone`
  }
  // ... 2-3 total songs
];

const exampleFeedback = {
  best: [
    {
      verse_text: 'Flames begin to rise\nDancing in my eyes',
      explanation: 'Good use of fire/light metaphor'
    }
  ],
  notTheVibe: [
    {
      verse_text: 'Turn on all the lights\nEverything is bright',
      explanation: 'Too literal, not poetic enough'
    }
  ]
};

// Usage:
// const verses = await generateVersesWithOpenRouter(
//   exampleInput,
//   exampleSettings,
//   exampleFragments,
//   exampleStyleRefs,
//   2,  // iteration 2
//   exampleFeedback
// );

module.exports = {
  generateVerses,
  generateVersesWithOpenRouter
};
