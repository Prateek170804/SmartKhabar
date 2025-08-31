#!/usr/bin/env node

/**
 * Test script for the enhanced main page functionality
 */

const fetch = require('node-fetch');

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

async function testEndpoint(endpoint, description) {
  try {
    console.log(`\n🧪 Testing ${description}...`);
    const response = await fetch(`${BASE_URL}${endpoint}`);
    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log(`✅ ${description}: SUCCESS`);
      console.log(`   - Articles found: ${data.articles?.length || 0}`);
      if (data.articles && data.articles.length > 0) {
        console.log(`   - Sample title: ${data.articles[0].title || data.articles[0].headline || 'No title'}`);
      }
      return true;
    } else {
      console.log(`❌ ${description}: FAILED`);
      console.log(`   - Status: ${response.status}`);
      console.log(`   - Error: ${data.error || 'Unknown error'}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ ${description}: ERROR`);
    console.log(`   - ${error.message}`);
    return false;
  }
}

async function testHealthStatus() {
  try {
    console.log('\n🏥 Testing Health Status...');
    const response = await fetch(`${BASE_URL}/api/health`);
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Health Status: SUCCESS');
      console.log(`   - Status: ${data.status}`);
      console.log(`   - Services: ${JSON.stringify(data.services || {})}`);
      return true;
    } else {
      console.log('❌ Health Status: FAILED');
      return false;
    }
  } catch (error) {
    console.log('❌ Health Status: ERROR');
    console.log(`   - ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Testing Enhanced SmartKhabar Main Page Functionality');
  console.log('=' .repeat(60));
  
  const results = [];
  
  // Test health endpoint
  results.push(await testHealthStatus());
  
  // Test news endpoints used by the main page
  results.push(await testEndpoint('/api/news/realtime-simple?limit=5', 'Real-time News Feed'));
  results.push(await testEndpoint('/api/news/free?limit=5', 'Free News Fallback'));
  results.push(await testEndpoint('/api/news/personalized/simple?userId=demo-user&limit=5', 'Personalized News'));
  results.push(await testEndpoint('/api/preferences/simple?userId=demo-user', 'User Preferences'));
  
  // Summary
  console.log('\n' + '=' .repeat(60));
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  console.log(`📊 Test Results: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! Enhanced main page is ready.');
  } else {
    console.log('⚠️  Some tests failed. Check the logs above for details.');
  }
  
  console.log('\n💡 Next steps:');
  console.log('   1. Visit http://localhost:3000 to see the enhanced main page');
  console.log('   2. Test the Real-time News tab for live updates');
  console.log('   3. Try the Personalized Feed tab');
  console.log('   4. Configure preferences in the Preferences tab');
  
  return passed === total;
}

if (require.main === module) {
  runTests().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { runTests };