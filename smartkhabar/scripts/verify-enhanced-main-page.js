#!/usr/bin/env node

/**
 * Quick verification script for enhanced main page
 * This script checks if the key files and components are properly configured
 */

const fs = require('fs');
const path = require('path');

function checkFile(filePath, description) {
  const fullPath = path.join(__dirname, '..', filePath);
  if (fs.existsSync(fullPath)) {
    console.log(`✅ ${description}: Found`);
    return true;
  } else {
    console.log(`❌ ${description}: Missing`);
    return false;
  }
}

function checkFileContent(filePath, searchText, description) {
  const fullPath = path.join(__dirname, '..', filePath);
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf8');
    if (content.includes(searchText)) {
      console.log(`✅ ${description}: Configured`);
      return true;
    } else {
      console.log(`❌ ${description}: Not configured`);
      return false;
    }
  } else {
    console.log(`❌ ${description}: File missing`);
    return false;
  }
}

function runVerification() {
  console.log('🔍 Verifying Enhanced SmartKhabar Main Page');
  console.log('=' .repeat(50));
  
  const checks = [];
  
  // Check main files exist
  checks.push(checkFile('src/app/page.tsx', 'Enhanced Main Page'));
  checks.push(checkFile('src/components/NewsFeed.tsx', 'NewsFeed Component'));
  checks.push(checkFile('src/components/RealTimeNewsFeed.tsx', 'RealTimeNewsFeed Component'));
  checks.push(checkFile('src/components/UserPreferences.tsx', 'UserPreferences Component'));
  
  // Check key functionality is implemented
  checks.push(checkFileContent('src/app/page.tsx', 'activeTab', 'Tab Navigation'));
  checks.push(checkFileContent('src/app/page.tsx', 'RealTimeNewsFeed', 'Real-time Integration'));
  checks.push(checkFileContent('src/app/page.tsx', 'NewsFeed', 'Personalized Feed Integration'));
  checks.push(checkFileContent('src/app/page.tsx', 'UserPreferences', 'Preferences Integration'));
  
  // Check enhanced components
  checks.push(checkFileContent('src/components/NewsFeed.tsx', 'handleReadMore', 'Enhanced Read More'));
  checks.push(checkFileContent('src/components/RealTimeNewsFeed.tsx', 'fetchNewsHTTP', 'HTTP Fallback'));
  
  // Check API endpoints exist
  checks.push(checkFile('src/app/api/news/realtime-simple/route.ts', 'Real-time API'));
  checks.push(checkFile('src/app/api/news/free/route.ts', 'Free News API'));
  checks.push(checkFile('src/app/api/news/personalized/simple/route.ts', 'Personalized API'));
  checks.push(checkFile('src/app/api/preferences/simple/route.ts', 'Preferences API'));
  
  console.log('\n' + '=' .repeat(50));
  const passed = checks.filter(c => c).length;
  const total = checks.length;
  
  console.log(`📊 Verification Results: ${passed}/${total} checks passed`);
  
  if (passed === total) {
    console.log('🎉 All verifications passed! Enhanced main page is ready.');
    console.log('\n🚀 To test the enhanced main page:');
    console.log('   1. Run: npm run dev');
    console.log('   2. Visit: http://localhost:3000');
    console.log('   3. Test all three tabs: Real-time, Personalized, Preferences');
  } else {
    console.log('⚠️  Some verifications failed. Check the missing components above.');
  }
  
  return passed === total;
}

if (require.main === module) {
  runVerification();
}

module.exports = { runVerification };