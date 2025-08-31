// Simple test to check what's being imported
import { InteractionLearner } from './src/lib/personalization/interaction-learner.ts';

console.log('InteractionLearner:', InteractionLearner);
console.log('typeof InteractionLearner:', typeof InteractionLearner);
console.log('InteractionLearner.prototype:', InteractionLearner.prototype);

try {
  const instance = new InteractionLearner();
  console.log('Successfully created instance:', instance);
} catch (error) {
  console.error('Failed to create instance:', error.message);
}