/**
 * Test endpoint for retrieval system
 * GET /api/test-retrieval?input=your+verse+here
 *
 * Example:
 * /api/test-retrieval?input=Walking+down+the+city+street
 */

const { retrieveFragments, semanticRetrieval, prosodicRetrieval } = require('./lib/retrieval');
const db = require('./lib/db');

exports.handler = async (event, context) => {
  try {
    // Parse query parameters
    const input = event.queryStringParameters?.input || 'Walking down the city street';

    // Mock prosody data for testing
    // In production, this comes from prosody analysis
    const prosodyData = {
      lines: [
        {
          text: input,
          syllables: 8,
          stress: '10101010',
          rhyme: 'IY T'
        }
      ]
    };

    // Test settings
    const settings = {
      meaning: 'yes',
      rhythm: 'ish',
      rhyming: 'ish',
      religiosity: 'ish'
    };

    console.log('Testing retrieval with input:', input);

    // Test individual components
    const semanticResults = await semanticRetrieval(input, 10);
    console.log(`Semantic retrieval: ${semanticResults.length} results`);

    const prosodicResults = await prosodicRetrieval(prosodyData, db, settings.rhythm);
    console.log(`Prosodic retrieval: ${prosodicResults.length} results`);

    // Test full retrieval
    const fragments = await retrieveFragments(input, prosodyData, settings, db);
    console.log(`Full retrieval: ${fragments.length} fragments`);

    // Return detailed results
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: true,
        input: input,
        settings: settings,
        prosodyData: prosodyData,
        results: {
          semantic: {
            count: semanticResults.length,
            topFragments: semanticResults.slice(0, 5),
          },
          prosodic: {
            count: prosodicResults.length,
            sampleIds: prosodicResults.slice(0, 5),
          },
          combined: {
            count: fragments.length,
            fragments: fragments.map(f => ({
              id: f.id,
              score: f.retrievalScore,
              content: f.content.substring(0, 100) + '...', // Truncate for readability
              tags: f.tags,
              rhythmic: f.rhythmic,
              lineCount: f.lines?.length || 0,
            }))
          }
        },
        timestamp: new Date().toISOString(),
      }, null, 2),
    };

  } catch (error) {
    console.error('Retrieval test error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack,
      }, null, 2),
    };
  }
};
