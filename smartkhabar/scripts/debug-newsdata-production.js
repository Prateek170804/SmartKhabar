#!/usr/bin/env node

/**
 * Debug NewsData.io Production Issues
 * Diagnoses why the breaking news endpoints are returning 503 errors
 */

const https = require('https');
const { URL } = require('url');

const LATEST_DEPLOYMENT_URL = 'https://smartkhabar-jfvivinwg-prateeks-projects-018799ca.vercel.app';
const NEWSDATA_API_KEY = process.env.NEWSDATA_API_KEY || 'your_newsdata_api_key_here';

async function makeRequest(endpoint, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, LATEST_DEPLOYMENT_URL);
    
    const requestOptions = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SmartKhabar-Debug/1.0',
        ...options.headers
      },
      timeout: 30000 // Longer timeout for debugging
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
            rawData: data,
            headers: res.headers
          });
        } catch (error) {
          resolve({
            status: res.statusCode,
            data: data,
            parseError: error.message,
            rawData: data,
            headers: res.headers
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

async function testNewsDataDirectly() {
  console.log('🔗 Testing NewsData.io API Directly...');
  
  return new Promise((resolve, reject) => {
    const testUrl = `https://newsdata.io/api/1/news?apikey=${NEWSDATA_API_KEY}&language=en&size=1`;
    const url = new URL(testUrl);
    
    const req = https.request(url, { method: 'GET' }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const result = {
            status: res.statusCode,
            data: JSON.parse(data)
          };
          resolve(result);
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
}

async function debugProduction() {
  console.log('🔧 NewsData.io Production Debug');
  console.log('================================');
  console.log(`📍 Deployment: ${LATEST_DEPLOYMENT_URL}`);
  console.log(`🔑 API Key: ${NEWSDATA_API_KEY.substring(0, 10)}...`);
  console.log(`🕐 Started: ${new Date().toISOString()}`);
  
  // Test 1: Direct NewsData.io API
  try {
    console.log('\n1️⃣ Testing NewsData.io API directly...');
    const directTest = await testNewsDataDirectly();
    
    if (directTest.status === 200 && directTest.data.results) {
      console.log('   ✅ NewsData.io API is working');
      console.log(`   📊 Total articles available: ${directTest.data.totalResults}`);
      console.log(`   📄 Sample article: ${directTest.data.results[0]?.title || 'N/A'}`);
    } else {
      console.log('   ❌ NewsData.io API issue');
      console.log(`   Status: ${directTest.status}`);
      console.log(`   Response: ${JSON.stringify(directTest.data, null, 2)}`);
      return;
    }
  } catch (error) {
    console.log(`   💥 Error: ${error.message}`);
    return;
  }
  
  // Test 2: Debug endpoint (if available)
  try {
    console.log('\n2️⃣ Testing debug endpoint...');
    const debugResponse = await makeRequest('/api/debug');
    
    if (debugResponse.status === 200) {
      console.log('   ✅ Debug endpoint working');
      console.log(`   Environment: ${debugResponse.data.environment || 'unknown'}`);
      console.log(`   NewsData Key: ${debugResponse.data.newsDataKey ? 'Present' : 'Missing'}`);
    } else {
      console.log(`   ❌ Debug endpoint failed: ${debugResponse.status}`);
    }
  } catch (error) {
    console.log(`   💥 Debug endpoint error: ${error.message}`);
  }
  
  // Test 3: Breaking news with detailed error info
  try {
    console.log('\n3️⃣ Testing breaking news with error details...');
    const breakingResponse = await makeRequest('/api/news/breaking?limit=1');
    
    console.log(`   Status: ${breakingResponse.status}`);
    console.log(`   Response: ${JSON.stringify(breakingResponse.data, null, 2)}`);
    
    if (breakingResponse.data.fallback) {
      console.log('   📝 Fallback data available');
      console.log(`   Fallback type: ${breakingResponse.data.fallback.type}`);
      console.log(`   Message: ${breakingResponse.data.fallback.message}`);
    }
    
  } catch (error) {
    console.log(`   💥 Breaking news error: ${error.message}`);
  }
  
  // Test 4: Real-time news with detailed error info
  try {
    console.log('\n4️⃣ Testing real-time news with error details...');
    const realtimeResponse = await makeRequest('/api/news/realtime?limit=1&timeframe=1');
    
    console.log(`   Status: ${realtimeResponse.status}`);
    console.log(`   Response: ${JSON.stringify(realtimeResponse.data, null, 2)}`);
    
  } catch (error) {
    console.log(`   💥 Real-time news error: ${error.message}`);
  }
  
  // Test 5: Check environment variables via health endpoint
  try {
    console.log('\n5️⃣ Checking environment configuration...');
    const healthResponse = await makeRequest('/api/health');
    
    if (healthResponse.status === 200) {
      console.log('   ✅ Health check working');
      console.log(`   Environment valid: ${healthResponse.data.environment?.isValid || 'unknown'}`);
      console.log(`   Missing vars: ${JSON.stringify(healthResponse.data.environment?.missing || [])}`);
    }
  } catch (error) {
    console.log(`   💥 Health check error: ${error.message}`);
  }
  
  console.log('\n💡 Diagnosis:');
  console.log('==============');
  console.log('Based on the 503 errors, possible issues:');
  console.log('1. NewsData.io API rate limit exceeded (200 requests/day)');
  console.log('2. Environment variables not properly set in Vercel');
  console.log('3. Network timeout issues in serverless functions');
  console.log('4. NewsData.io API key permissions or quota issues');
  
  console.log('\n🔧 Recommended fixes:');
  console.log('1. Check Vercel environment variables dashboard');
  console.log('2. Verify NewsData.io account status and quota');
  console.log('3. Add error handling and fallback mechanisms');
  console.log('4. Increase serverless function timeout settings');
  
  console.log(`\n🎯 Debug completed: ${new Date().toISOString()}`);
}

// Run the debug
debugProduction().catch(error => {
  console.error('Debug failed:', error);
  process.exit(1);
});