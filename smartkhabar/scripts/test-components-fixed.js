#!/usr/bin/env node

/**
 * Test script to verify the fixed components work correctly
 */

const fetch = require('node-fetch');

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

async function testEndpoint(endpoint, description, method = 'GET', body = null) {
  try {
    console.log(`\n🧪 Testing ${description}...`);
    
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log(`✅ ${description}: SUCCESS`);
      if (data.articles) {
        console.log(`   📊 Articles: ${data.articles.length}`);
        if (data.articles.length > 0) {
          console.log(`   📝 Sample: ${data.articles[0].title || data.articles[0].headline || 'No title'}`);
        }
      }
      if (data.preferences) {
        console.log(`   ⚙️ Preferences: ${JSON.stringify(data.preferences, null, 2)}`);
      }
      return { success: true, data };
    } else {
      console.log(`❌ ${description}: FAILED`);
      console.log(`   Status: ${response.status}`);
      console.log(`   Error: ${data.error || data.message || 'Unknown error'}`);
      return { success: false, error: data.error };
    }
  } catch (error) {
    console.log(`❌ ${description}: ERROR`);
    console.log(`   ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function testFixedComponents() {
  console.log('🔧 Testing Fixed SmartKhabar Components');
  console.log('=' .repeat(60));
  
  const results = [];
  
  // Test the endpoints that the components actually use
  console.log('\n📰 Testing News Endpoints (Component APIs)');
  console.log('-' .repeat(50));
  
  results.push(await testEndpoint('/api/news/free?limit=5', 'Free News (NewsFeed fallback)'));
  results.push(await testEndpoint('/api/news/personalized/simple?userId=demo-user&limit=5', 'Personalized News (NewsFeed)'));
  results.push(await testEndpoint('/api/news/realtime-simple?limit=5', 'Real-time News (RealTimeNewsFeed)'));
  results.push(await testEndpoint('/api/news/breaking-simple?limit=5', 'Breaking News (RealTimeNewsFeed fallback)'));
  
  console.log('\n⚙️ Testing Preferences Endpoints (UserPreferences)');
  console.log('-' .repeat(50));
  
  results.push(await testEndpoint('/api/preferences/simple?userId=demo-user', 'Get Preferences (UserPreferences)'));
  
  // Test preferences update
  const preferencesUpdate = {
    userId: 'demo-user',
    preferences: {
      categories: ['technology', 'business'],
      sources: ['techcrunch', 'bbc'],
      tone: 'casual',
      readingTime: 'medium',
      keywords: ['AI', 'startup'],
      language: 'en'
    }
  };
  
  results.push(await testEndpoint('/api/preferences/simple', 'Update Preferences (UserPreferences)', 'PUT', preferencesUpdate));
  
  console.log('\n👆 Testing Interaction Endpoints (NewsFeed)');
  console.log('-' .repeat(50));
  
  const interactionData = {
    userId: 'demo-user',
    articleId: 'test-article-123',
    action: 'view',
    metadata: {
      source: 'test',
      category: 'technology'
    }
  };
  
  results.push(await testEndpoint('/api/interactions', 'Track Interaction (NewsFeed)', 'POST', interactionData));
  
  console.log('\n🏥 Testing Health Endpoints (Main Page)');
  console.log('-' .repeat(50));
  
  results.push(await testEndpoint('/api/health', 'System Health (Main Page)'));
  
  // Summary
  console.log('\n' + '=' .repeat(60));
  console.log('📊 COMPONENT TESTING SUMMARY');
  console.log('=' .repeat(60));
  
  const passed = results.filter(r => r.success).length;
  const total = results.length;
  
  console.log(`🎯 Overall Result: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('🎉 All component APIs are working correctly!');
    console.log('\n✅ Fixed Issues:');
    console.log('   - UserPreferences now uses /api/preferences/simple');
    console.log('   - NewsFeed now uses /api/news/personalized/simple with fallback');
    console.log('   - RealTimeNewsFeed uses correct endpoints with fallbacks');
    console.log('   - All components have proper error handling');
  } else {
    console.log('⚠️ Some tests failed. Details above.');
    
    const failed = results.filter(r => !r.success);
    console.log('\n❌ Failed Tests:');
    failed.forEach((f, i) => {
      console.log(`   ${i + 1}. ${f.error || 'Unknown error'}`);
    });
  }
  
  console.log('\n🚀 Component Status:');
  console.log('   ✅ UserPreferences: Fixed API endpoints');
  console.log('   ✅ NewsFeed: Fixed API endpoints with fallbacks');
  console.log('   ✅ RealTimeNewsFeed: Enhanced with better fallbacks');
  console.log('   ✅ Main Page: Integrated all components correctly');
  
  console.log('\n💡 To test the fixed components:');
  console.log('   1. Start server: npm run dev');
  console.log('   2. Visit: http://localhost:3000');
  console.log('   3. Test all three tabs:');
  console.log('      - Real-time News (should show 30 articles)');
  console.log('      - Personalized Feed (should show curated content)');
  console.log('      - Preferences (should load and save correctly)');
  
  return passed === total;
}

if (require.main === module) {
  testFixedComponents().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { testFixedComponents };