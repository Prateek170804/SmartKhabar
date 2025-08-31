#!/usr/bin/env node

/**
 * NewsData.io Production API Test
 * Tests the deployed Vercel API with newsdata.io integration for real-time news
 */

const https = require('https');
const { URL } = require('url');

const PRODUCTION_URL = 'https://smartkhabar-e8rnt3sgj-prateeks-projects-018799ca.vercel.app';

class NewsDataProductionTester {
  constructor() {
    this.baseUrl = PRODUCTION_URL;
    this.results = [];
  }

  async makeRequest(endpoint, options = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(endpoint, this.baseUrl);
      
      const requestOptions = {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'SmartKhabar-NewsData-Test/1.0',
          ...options.headers
        },
        timeout: 30000 // 30 second timeout
      };

      const req = https.request(url, requestOptions, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const jsonData = data ? JSON.parse(data) : {};
            resolve({
              status: res.statusCode,
              headers: res.headers,
              data: jsonData,
              rawData: data
            });
          } catch (error) {
            resolve({
              status: res.statusCode,
              headers: res.headers,
              data: data,
              parseError: error.message,
              rawData: data
            });
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (options.body) {
        req.write(JSON.stringify(options.body));
      }

      req.end();
    });
  }

  async testNewsDataIntegration() {
    console.log('\n🔍 Testing NewsData.io Integration...');
    
    const tests = [
      {
        name: 'Breaking News API',
        endpoint: '/api/news/breaking',
        params: '?limit=5',
        expectedFields: ['articles', 'source', 'breaking']
      },
      {
        name: 'Real-time News API',
        endpoint: '/api/news/realtime',
        params: '?limit=5&timeframe=1',
        expectedFields: ['articles', 'source', 'realTime']
      },
      {
        name: 'Free News API',
        endpoint: '/api/news/free',
        params: '?limit=5',
        expectedFields: ['articles']
      },
      {
        name: 'Category News (Technology)',
        endpoint: '/api/news/realtime',
        params: '?category=technology&limit=3',
        expectedFields: ['articles', 'source']
      }
    ];

    for (const test of tests) {
      try {
        console.log(`\n📰 Testing: ${test.name}`);
        const startTime = Date.now();
        
        const response = await this.makeRequest(test.endpoint + test.params);
        const responseTime = Date.now() - startTime;
        
        console.log(`   Status: ${response.status}`);
        console.log(`   Response Time: ${responseTime}ms`);
        
        if (response.status === 200) {
          const data = response.data;
          
          // Check if expected fields exist
          const hasExpectedFields = test.expectedFields.every(field => 
            data.hasOwnProperty(field)
          );
          
          if (hasExpectedFields && data.articles) {
            const articles = data.articles;
            console.log(`   ✅ SUCCESS: ${articles.length} articles fetched`);
            console.log(`   Source: ${data.source || 'unknown'}`);
            console.log(`   Cached: ${data.metadata?.cached || false}`);
            
            if (articles.length > 0) {
              const firstArticle = articles[0];
              console.log(`   Sample Article:`);
              console.log(`     - Title: ${firstArticle.headline || firstArticle.title || 'N/A'}`);
              console.log(`     - Source: ${firstArticle.source || 'N/A'}`);
              console.log(`     - Published: ${firstArticle.publishedAt || 'N/A'}`);
              console.log(`     - Has Image: ${!!firstArticle.imageUrl}`);
              
              // Check for real-time indicators
              if (data.breaking || data.realTime) {
                console.log(`   🔴 REAL-TIME: This is ${data.breaking ? 'breaking' : 'real-time'} news`);
              }
            }
            
            this.results.push({
              test: test.name,
              status: 'PASS',
              articles: articles.length,
              responseTime,
              source: data.source
            });
            
          } else {
            console.log(`   ❌ FAIL: Missing expected fields or no articles`);
            console.log(`   Expected: ${test.expectedFields.join(', ')}`);
            console.log(`   Received: ${Object.keys(data).join(', ')}`);
            
            this.results.push({
              test: test.name,
              status: 'FAIL',
              error: 'Missing expected fields',
              responseTime
            });
          }
          
        } else if (response.status === 404) {
          console.log(`   ❌ FAIL: Endpoint not found (404)`);
          console.log(`   This suggests the route is not deployed properly`);
          
          this.results.push({
            test: test.name,
            status: 'FAIL',
            error: 'Endpoint not found (404)',
            responseTime
          });
          
        } else {
          console.log(`   ❌ FAIL: HTTP ${response.status}`);
          if (response.data && typeof response.data === 'object') {
            console.log(`   Error: ${response.data.error || 'Unknown error'}`);
          }
          
          this.results.push({
            test: test.name,
            status: 'FAIL',
            error: `HTTP ${response.status}`,
            responseTime
          });
        }
        
      } catch (error) {
        console.log(`   ❌ ERROR: ${error.message}`);
        this.results.push({
          test: test.name,
          status: 'ERROR',
          error: error.message
        });
      }
    }
  }

  async testNewsDataDirectly() {
    console.log('\n🔗 Testing NewsData.io API Directly...');
    
    // Test if NewsData.io API key works directly
    const newsDataApiKey = process.env.NEWSDATA_API_KEY || 'your_newsdata_api_key_here';
    
    try {
      const testUrl = `https://newsdata.io/api/1/news?apikey=${newsDataApiKey}&language=en&size=1`;
      
      const response = await new Promise((resolve, reject) => {
        const url = new URL(testUrl);
        
        const req = https.request(url, { method: 'GET' }, (res) => {
          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => {
            try {
              resolve({
                status: res.statusCode,
                data: JSON.parse(data)
              });
            } catch (error) {
              resolve({
                status: res.statusCode,
                data: data,
                parseError: error.message
              });
            }
          });
        });
        
        req.on('error', reject);
        req.end();
      });
      
      console.log(`   Status: ${response.status}`);
      
      if (response.status === 200 && response.data.results) {
        console.log(`   ✅ NewsData.io API Key is working`);
        console.log(`   Total Results Available: ${response.data.totalResults}`);
        console.log(`   Sample Article: ${response.data.results[0]?.title || 'N/A'}`);
        return true;
      } else {
        console.log(`   ❌ NewsData.io API Key issue`);
        console.log(`   Response: ${JSON.stringify(response.data, null, 2)}`);
        return false;
      }
      
    } catch (error) {
      console.log(`   ❌ Error testing NewsData.io directly: ${error.message}`);
      return false;
    }
  }

  async testRealTimeCapabilities() {
    console.log('\n⏰ Testing Real-Time News Capabilities...');
    
    try {
      // Test 1: Breaking news with high priority
      console.log('\n   Testing Breaking News (Last 1 Hour)...');
      const breaking = await this.makeRequest('/api/news/breaking?limit=3&severity=high');
      
      if (breaking.status === 200 && breaking.data.articles) {
        const articles = breaking.data.articles;
        console.log(`   ✅ Breaking News: ${articles.length} articles`);
        
        // Check how recent the articles are
        const now = new Date();
        articles.forEach((article, index) => {
          const publishedAt = new Date(article.publishedAt);
          const hoursAgo = (now - publishedAt) / (1000 * 60 * 60);
          console.log(`     ${index + 1}. ${article.headline || article.title} (${hoursAgo.toFixed(1)}h ago)`);
        });
        
        // Check if any articles are truly recent (within last 2 hours)
        const recentArticles = articles.filter(article => {
          const publishedAt = new Date(article.publishedAt);
          const hoursAgo = (now - publishedAt) / (1000 * 60 * 60);
          return hoursAgo <= 2;
        });
        
        if (recentArticles.length > 0) {
          console.log(`   🔴 REAL-TIME CONFIRMED: ${recentArticles.length} articles within last 2 hours`);
        } else {
          console.log(`   ⚠️  No articles within last 2 hours (may not be truly real-time)`);
        }
        
      } else {
        console.log(`   ❌ Breaking news test failed: ${breaking.status}`);
      }
      
      // Test 2: Real-time endpoint with different timeframes
      console.log('\n   Testing Real-Time Endpoint...');
      const realtime = await this.makeRequest('/api/news/realtime?limit=5&timeframe=1');
      
      if (realtime.status === 200 && realtime.data.articles) {
        console.log(`   ✅ Real-time News: ${realtime.data.articles.length} articles`);
        console.log(`   Source: ${realtime.data.source}`);
        console.log(`   Timeframe: Last ${realtime.data.metadata?.timeframe || '1'} hour(s)`);
      } else {
        console.log(`   ❌ Real-time news test failed: ${realtime.status}`);
      }
      
    } catch (error) {
      console.log(`   ❌ Real-time test error: ${error.message}`);
    }
  }

  async runFullTest() {
    console.log('🚀 NewsData.io Production API Test');
    console.log('=====================================');
    console.log(`📍 Testing: ${this.baseUrl}`);
    console.log(`🕐 Started: ${new Date().toISOString()}`);
    
    // Test NewsData.io API key directly first
    const apiKeyWorks = await this.testNewsDataDirectly();
    
    if (!apiKeyWorks) {
      console.log('\n❌ NewsData.io API key is not working. Stopping tests.');
      return;
    }
    
    // Test the integration
    await this.testNewsDataIntegration();
    
    // Test real-time capabilities
    await this.testRealTimeCapabilities();
    
    // Summary
    console.log('\n📊 Test Results Summary');
    console.log('========================');
    
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const errors = this.results.filter(r => r.status === 'ERROR').length;
    
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`🔥 Errors: ${errors}`);
    console.log(`📈 Success Rate: ${((passed / this.results.length) * 100).toFixed(1)}%`);
    
    if (failed > 0 || errors > 0) {
      console.log('\n❌ Failed/Error Tests:');
      this.results
        .filter(r => r.status !== 'PASS')
        .forEach(result => {
          console.log(`  - ${result.test}: ${result.error || 'Unknown error'}`);
        });
    }
    
    // Real-time news verdict
    console.log('\n🔴 Real-Time News Verdict:');
    const workingEndpoints = this.results.filter(r => r.status === 'PASS' && r.articles > 0);
    
    if (workingEndpoints.length > 0) {
      console.log('✅ NewsData.io integration is working and providing news articles');
      console.log('✅ Real-time capabilities are available through breaking/realtime endpoints');
      console.log('📰 Your production API can deliver real-time news updates');
    } else {
      console.log('❌ NewsData.io integration is not working properly in production');
      console.log('❌ Real-time news is not available');
    }
    
    console.log(`\n🎯 Test completed at: ${new Date().toISOString()}`);
  }
}

// Run the comprehensive test
const tester = new NewsDataProductionTester();
tester.runFullTest().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});