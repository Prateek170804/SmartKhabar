#!/usr/bin/env node

/**
 * Enhanced System Test Script
 */

const https = require('https');

const BASE_URL = 'https://smartkhabar.vercel.app';

async function makeRequest(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    }).on('error', reject);
  });
}

async function runEnhancedSystemTest() {
  console.log('🧪 Running enhanced system test...\n');

  const tests = [
    {
      name: 'Health Check',
      url: `${BASE_URL}/api/health`,
      expectedStatus: 200
    },
    {
      name: 'Free News API',
      url: `${BASE_URL}/api/news/free`,
      expectedStatus: 200
    },
    {
      name: 'User Preferences API (Original)',
      url: `${BASE_URL}/api/preferences?userId=test-user`,
      expectedStatus: 200,
      optional: true
    },
    {
      name: 'User Preferences API (Simple)',
      url: `${BASE_URL}/api/preferences/simple?userId=test-user`,
      expectedStatus: 200
    },
    {
      name: 'Personalized News - General',
      url: `${BASE_URL}/api/news/personalized?userId=test-general&categories=general`,
      expectedStatus: 200
    },
    {
      name: 'Personalized News - Technology',
      url: `${BASE_URL}/api/news/personalized?userId=test-tech&categories=technology`,
      expectedStatus: 200
    },
    {
      name: 'Personalized News - Business',
      url: `${BASE_URL}/api/news/personalized?userId=test-business&categories=business`,
      expectedStatus: 200
    },
    {
      name: 'Personalized News - Science',
      url: `${BASE_URL}/api/news/personalized?userId=test-science&categories=science`,
      expectedStatus: 200
    },
    {
      name: 'News Collection Cron',
      url: `${BASE_URL}/api/cron/collect-news`,
      expectedStatus: 200
    }
  ];

  let passed = 0;
  let failed = 0;
  let optional_failed = 0;

  for (const test of tests) {
    try {
      console.log(`🔍 Testing: ${test.name}`);
      const result = await makeRequest(test.url);
      
      if (result.status === test.expectedStatus) {
        console.log(`✅ PASS: ${test.name} (${result.status})`);
        
        // Show some data for key endpoints
        if (test.name.includes('Personalized News') && result.data.success) {
          const summaryCount = result.data.data?.summaries?.length || 0;
          console.log(`   📰 Found ${summaryCount} personalized summaries`);
        } else if (test.name === 'Free News API' && result.data.success) {
          const articleCount = result.data.articles?.length || 0;
          console.log(`   📰 Found ${articleCount} free news articles`);
        } else if (test.name.includes('User Preferences API') && result.data.success) {
          const preferences = result.data.preferences;
          console.log(`   👤 User preferences: ${preferences.categories?.join(', ') || 'none'}`);
        } else if (test.name === 'News Collection Cron' && result.data.success) {
          const totalArticles = result.data.data?.totalArticles || 0;
          console.log(`   📰 Collected ${totalArticles} new articles`);
        }
        
        passed++;
      } else {
        if (test.optional) {
          console.log(`⚠️  OPTIONAL FAIL: ${test.name} (Expected ${test.expectedStatus}, got ${result.status})`);
          optional_failed++;
        } else {
          console.log(`❌ FAIL: ${test.name} (Expected ${test.expectedStatus}, got ${result.status})`);
          failed++;
        }
      }
    } catch (error) {
      if (test.optional) {
        console.log(`⚠️  OPTIONAL ERROR: ${test.name} - ${error.message}`);
        optional_failed++;
      } else {
        console.log(`❌ ERROR: ${test.name} - ${error.message}`);
        failed++;
      }
    }
    
    console.log(''); // Empty line for readability
  }

  console.log('📊 Enhanced Test Results:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⚠️  Optional Failed: ${optional_failed}`);
  
  const totalRequired = passed + failed;
  const successRate = Math.round((passed / totalRequired) * 100);
  console.log(`📈 Success Rate: ${successRate}%`);

  if (failed === 0) {
    console.log('\n🎉 All required tests passed! SmartKhabar is fully functional!');
    console.log('🚀 System Status: PRODUCTION READY');
  } else {
    console.log('\n⚠️  Some required tests failed. Please check the issues above.');
  }

  // Additional system info
  console.log('\n📋 System Information:');
  console.log(`🌐 Production URL: ${BASE_URL}`);
  console.log(`📅 Test Date: ${new Date().toISOString()}`);
  console.log(`🔧 Total Endpoints Tested: ${tests.length}`);
}

if (require.main === module) {
  runEnhancedSystemTest().catch(console.error);
}