// Simple test for prosodic analyzer
const { analyzeVerse } = require('./netlify/functions/utils/prosodic-analyzer');

const testInput = `I'm walking down the street tonight
The moon is shining bright
And everything feels just right`;

console.log('Testing prosodic analyzer...\n');
console.log('Input:');
console.log(testInput);
console.log('\n---\n');

try {
  const analysis = analyzeVerse(testInput);
  console.log('Analysis results:');
  console.log(JSON.stringify(analysis, null, 2));
  console.log('\nTest passed! ✓');
} catch (error) {
  console.error('Test failed:', error);
  process.exit(1);
}
