#!/usr/bin/env node

/**
 * Simple NewsData.io Test
 * Tests a minimal NewsData.io integration to isolate the issue
 */

const https = require('https');
const { URL } = require('url');

const LATEST_DEPLOYMENT_URL = 'https://smartkhabar-jfvivinwg-prateeks-projects-018799ca.vercel.app';

async function makeRequest(endpoint, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, LATEST_DEPLOYMENT_URL);
    
    const requestOptions = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SmartKhabar-Simple-Test/1.0',
        ...options.headers
      },
      timeout: 45000 // Very long timeout
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
            data: jsonData,
            rawData: data
          });
        } catch (error) {
          resolve({
            status: res.statusCode,
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
      reject(new Error('Request timeout after 45 seconds'));
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

async function testSimpleEndpoints() {
  console.log('🧪 Simple NewsData.io Test');
  console.log('===========================');
  console.log(`📍 URL: ${LATEST_DEPLOYMENT_URL}`);
  console.log(`🕐 Started: ${new Date().toISOString()}`);
  
  // Test with very simple parameters to avoid timeouts
  const tests = [
    {
      name: 'Breaking News (Minimal)',
      endpoint: '/api/news/breaking?limit=1',
      timeout: 45000
    },
    {
      name: 'Real-time News (Minimal)',
      endpoint: '/api/news/realtime?limit=1',
      timeout: 45000
    }
  ];
  
  for (const test of tests) {
    try {
      console.log(`\n🔍 Testing ${test.name}...`);
      console.log(`   Endpoint: ${test.endpoint}`);
      console.log(`   Timeout: ${test.timeout}ms`);
      
      const startTime = Date.now();
      const response = await makeRequest(test.endpoint);
      const responseTime = Date.now() - startTime;
      
      console.log(`   ⏱️  Response Time: ${responseTime}ms`);
      console.log(`   📊 Status: ${response.status}`);
      
      if (response.status === 200) {
        console.log(`   ✅ SUCCESS!`);
        
        if (response.data.articles) {
          console.log(`   📰 Articles: ${response.data.articles.length}`);
          console.log(`   🔗 Source: ${response.data.source || 'unknown'}`);
          
          if (response.data.articles.length > 0) {
            const article = response.data.articles[0];
            console.log(`   📄 Sample: ${article.headline || article.title || 'N/A'}`);
            console.log(`   🕐 Published: ${article.publishedAt || 'N/A'}`);
          }
          
          if (response.data.breaking || response.data.realTime) {
            console.log(`   🔴 REAL-TIME: ${response.data.breaking ? 'Breaking News' : 'Real-time News'} WORKING!`);
          }
        }
        
      } else if (response.status === 503) {
        console.log(`   ❌ Service Unavailable (503)`);
        console.log(`   Error: ${response.data.error || 'Unknown error'}`);
        
        if (response.data.fallback) {
          console.log(`   📝 Fallback: ${response.data.fallback.message}`);
        }
        
      } else {
        console.log(`   ❌ Failed with status ${response.status}`);
        console.log(`   Response: ${JSON.stringify(response.data, null, 2)}`);
      }
      
    } catch (error) {
      console.log(`   💥 ERROR: ${error.message}`);
      
      if (error.message.includes('timeout')) {
        console.log(`   ⏰ This suggests the NewsData.io API call is taking too long`);
        console.log(`   💡 Possible solutions:`);
        console.log(`      - Increase Vercel function timeout`);
        console.log(`      - Add caching to reduce API calls`);
        console.log(`      - Use smaller request parameters`);
      }
    }
  }
  
  console.log('\n📋 Summary');
  console.log('===========');
  console.log('If you see 503 errors or timeouts, the issue is likely:');
  console.log('1. ⏰ Serverless function timeout (default 10s on Vercel)');
  console.log('2. 🌐 Network latency between Vercel and NewsData.io');
  console.log('3. 📊 NewsData.io API response time is too slow');
  console.log('4. 🔄 Rate limiting or quota issues');
  
  console.log('\n🔧 Next Steps:');
  console.log('1. Add vercel.json configuration to increase function timeout');
  console.log('2. Implement caching to reduce API calls');
  console.log('3. Add retry logic with exponential backoff');
  console.log('4. Consider using a different news API as fallback');
  
  console.log(`\n🎯 Test completed: ${new Date().toISOString()}`);
}

// Run the test
testSimpleEndpoints().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});