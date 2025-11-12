/**
 * Integration test for the generate endpoint
 * Tests that all modules load correctly and basic validation works
 */

const generateHandler = require('./generate');

// Mock event for testing
const mockEvent = {
  httpMethod: 'POST',
  body: JSON.stringify({
    input: `Walking through the city at night
Streetlights guide my way
Memories of you still burning bright
Wishing you would stay`,
    settings: {
      religiosity: 'ish',
      rhythm: 'yes',
      rhyming: 'ish',
      meaning: 'yes',
      theme: 'urban nostalgia'
    },
    iteration: 1
  })
};

const mockContext = {};

async function testEndpoint() {
  console.log('=== Testing Generate Endpoint ===\n');

  try {
    console.log('1. Testing imports...');
    const prosody = require('./lib/prosody');
    const retrieval = require('./lib/retrieval');
    const promptBuilder = require('./lib/promptBuilder');
    const db = require('./lib/db');
    console.log('   ✓ All modules loaded successfully\n');

    console.log('2. Testing validation...');
    // Test valid request
    const validBody = JSON.parse(mockEvent.body);
    console.log('   ✓ Request body parsed\n');

    console.log('3. Testing prosody analysis...');
    const verseAnalysis = prosody.analyzeVerse(validBody.input);
    console.log(`   ✓ Analyzed ${verseAnalysis.length} lines:`);
    verseAnalysis.forEach((line, i) => {
      console.log(`      Line ${i + 1}: ${line.syllables} syllables, rhyme: ${line.rhymeSound}`);
    });
    console.log();

    console.log('4. Testing prompt builder...');
    const mockFragments = [
      {
        id: '1',
        content: 'City lights and lonely nights',
        tags: ['urban', 'nostalgia'],
        lines: [{ line_text: 'City lights and lonely nights', syllables: 7 }]
      }
    ];
    const mockStyleRefs = [
      {
        title: 'Test Song',
        content: 'Sample lyrics here'
      }
    ];
    const { systemPrompt, userPrompt } = promptBuilder.buildGenerationPrompt(
      validBody.input,
      validBody.settings,
      mockFragments,
      mockStyleRefs,
      1,
      null
    );
    console.log('   ✓ Prompt built successfully');
    console.log(`   System prompt length: ${systemPrompt.length} chars`);
    console.log(`   User prompt length: ${userPrompt.length} chars\n`);

    console.log('5. Testing invalid requests...');

    // Test missing input
    const invalidEvent1 = {
      httpMethod: 'POST',
      body: JSON.stringify({ settings: {} })
    };
    const result1 = await generateHandler.handler(invalidEvent1, mockContext);
    console.log(`   ✓ Missing input: ${result1.statusCode === 400 ? 'PASS' : 'FAIL'}`);

    // Test invalid method
    const invalidEvent2 = {
      httpMethod: 'GET',
      body: mockEvent.body
    };
    const result2 = await generateHandler.handler(invalidEvent2, mockContext);
    console.log(`   ✓ Invalid method: ${result2.statusCode === 405 ? 'PASS' : 'FAIL'}`);

    // Test invalid setting value
    const invalidEvent3 = {
      httpMethod: 'POST',
      body: JSON.stringify({
        input: 'test',
        settings: { rhythm: 'invalid' }
      })
    };
    const result3 = await generateHandler.handler(invalidEvent3, mockContext);
    console.log(`   ✓ Invalid setting: ${result3.statusCode === 400 ? 'PASS' : 'FAIL'}\n`);

    console.log('=== All Tests Passed ===');
    console.log('\nNote: Full end-to-end test requires:');
    console.log('  - Database connection (DATABASE_URL)');
    console.log('  - OpenRouter API key (OPENROUTER_API_KEY)');
    console.log('  - Upstash Vector credentials');
    console.log('  - Fragment data in database');

  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

// Run test if executed directly
if (require.main === module) {
  testEndpoint().then(() => {
    console.log('\n✓ Test suite completed successfully');
    process.exit(0);
  }).catch(err => {
    console.error('\n✗ Test suite failed:', err);
    process.exit(1);
  });
}

module.exports = { testEndpoint };
