#!/usr/bin/env node

/**
 * Test Latest Deployment
 * Tests the newest Vercel deployment with NewsData.io integration
 */

const https = require('https');
const { URL } = require('url');

// Latest deployment URL from vercel ls
const LATEST_DEPLOYMENT_URL = 'https://smartkhabar-izzoyajgr-prateeks-projects-018799ca.vercel.app';

async function makeRequest(endpoint, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, LATEST_DEPLOYMENT_URL);
    
    const requestOptions = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SmartKhabar-Latest-Test/1.0',
        ...options.headers
      },
      timeout: 15000
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
      reject(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

async function testNewsDataEndpoints() {
  console.log('🚀 Testing Latest Deployment with NewsData.io');
  console.log('==============================================');
  console.log(`📍 URL: ${LATEST_DEPLOYMENT_URL}`);
  console.log(`🕐 Started: ${new Date().toISOString()}`);
  
  const tests = [
    {
      name: 'Health Check',
      endpoint: '/api/health',
      expectSuccess: true
    },
    {
      name: 'Breaking News API',
      endpoint: '/api/news/breaking?limit=3',
      expectSuccess: true,
      isNewsEndpoint: true
    },
    {
      name: 'Real-time News API', 
      endpoint: '/api/news/realtime?limit=3&timeframe=1',
      expectSuccess: true,
      isNewsEndpoint: true
    },
    {
      name: 'Free News API',
      endpoint: '/api/news/free?limit=3',
      expectSuccess: true,
      isNewsEndpoint: true
    },
    {
      name: 'Database Test',
      endpoint: '/api/db-test',
      expectSuccess: true
    }
  ];
  
  let workingEndpoints = 0;
  let realTimeWorking = false;
  
  for (const test of tests) {
    try {
      console.log(`\n🔍 Testing ${test.name}...`);
      const startTime = Date.now();
      const response = await makeRequest(test.endpoint);
      const responseTime = Date.now() - startTime;
      
      console.log(`   Status: ${response.status} (${responseTime}ms)`);
      
      if (response.status === 200) {
        console.log(`   ✅ SUCCESS`);
        workingEndpoints++;
        
        if (test.isNewsEndpoint && response.data.articles !== undefined) {
          console.log(`   📰 Articles: ${response.data.articles.length}`);
          console.log(`   🔗 Source: ${response.data.source || 'unknown'}`);
          
          if (response.data.breaking || response.data.realTime) {
            console.log(`   🔴 Real-time: ${response.data.breaking ? 'BREAKING' : 'REALTIME'}`);
            realTimeWorking = true;
          }
          
          if (response.data.articles.length > 0) {
            const firstArticle = response.data.articles[0];
            console.log(`   📄 Sample: ${firstArticle.headline || firstArticle.title || 'N/A'}`);
          }
        }
        
        if (response.data.success !== undefined) {
          console.log(`   ✨ Success: ${response.data.success}`);
        }
        
      } else {
        console.log(`   ❌ FAILED - Status ${response.status}`);
        
        if (response.status === 404) {
          console.log(`   📝 Note: Endpoint not found - may not be deployed`);
        } else if (response.status >= 500) {
          console.log(`   🔥 Note: Server error`);
          if (response.data.error) {
            console.log(`   Error: ${response.data.error}`);
          }
        }
      }
      
    } catch (error) {
      console.log(`   💥 ERROR: ${error.message}`);
    }
  }
  
  // Summary
  console.log('\n📊 Test Results Summary');
  console.log('========================');
  console.log(`✅ Working: ${workingEndpoints}/${tests.length}`);
  console.log(`📈 Success Rate: ${((workingEndpoints / tests.length) * 100).toFixed(1)}%`);
  
  // NewsData.io verdict
  console.log('\n🔴 NewsData.io Integration Status:');
  if (realTimeWorking) {
    console.log('✅ REAL-TIME NEWS: Working! NewsData.io integration successful');
    console.log('📰 Your production API can deliver real-time news updates');
  } else {
    console.log('❌ REAL-TIME NEWS: Not working properly');
    console.log('📰 Real-time news capabilities are not available');
  }
  
  console.log(`\n🎯 Test completed: ${new Date().toISOString()}`);
  
  return { workingEndpoints, totalTests: tests.length, realTimeWorking };
}

// Run the test
testNewsDataEndpoints().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});