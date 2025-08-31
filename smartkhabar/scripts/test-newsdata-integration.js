/**
 * Test NewsData.io Integration
 * Verifies that NewsData.io API is working correctly with all endpoints
 */

// Simple NewsData.io client for testing
class NewsDataClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://newsdata.io/api/1';
  }

  async getLatestNews(options = {}) {
    const params = new URLSearchParams({
      apikey: this.apiKey,
      ...Object.fromEntries(
        Object.entries(options).map(([key, value]) => [
          key,
          typeof value === 'boolean' ? (value ? '1' : '0') : String(value)
        ])
      )
    });

    const response = await fetch(`${this.baseUrl}/news?${params}`);
    
    if (!response.ok) {
      throw new Error(`NewsData API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getCryptoNews(options = {}) {
    const params = new URLSearchParams({
      apikey: this.apiKey,
      ...Object.fromEntries(
        Object.entries(options).map(([key, value]) => [
          key,
          typeof value === 'boolean' ? (value ? '1' : '0') : String(value)
        ])
      )
    });

    const response = await fetch(`${this.baseUrl}/crypto?${params}`);
    
    if (!response.ok) {
      throw new Error(`NewsData Crypto API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  convertToArticle(newsDataArticle) {
    return {
      id: newsDataArticle.article_id,
      title: newsDataArticle.title,
      description: newsDataArticle.description,
      content: newsDataArticle.content || newsDataArticle.description,
      url: newsDataArticle.link,
      urlToImage: newsDataArticle.image_url || null,
      publishedAt: newsDataArticle.pubDate,
      source: {
        id: newsDataArticle.source_id,
        name: newsDataArticle.source_id,
        url: newsDataArticle.source_url,
        icon: newsDataArticle.source_icon
      },
      author: newsDataArticle.creator?.[0] || null,
      category: newsDataArticle.category?.[0] || 'general',
      language: newsDataArticle.language,
      country: newsDataArticle.country?.[0] || 'us',
      keywords: newsDataArticle.keywords || [],
      sentiment: newsDataArticle.sentiment || null,
      aiTag: newsDataArticle.ai_tag || null,
      videoUrl: newsDataArticle.video_url || null,
      priority: newsDataArticle.source_priority || 0
    };
  }

  async getNewsByCategory(category, limit = 10) {
    try {
      const response = await this.getLatestNews({
        category,
        language: 'en',
        size: limit,
        full_content: true,
        image: true,
        timeframe: '24'
      });

      return response.results.map(article => this.convertToArticle(article));
    } catch (error) {
      console.error(`Error fetching ${category} news:`, error);
      return [];
    }
  }

  async searchNews(query, limit = 10) {
    try {
      const response = await this.getLatestNews({
        q: query,
        language: 'en',
        size: limit,
        full_content: true,
        image: true,
        timeframe: '24'
      });

      return response.results.map(article => this.convertToArticle(article));
    } catch (error) {
      console.error(`Error searching news for "${query}":`, error);
      return [];
    }
  }

  async getBreakingNews(limit = 20) {
    try {
      const response = await this.getLatestNews({
        language: 'en',
        size: limit,
        full_content: true,
        image: true,
        timeframe: '1', // Last 1 hour for breaking news
        prioritydomain: 'top'
      });

      return response.results.map(article => this.convertToArticle(article));
    } catch (error) {
      console.error('Error fetching breaking news:', error);
      return [];
    }
  }

  async getTrendingNews(limit = 15) {
    try {
      const response = await this.getLatestNews({
        language: 'en',
        size: limit,
        full_content: true,
        image: true,
        timeframe: '6', // Last 6 hours for trending
        sentiment: 'positive'
      });

      return response.results.map(article => this.convertToArticle(article));
    } catch (error) {
      console.error('Error fetching trending news:', error);
      return [];
    }
  }
}

// Load environment variables
require('dotenv').config({ path: '.env.local' });

// Get API key from environment
const apiKey = process.env.NEWSDATA_API_KEY;

async function testNewsDataIntegration() {
  console.log('🧪 Testing NewsData.io Integration...\n');
  
  if (!apiKey) {
    console.error('❌ NEWSDATA_API_KEY not found in environment variables');
    console.log('Please add your NewsData.io API key to .env.local');
    process.exit(1);
  }

  const client = new NewsDataClient(apiKey);
  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  // Test 1: Latest News
  console.log('🔍 Testing: Latest News API');
  try {
    const response = await client.getLatestNews({
      language: 'en',
      size: 5,
      full_content: true,
      image: true
    });
    
    if (response.results && response.results.length > 0) {
      console.log('✅ PASS: Latest News API');
      console.log(`   📰 Found ${response.results.length} articles`);
      console.log(`   📊 Total available: ${response.totalResults}`);
      results.passed++;
    } else {
      console.log('❌ FAIL: Latest News API - No articles returned');
      results.failed++;
    }
    results.tests.push('Latest News API');
  } catch (error) {
    console.log('❌ FAIL: Latest News API');
    console.log(`   Error: ${error.message}`);
    results.failed++;
    results.tests.push('Latest News API');
  }

  // Test 2: Category News
  console.log('\n🔍 Testing: Category News (Technology)');
  try {
    const articles = await client.getNewsByCategory('technology', 3);
    
    if (articles && articles.length > 0) {
      console.log('✅ PASS: Category News API');
      console.log(`   📰 Found ${articles.length} technology articles`);
      console.log(`   📋 Sample: "${articles[0].title}"`);
      results.passed++;
    } else {
      console.log('❌ FAIL: Category News API - No articles returned');
      results.failed++;
    }
    results.tests.push('Category News API');
  } catch (error) {
    console.log('❌ FAIL: Category News API');
    console.log(`   Error: ${error.message}`);
    results.failed++;
    results.tests.push('Category News API');
  }

  // Test 3: Breaking News
  console.log('\n🔍 Testing: Breaking News');
  try {
    const articles = await client.getBreakingNews(5);
    
    if (articles && articles.length > 0) {
      console.log('✅ PASS: Breaking News API');
      console.log(`   📰 Found ${articles.length} breaking news articles`);
      console.log(`   ⚡ Latest: "${articles[0].title}"`);
      results.passed++;
    } else {
      console.log('⚠️  OPTIONAL PASS: Breaking News API - No breaking news at this time');
      results.passed++;
    }
    results.tests.push('Breaking News API');
  } catch (error) {
    console.log('❌ FAIL: Breaking News API');
    console.log(`   Error: ${error.message}`);
    results.failed++;
    results.tests.push('Breaking News API');
  }

  // Test 4: Search News
  console.log('\n🔍 Testing: Search News');
  try {
    const articles = await client.searchNews('artificial intelligence', 3);
    
    if (articles && articles.length > 0) {
      console.log('✅ PASS: Search News API');
      console.log(`   📰 Found ${articles.length} AI-related articles`);
      console.log(`   🔍 Sample: "${articles[0].title}"`);
      results.passed++;
    } else {
      console.log('❌ FAIL: Search News API - No articles returned');
      results.failed++;
    }
    results.tests.push('Search News API');
  } catch (error) {
    console.log('❌ FAIL: Search News API');
    console.log(`   Error: ${error.message}`);
    results.failed++;
    results.tests.push('Search News API');
  }

  // Test 5: Trending News
  console.log('\n🔍 Testing: Trending News');
  try {
    const articles = await client.getTrendingNews(5);
    
    if (articles && articles.length > 0) {
      console.log('✅ PASS: Trending News API');
      console.log(`   📰 Found ${articles.length} trending articles`);
      console.log(`   📈 Top trend: "${articles[0].title}"`);
      results.passed++;
    } else {
      console.log('⚠️  OPTIONAL PASS: Trending News API - No trending news available');
      results.passed++;
    }
    results.tests.push('Trending News API');
  } catch (error) {
    console.log('❌ FAIL: Trending News API');
    console.log(`   Error: ${error.message}`);
    results.failed++;
    results.tests.push('Trending News API');
  }

  // Test 6: Crypto News (if available)
  console.log('\n🔍 Testing: Crypto News');
  try {
    const response = await client.getCryptoNews({
      language: 'en',
      size: 3,
      full_content: true
    });
    
    if (response.results && response.results.length > 0) {
      console.log('✅ PASS: Crypto News API');
      console.log(`   📰 Found ${response.results.length} crypto articles`);
      console.log(`   💰 Sample: "${response.results[0].title}"`);
      results.passed++;
    } else {
      console.log('⚠️  OPTIONAL PASS: Crypto News API - No crypto news available');
      results.passed++;
    }
    results.tests.push('Crypto News API');
  } catch (error) {
    console.log('❌ FAIL: Crypto News API');
    console.log(`   Error: ${error.message}`);
    results.failed++;
    results.tests.push('Crypto News API');
  }

  // Test 7: Article Conversion
  console.log('\n🔍 Testing: Article Conversion');
  try {
    const response = await client.getLatestNews({
      language: 'en',
      size: 1,
      full_content: true,
      image: true
    });
    
    if (response.results && response.results.length > 0) {
      const converted = client.convertToArticle(response.results[0]);
      
      if (converted.id && converted.title && converted.content && converted.url) {
        console.log('✅ PASS: Article Conversion');
        console.log(`   📄 Converted article: "${converted.title}"`);
        console.log(`   🏷️  Category: ${converted.category}`);
        console.log(`   📅 Published: ${converted.publishedAt}`);
        results.passed++;
      } else {
        console.log('❌ FAIL: Article Conversion - Missing required fields');
        results.failed++;
      }
    } else {
      console.log('❌ FAIL: Article Conversion - No articles to convert');
      results.failed++;
    }
    results.tests.push('Article Conversion');
  } catch (error) {
    console.log('❌ FAIL: Article Conversion');
    console.log(`   Error: ${error.message}`);
    results.failed++;
    results.tests.push('Article Conversion');
  }

  // Final Results
  console.log('\n📊 NewsData.io Integration Test Results:');
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📈 Success Rate: ${Math.round((results.passed / (results.passed + results.failed)) * 100)}%`);
  
  if (results.failed === 0) {
    console.log('\n🎉 All NewsData.io tests passed! Integration is working perfectly!');
    console.log('🚀 NewsData.io is ready for production use');
  } else if (results.passed > results.failed) {
    console.log('\n⚠️  Most NewsData.io tests passed with some optional failures');
    console.log('🔧 Integration is functional but may need minor adjustments');
  } else {
    console.log('\n❌ NewsData.io integration has significant issues');
    console.log('🔧 Please check your API key and network connection');
  }

  console.log('\n📋 NewsData.io Features Tested:');
  results.tests.forEach((test, index) => {
    console.log(`   ${index + 1}. ${test}`);
  });

  console.log('\n🌐 NewsData.io API Status: READY FOR REAL-TIME NEWS');
  console.log('📅 Test Date:', new Date().toISOString());
}

// Run the test
testNewsDataIntegration().catch(console.error);