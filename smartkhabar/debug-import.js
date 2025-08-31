const fs = require('fs');

// Read the compiled file to see what's being exported
try {
  const content = fs.readFileSync('./src/lib/personalization/interaction-learner.ts', 'utf8');
  console.log('File exists and has content:', content.length > 0);
  
  // Check for class definition
  const hasClass = content.includes('export class InteractionLearner');
  console.log('Has InteractionLearner class export:', hasClass);
  
  // Check for all exports
  const exports = content.match(/export .*/g);
  console.log('All exports found:', exports);
  
} catch (error) {
  console.error('Error reading file:', error.message);
}