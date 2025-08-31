#!/usr/bin/env node

/**
 * Comprehensive test script to check all components and identify issues
 */

const fetch = require('node-fetch');

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

async function testEndpoint(endpoint, description) {
  try {
    console.log(`\n🧪 Testing ${description}...`);
    const response = await fetch(`${BASE_URL}${endpoint}`);
    const data = await response.json();
    
    if (response.ok) {
      if (data.success !== undefined) {
        if (data.success) {
          console.log(`✅ ${description}: SUCCESS`);
          if (data.articles) {
            console.log(`   📊 Articles: ${data.articles.length}`);
          }
          if (data.preferences) {
            console.log(`   ⚙️ Preferences: ${JSON.stringify(data.preferences)}`);
          }
          return { success: true, data };
        } else {
          console.log(`❌ ${description}: API FAILED`);
          console.log(`   Error: ${data.error || 'Unknown error'}`);
          return { success: false, error: data.error };
        }
      } else {
        console.log(`✅ ${description}: SUCCESS (No success field)`);
        console.log(`   Response: ${JSON.stringify(data).substring(0, 100)}...`);
        return { success: true, data };
      }
    } else {
      console.log(`❌ ${description}: HTTP ERROR`);
      console.log(`   Status: ${response.status}`);
      console.log(`   Error: ${data.error || data.message || 'Unknown error'}`);
      return { success: false, error: `HTTP ${response.status}` };
    }
  } catch (error) {
    console.log(`❌ ${description}: NETWORK ERROR`);
    console.log(`   ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function testHealthEndpoints() {
  console.log('🏥 Testing Health & System Endpoints');
  console.log('=' .repeat(50));
  
  const results = [];
  results.push(await testEndpoint('/api/health', 'System Health'));
  results.push(await testEndpoint('/api/monitoring/health', 'Monitoring Health'));
  
  return results;
}

async function testNewsEndpoints() {
  console.log('\n📰 Testing News Endpoints');
  console.log('=' .repeat(50));
  
  const results = [];
  results.push(await testEndpoint('/api/news/free?limit=5', 'Free News'));
  results.push(await testEndpoint('/api/news/breaking-simple?limit=5', 'Breaking News'));
  results.push(await testEndpoint('/api/news/realtime-simple?limit=5', 'Real-time News'));
  results.push(await testEndpoint('/api/news/personalized/simple?userId=demo-user&limit=5', 'Personalized News'));
  
  return results;
}

async function testPreferencesEndpoints() {
  console.log('\n⚙️ Testing Preferences Endpoints');
  console.log('=' .repeat(50));
  
  const results = [];
  
  // Test GET preferences
  results.push(await testEndpoint('/api/preferences/simple?userId=demo-user', 'Get User Preferences'));
  
  // Test POST preferences
  try {
    console.log('\n🧪 Testing Update User Preferences...');
    const response = await fetch(`${BASE_URL}/api/preferences/simple`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: 'demo-user',
        preferences: {
          categories: ['technology', 'business'],
          sources: ['TechCrunch', 'BBC'],
          tone: 'professional',
          readingTime: 'medium'
        }
      })
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log('✅ Update User Preferences: SUCCESS');
      results.push({ success: true, data });
    } else {
      console.log('❌ Update User Preferences: FAILED');
      console.log(`   Error: ${data.error || 'Unknown error'}`);
      results.push({ success: false, error: data.error });
    }
  } catch (error) {
    console.log('❌ Update User Preferences: ERROR');
    console.log(`   ${error.message}`);
    results.push({ success: false, error: error.message });
  }
  
  return results;
}

async function testInteractionEndpoints() {
  console.log('\n👆 Testing Interaction Endpoints');
  console.log('=' .repeat(50));
  
  const results = [];
  
  // Test POST interaction
  try {
    console.log('\n🧪 Testing Track Interaction...');
    const response = await fetch(`${BASE_URL}/api/interactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: 'demo-user',
        articleId: 'test-article-123',
        type: 'view',
        metadata: {
          source: 'test',
          category: 'technology'
        }
      })
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log('✅ Track Interaction: SUCCESS');
      results.push({ success: true, data });
    } else {
      console.log('❌ Track Interaction: FAILED');
      console.log(`   Error: ${data.error || 'Unknown error'}`);
      results.push({ success: false, error: data.error });
    }
  } catch (error) {
    console.log('❌ Track Interaction: ERROR');
    console.log(`   ${error.message}`);
    results.push({ success: false, error: error.message });
  }
  
  return results;
}

