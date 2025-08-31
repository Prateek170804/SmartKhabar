#!/usr/bin/env node

/**
 * Test script for India News functionality
 * Tests the India-specific news collection and API endpoints
 */

const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3001'; // Adjust port as needed

async function testIndiaNewsAPI() {
  console.log('🇮🇳 Testing SmartKhabar India News Integration');
  console.log('Make sure the server is running: npm run dev');
  console.log('======================================================================');

  const tests = [
    {
      name: 'General India News',
      endpoint: '/api/news/india?type=general&limit=10',
      expectedFields: ['articles', 'totalCollected', 'regionalBreakdown', 'categoryBreakdown']
    },
    {
      name: 'India Breaking News',
      endpoint: '/api/news/india?type=breaking&limit=5',
      expectedFields: ['articles', 'totalCollected', 'type']
    },
    {
      name: 'India Trending Topics',
      endpoint: '/api/news/india?type=trending',
      expectedFields: ['topics', 'type']
    },
    {
      name: 'India Politics News',
      endpoint: '/api/news/india?type=general&category=politics&limit=5',
      expectedFields: ['articles', 'totalCollected', 'filters']
    },
    {
      name: 'North India Regional News',
      endpoint: '/api/news/india?type=general&region=north&limit=5',
      expectedFields: ['articles', 'totalCollected', 'filters']
    },
    {
      name: 'India Business News with Scraping',
      endpoint: '/api/news/india?type=general&category=business&enableScraping=true&limit=5',
      expectedFields: ['articles', 'totalCollected', 'apiUsage']
    }
  ];

  let passedTests = 0;
  let totalTests = tests.length;

  for (const test of tests) {
    console.log(`\n🧪 Testing: ${test.name}`);
    console.log(`📡 Endpoint: ${test.endpoint}`);
    
    try {
      const response = await fetch(`${BASE_URL}${test.endpoint}`);
      const data = await response.json();

      if (!response.ok) {
        console.log(`❌ HTTP Error: ${response.status} ${response.statusText}`);
        console.log(`   Error: ${data.error?.message || 'Unknown error'}`);
        continue;
      }

      if (!data.success) {
        console.log(`❌ API Error: ${data.error?.message || 'Unknown error'}`);
        continue;
      }

      // Check expected fields
      const missingFields = test.expectedFields.filter(field => !(field in data.data));
      if (missingFields.length > 0) {
        console.log(`❌ Missing fields: ${missingFields.join(', ')}`);
        continue;
      }

      // Validate specific data based on test type
      let validationPassed = true;
      const testData = data.data;

      if (test.name.includes('General') || test.name.includes('Breaking') || test.name.includes('Politics') || test.name.includes('Regional') || test.name.includes('Business')) {
        if (!testData.articles || !Array.isArray(testData.articles)) {
          console.log(`❌ Invalid articles data`);
          validationPassed = false;
        } else {
          console.log(`✅ Articles: ${testData.articles.length} found`);
          
          // Check article structure
          if (testData.articles.length > 0) {
            const article = testData.articles[0];
            const requiredFields = ['id', 'headline', 'content', 'source', 'category', 'publishedAt', 'url'];
            const missingArticleFields = requiredFields.filter(field => !(field in article));
            
            if (missingArticleFields.length > 0) {
              console.log(`❌ Article missing fields: ${missingArticleFields.join(', ')}`);
              validationPassed = false;
            } else {
              console.log(`✅ Article structure valid`);
              
              // Check India-specific fields
              if (article.region) {
                console.log(`✅ Region detected: ${article.region}`);
              }
              if (article.tags && article.tags.includes('india')) {
                console.log(`✅ India tag found`);
              }
            }
          }
        }

        // Check regional breakdown
        if (testData.regionalBreakdown) {
          const regions = Object.keys(testData.regionalBreakdown);
          console.log(`✅ Regional breakdown: ${regions.join(', ')}`);
        }

        // Check category breakdown
        if (testData.categoryBreakdown) {
          const categories = Object.keys(testData.categoryBreakdown);
          console.log(`✅ Category breakdown: ${categories.join(', ')}`);
        }

        // Check API usage stats
        if (testData.apiUsage) {
          console.log(`✅ API Usage - NewsData: ${testData.apiUsage.newsdata}, GNews: ${testData.apiUsage.gnews}, Scraping: ${testData.apiUsage.scraping}`);
        }
      }

      if (test.name.includes('Trending')) {
        if (!testData.topics || !Array.isArray(testData.topics)) {
          console.log(`❌ Invalid topics data`);
          validationPassed = false;
        } else {
          console.log(`✅ Trending topics: ${testData.topics.length} found`);
          if (testData.topics.length > 0) {
            console.log(`   Topics: ${testData.topics.slice(0, 5).join(', ')}`);
          }
        }
      }

      if (validationPassed) {
        console.log(`✅ ${test.name} - PASSED`);
        passedTests++;
      } else {
        console.log(`❌ ${test.name} - FAILED (validation errors)`);
      }

    } catch (error) {
      console.log(`❌ ${test.name} - FAILED`);
      console.log(`   Error: ${error.message}`);
    }
  }

  console.log('\n======================================================================');
  console.log('📊 INDIA NEWS TEST RESULTS');
  console.log('======================================================================');
  
  if (passedTests === totalTests) {
    console.log(`🎉 ALL TESTS PASSED! (${passedTests}/${totalTests})`);
    console.log('\n✅ India News Features Working:');
    console.log('   - General India news collection');
    console.log('   - Breaking news from India');
    console.log('   - Trending topics in India');
    console.log('   - Category-based filtering (Politics, Business, etc.)');
    console.log('   - Regional filtering (North, South, etc.)');
    console.log('   - Web scraping integration');
    console.log('   - API usage tracking');
    console.log('   - Regional and category breakdowns');
  } else {
    console.log(`⚠️ ${passedTests}/${totalTests} tests passed`);
    console.log('\n💡 Some India news features may need attention');
  }

  console.log('\n🎯 How to Test Manually:');
  console.log('   1. Visit: http://localhost:3001');
  console.log('   2. Click on "🇮🇳 India News" tab');
  console.log('   3. Try different filters:');
  console.log('      - News Type: General, Breaking, Trending');
  console.log('      - Category: Politics, Business, Technology, etc.');
  console.log('      - Region: North India, South India, etc.');
  console.log('   4. Verify articles show India-specific content');
  console.log('   5. Check regional and category breakdowns');

  console.log('\n💡 Expected Behavior:');
  console.log('   - India news should be filtered by country=IN');
  console.log('   - Articles should have regional classification');
  console.log('   - Breaking news should show latest India updates');
  console.log('   - Trending topics should reflect Indian interests');
  console.log('   - Categories should include Indian politics, business, etc.');
  console.log('   - Regional filtering should work for different Indian states');

  return passedTests === totalTests;
}

// Run the test
if (require.main === module) {
  testIndiaNewsAPI()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testIndiaNewsAPI };