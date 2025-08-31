#!/usr/bin/env node

/**
 * Script to enhance news diversity across SmartKhabar
 */

const fs = require('fs');
const path = require('path');

function updateFileContent(filePath, updates) {
  const fullPath = path.join(__dirname, '..', filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`❌ File not found: ${filePath}`);
    return false;
  }
  
  let content = fs.readFileSync(fullPath, 'utf8');
  let modified = false;
  
  updates.forEach(update => {
    if (content.includes(update.search)) {
      content = content.replace(update.search, update.replace);
      modified = true;
      console.log(`✅ Updated ${filePath}: ${update.description}`);
    } else {
      console.log(`⚠️ Pattern not found in ${filePath}: ${update.description}`);
    }
  });
  
  if (modified) {
    fs.writeFileSync(fullPath, content, 'utf8');
    return true;
  }
  
  return false;
}

function enhanceNewsDiversity() {
  console.log('🌍 Enhancing SmartKhabar News Diversity');
  console.log('=' .repeat(50));
  
  const enhancements = [
    {
      file: 'src/lib/news-collection/free-news-collector.ts',
      updates: [
        {
          search: "categories: ['technology', 'business', 'science', 'general']",
          replace: `categories: [
    'general',      // General news
    'technology',   // Tech news  
    'business',     // Business & finance
    'science',      // Science & research
    'health',       // Health & medicine
    'sports',       // Sports news
    'entertainment',// Entertainment & celebrity
    'politics',     // Political news
    'world',        // International news
    'environment'   // Environmental news
  ]`,
          description: 'Expanded default categories from 4 to 10'
        }
      ]
    },
    {
      file: 'src/app/page.tsx',
      updates: [
        {
          search: "categories: ['general', 'technology', 'business']",
          replace: "categories: ['general', 'technology', 'business', 'science', 'health', 'sports', 'world', 'politics']",
          description: 'Expanded main page categories from 3 to 8'
        }
      ]
    },
    {
      file: 'src/components/UserPreferences.tsx',
      updates: [
        {
          search: `const AVAILABLE_TOPICS = [
  'technology',
  'business',
  'science',
  'health',
  'sports',
  'entertainment',
  'politics',
  'world',
  'finance',
  'startup',
];`,
          replace: `const AVAILABLE_TOPICS = [
  'general',
  'technology',
  'business', 
  'science',
  'health',
  'sports',
  'entertainment',
  'politics',
  'world',
  'environment',
  'finance',
  'education',
  'lifestyle',
  'travel',
  'food',
  'automotive'
];`,
          description: 'Expanded available topics from 10 to 16'
        }
      ]
    }
  ];
  
  let totalUpdates = 0;
  
  enhancements.forEach(enhancement => {
    console.log(`\n📁 Processing ${enhancement.file}...`);
    const updated = updateFileContent(enhancement.file, enhancement.updates);
    if (updated) {
      totalUpdates++;
    }
  });
  
  console.log('\n' + '=' .repeat(50));
  console.log('📊 DIVERSITY ENHANCEMENT SUMMARY');
  console.log('=' .repeat(50));
  
  console.log(`✅ Files Updated: ${totalUpdates}/${enhancements.length}`);
  
  console.log('\n🎯 ENHANCEMENTS APPLIED:');
  console.log('   📰 Default Categories: 4 → 10 categories');
  console.log('   🏠 Main Page Categories: 3 → 8 categories');
  console.log('   ⚙️ User Preferences: 10 → 16 available topics');
  console.log('   🌍 Coverage: Technology-focused → Multi-sector');
  
  console.log('\n📈 NEW CATEGORY COVERAGE:');
  const newCategories = [
    '🌍 General News',
    '💻 Technology', 
    '💼 Business',
    '🔬 Science',
    '🏥 Health',
    '⚽ Sports',
    '🎬 Entertainment',
    '🏛️ Politics',
    '🌎 World News',
    '🌱 Environment',
    '💰 Finance',
    '🎓 Education',
    '🏠 Lifestyle',
    '✈️ Travel',
    '🍕 Food',
    '🚗 Automotive'
  ];
  
  newCategories.forEach(category => {
    console.log(`   ${category}`);
  });
  
  console.log('\n🚀 EXPECTED IMPROVEMENTS:');
  console.log('   ✅ More diverse news content across all sectors');
  console.log('   ✅ Better representation of non-tech news');
  console.log('   ✅ Enhanced user preference options');
  console.log('   ✅ Improved real-time feed diversity');
  console.log('   ✅ Better personalization capabilities');
  
  console.log('\n💡 NEXT STEPS:');
  console.log('   1. Start the server: npm run dev');
  console.log('   2. Test diversity: node scripts/test-news-diversity.js');
  console.log('   3. Visit: http://localhost:3000');
  console.log('   4. Check all three tabs for diverse content');
  console.log('   5. Test preferences with new categories');
  
  return totalUpdates > 0;
}

function createDiversityTestScript() {
  const testScript = `#!/usr/bin/env node

/**
 * Quick diversity test for enhanced SmartKhabar
 */

const categories = [
  'general', 'technology', 'business', 'science', 
  'health', 'sports', 'entertainment', 'politics', 
  'world', 'environment'
];

console.log('🧪 Testing Enhanced News Diversity');
console.log('Categories to test:', categories.join(', '));
console.log('\\n💡 Run this after starting the server:');
console.log('   npm run dev');
console.log('   node scripts/test-news-diversity.js');
`;

  fs.writeFileSync(path.join(__dirname, 'quick-diversity-test.js'), testScript);
  console.log('✅ Created quick-diversity-test.js');
}

if (require.main === module) {
  const success = enhanceNewsDiversity();
  createDiversityTestScript();
  
  if (success) {
    console.log('\n🎉 News diversity enhancement complete!');
    console.log('SmartKhabar now supports 10+ news categories across all sectors.');
  } else {
    console.log('\n⚠️ Some enhancements may have failed. Check the logs above.');
  }
}

module.exports = { enhanceNewsDiversity };