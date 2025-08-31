// Simple syntax test for IndiaNewsFeed component
const fs = require('fs');

try {
  const content = fs.readFileSync('src/components/IndiaNewsFeed.tsx', 'utf8');
  
  // Basic bracket matching
  const openBrackets = (content.match(/\{/g) || []).length;
  const closeBrackets = (content.match(/\}/g) || []).length;
  const openParens = (content.match(/\(/g) || []).length;
  const closeParens = (content.match(/\)/g) || []).length;
  const openTags = (content.match(/<[^\/][^>]*>/g) || []).length;
  const closeTags = (content.match(/<\/[^>]*>/g) || []).length;
  
  console.log('Bracket Analysis:');
  console.log(`Open brackets: ${openBrackets}`);
  console.log(`Close brackets: ${closeBrackets}`);
  console.log(`Open parentheses: ${openParens}`);
  console.log(`Close parentheses: ${closeParens}`);
  console.log(`Open tags: ${openTags}`);
  console.log(`Close tags: ${closeTags}`);
  
  if (openBrackets !== closeBrackets) {
    console.log('❌ Bracket mismatch detected!');
  } else {
    console.log('✅ Brackets match');
  }
  
  if (openParens !== closeParens) {
    console.log('❌ Parentheses mismatch detected!');
  } else {
    console.log('✅ Parentheses match');
  }
  
} catch (error) {
  console.error('Error reading file:', error.message);
}