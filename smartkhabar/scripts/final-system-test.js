#!/usr/bin/env node

/**
 * Final System Test Script
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

async function runSystemTest() {
  console.log('🧪 Running final system test...\n');

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
      name: 'User Preferences API',
      url: `${BASE_URL}/api/preferences?userId=test-user`,
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
    }
  ];

  let passed = 0;
  let failed = 0;

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
        } else if (test.name === 'User Preferences API' && result.data.success) {
          const preferences = result.data.preferences;
          console.log(`   👤 User preferences: ${preferences.categories?.join(', ') || 'none'}`);
        }
        
        passed++;
      } else {
        console.log(`❌ FAIL: ${test.name} (Expected ${test.expectedStatus}, got ${result.status})`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ ERROR: ${test.name} - ${error.message}`);
      failed++;
    }
    
    console.log(''); // Empty line for readability
  }

  console.log('📊 Test Results:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);

  if (failed === 0) {
    console.log('\n🎉 All tests passed! SmartKhabar is fully functional!');
  } else {
    console.log('\n⚠️  Some tests failed. Please check the issues above.');
  }
}

if (require.main === module) {
  runSystemTest().catch(console.error);
}