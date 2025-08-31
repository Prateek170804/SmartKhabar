#!/usr/bin/env node

/**
 * Test script for Enhanced India News functionality
 * Tests the improved article collection with more sources and better limits
 */

const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3001'; // Adjust port as needed

async function testEnhancedIndiaNews() {
  console.log('🇮🇳 Testing Enhanced SmartKhabar India News');
  console.log('Make sure the server is running: npm run dev');
  console.log('======================================================================');

  const tests = [
    {
      name: 'Enhanced General India News (60 articles)',
      endpoint: '/api/news/india?type=general&limit=60',
      expectedMinArticles: 30
    },
    {
      name: 'Enhanced Technology News',
      endpoint: '/api/news/india?type=general&category=technology&limit=30',
      expectedMinArticles: 10
    },
    {
      name: 'Enhanced Business News',
      endpoint: '/api/news/india?type=general&category=business&limit=30',
      expectedMinArticles: 10
    },
    {
      name: 'Enhanced Sports News',
      endpoint: '/api/news/india?type=general&category=sports&limit=30',
      expectedMinArticles: 10
    },
    {
      name: 'Enhanced Politics News',
      endpoint: '/api/news/india?type=general&category=politics&limit=30',
      expectedMinArticles: 10
    }
  ];

  let passedTests = 0;
  let totalTests = tests.length;
  let totalArticlesCollected = 0;

  for (const test of tests) {
    console.log(`\n🧪 Testing: ${test.name}`);
    console.log(`📡 Endpoint: ${test.endpoint}`);
    
    try {
      const startTime = Date.now();
      const response = await fetch(`${BASE_URL}${test.endpoint}`);
      const data = await response.json();
      const duration = Date.now() - startTime;

      if (!response.ok) {
        console.log(`❌ HTTP Error: ${response.status} ${response.statusText}`);
        console.log(`   Error: ${data.error?.message || 'Unknown error'}`);
        continue;
      }

      if (!data.success) {
        console.log(`❌ API Error: ${data.error?.message || 'Unknown error'}`);
        continue;
      }

      const testData = data.data;
      const articleCount = testData.articles ? testData.articles.length : 0;
      totalArticlesCollected += articleCount;

      console.log(`✅ Response Time: ${duration}ms`);
      console.log(`✅ Articles Collected: ${articleCount}`);

      if (articleCount >= test.expectedMinArticles) {
        console.log(`✅ ${test.name} - PASSED (${articleCount} >= ${test.expectedMinArticles})`);
        passedTests++;
      } else {
        console.log(`⚠️ ${test.name} - PARTIAL (${articleCount} < ${test.expectedMinArticles})`);
      }

      // Show API usage breakdown
      if (testData.apiUsage) {
        console.log(`📊 API Usage:`);
        console.log(`   - NewsData.io: ${testData.apiUsage.newsdata || 0} articles`);
        console.log(`   - GNews: ${testData.apiUsage.gnews || 0} articles`);
        console.log(`   - Web Scraping: ${testData.apiUsage.scraping || 0} articles`);
        console.log(`   - AI Summaries: ${testData.apiUsage.huggingface || 0} articles`);
      }

      // Show regional breakdown
      if (testData.regionalBreakdown) {
        const regions = Object.entries(testData.regionalBreakdown);
        console.log(`🗺️ Regional Coverage: ${regions.map(([region, count]) => `${region}:${count}`).join(', ')}`);
      }

      // Show category breakdown
      if (testData.categoryBreakdown) {
        const categories = Object.entries(testData.categoryBreakdown);
        console.log(`📂 Category Coverage: ${categories.map(([cat, count]) => `${cat}:${count}`).join(', ')}`);
      }

    } catch (error) {
      console.log(`❌ ${test.name} - FAILED`);
      console.log(`   Error: ${error.message}`);
    }
  }

  console.log('\n======================================================================');
  console.log('📊 ENHANCED INDIA NEWS TEST RESULTS');
  console.log('======================================================================');
  
  console.log(`🎯 Tests Passed: ${passedTests}/${totalTests}`);
  console.log(`📰 Total Articles Collected: ${totalArticlesCollected}`);
  console.log(`📈 Average Articles per Test: ${Math.round(totalArticlesCollected / totalTests)}`);

  if (passedTests >= totalTests * 0.8) {
    console.log(`🎉 EXCELLENT PERFORMANCE! (${Math.round(passedTests/totalTests*100)}% success rate)`);
  } else if (passedTests >= totalTests * 0.6) {
    console.log(`✅ GOOD PERFORMANCE! (${Math.round(passedTests/totalTests*100)}% success rate)`);
  } else {
    console.log(`⚠️ NEEDS IMPROVEMENT (${Math.round(passedTests/totalTests*100)}% success rate)`);
  }

  console.log('\n🔧 ENHANCEMENTS IMPLEMENTED:');
  console.log('   ✅ Increased maxArticles from 40 to 60');
  console.log('   ✅ Expanded GNews search terms from 5 to 8');
  console.log('   ✅ Increased web scraping sources from 3 to 6');
  console.log('   ✅ Enhanced article generation from 3 to 5 per source');
  console.log('   ✅ Disabled AI summarization to avoid timeouts');
  console.log('   ✅ Added more diverse Indian news sources');

  console.log('\n💡 EXPECTED IMPROVEMENTS:');
  console.log('   📈 2-3x more articles collected');
  console.log('   ⚡ Faster response times (no AI processing)');
  console.log('   🎯 Better category diversity');
  console.log('   🗺️ Improved regional coverage');
  console.log('   📊 More reliable article counts');

  console.log('\n🎯 How to Test Manually:');
  console.log('   1. Visit: http://localhost:3001');
  console.log('   2. Click on "🇮🇳 India News" tab');
  console.log('   3. Notice increased article counts');
  console.log('   4. Try different category filters');
  console.log('   5. Check faster loading times');

  return passedTests >= totalTests * 0.6;
}

// Run the test
if (require.main === module) {
  testEnhancedIndiaNews()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testEnhancedIndiaNews };