async function testDatabaseEndpoints() {
  console.log('\n🗄️ Testing Database Endpoints');
  console.log('=' .repeat(50));
  
  const results = [];
  results.push(await testEndpoint('/api/db-test', 'Database Connection Test'));
  
  return results;
}

async function checkComponentFiles() {
  console.log('\n📁 Checking Component Files');
  console.log('=' .repeat(50));
  
  const fs = require('fs');
  const path = require('path');
  
  const components = [
    'src/components/NewsFeed.tsx',
    'src/components/RealTimeNewsFeed.tsx',
    'src/components/UserPreferences.tsx',
    'src/app/page.tsx'
  ];
  
  const results = [];
  
  for (const component of components) {
    const fullPath = path.join(__dirname, '..', component);
    if (fs.existsSync(fullPath)) {
      console.log(`✅ ${component}: Found`);
      
      // Check for common issues
      const content = fs.readFileSync(fullPath, 'utf8');
      const issues = [];
      
      if (content.includes('undefined')) {
        issues.push('Contains undefined references');
      }
      if (content.includes('console.error')) {
        issues.push('Has error logging');
      }
      if (!content.includes('export default')) {
        issues.push('Missing default export');
      }
      
      if (issues.length > 0) {
        console.log(`   ⚠️ Issues: ${issues.join(', ')}`);
      }
      
      results.push({ component, exists: true, issues });
    } else {
      console.log(`❌ ${component}: Missing`);
      results.push({ component, exists: false, issues: ['File missing'] });
    }
  }
  
  return results;
}

async function runComprehensiveTests() {
  console.log('🚀 Running Comprehensive SmartKhabar Component Tests');
  console.log('=' .repeat(70));
  
  const allResults = {
    health: [],
    news: [],
    preferences: [],
    interactions: [],
    database: [],
    components: []
  };
  
  try {
    allResults.health = await testHealthEndpoints();
    allResults.news = await testNewsEndpoints();
    allResults.preferences = await testPreferencesEndpoints();
    allResults.interactions = await testInteractionEndpoints();
    allResults.database = await testDatabaseEndpoints();
    allResults.components = await checkComponentFiles();
  } catch (error) {
    console.error('Error during testing:', error);
  }
  
  // Summary
  console.log('\n' + '=' .repeat(70));
  console.log('📊 TEST SUMMARY');
  console.log('=' .repeat(70));
  
  const categories = Object.keys(allResults);
  let totalTests = 0;
  let passedTests = 0;
  
  for (const category of categories) {
    const results = allResults[category];
    const passed = results.filter(r => r.success || r.exists).length;
    const total = results.length;
    
    totalTests += total;
    passedTests += passed;
    
    console.log(`${category.toUpperCase()}: ${passed}/${total} passed`);
    
    // Show failed tests
    const failed = results.filter(r => !r.success && !r.exists);
    if (failed.length > 0) {
      failed.forEach(f => {
        console.log(`   ❌ ${f.component || f.error || 'Unknown failure'}`);
      });
    }
  }
  
  console.log('\n' + '=' .repeat(70));
  console.log(`🎯 OVERALL RESULT: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! System is working correctly.');
  } else {
    console.log('⚠️ Some tests failed. Check the details above.');
    
    console.log('\n🔧 COMMON FIXES:');
    console.log('   1. Ensure the development server is running: npm run dev');
    console.log('   2. Check database connection and environment variables');
    console.log('   3. Verify API endpoints are properly configured');
    console.log('   4. Check component imports and exports');
  }
  
  console.log('\n💡 To start the server and test manually:');
  console.log('   npm run dev');
  console.log('   Visit: http://localhost:3000');
  
  return passedTests === totalTests;
}

if (require.main === module) {
  runComprehensiveTests().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { runComprehensiveTests };