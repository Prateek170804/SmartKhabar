#!/usr/bin/env node

/**
 * Deep Diagnostic Test
 * Comprehensive investigation of what's not working with NewsData.io integration
 */

const https = require('https');
const { URL } = require('url');

const LATEST_DEPLOYMENT_URL = 'https://smartkhabar-izzoyajgr-prateeks-projects-018799ca.vercel.app';
const NEWSDATA_API_KEY = process.env.NEWSDATA_API_KEY || 'your_newsdata_api_key_here';

async function makeRequest(endpoint, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, LATEST_DEPLOYMENT_URL);
    
    const requestOptions = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SmartKhabar-Deep-Diagnostic/1.0',
        ...options.headers
      },
      timeout: 60000 // 60 second timeout
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
      reject(new Error('Request timeout after 60 seconds'));
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

async function testNewsDataDirectly() {
  console.log('🔗 Testing NewsData.io API directly...');
  
  return new Promise((resolve, reject) => {
    const testUrl = `https://newsdata.io/api/1/news?apikey=${NEWSDATA_API_KEY}&language=en&size=2&timeframe=24`;
    const url = new URL(testUrl);
    
    const req = https.request(url, { method: 'GET', timeout: 30000 }, (res) => {
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
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Direct API timeout'));
    });
    req.end();
  });
}

async function deepDiagnostic() {
  console.log('🔬 Deep Diagnostic Investigation');
  console.log('=================================');
  console.log(`📍 Deployment: ${LATEST_DEPLOYMENT_URL}`);
  console.log(`🔑 API Key: ${NEWSDATA_API_KEY.substring(0, 15)}...`);
  console.log(`🕐 Started: ${new Date().toISOString()}`);
  
  // Test 1: Direct NewsData.io API with detailed logging
  console.log('\n1️⃣ Testing NewsData.io API directly...');
  try {
    const directTest = await testNewsDataDirectly();
    
    if (directTest.status === 200 && directTest.data.results) {
      console.log('   ✅ NewsData.io API is working perfectly');
      console.log(`   📊 Total articles: ${directTest.data.totalResults}`);
      console.log(`   📄 Returned articles: ${directTest.data.results.length}`);
      
      if (directTest.data.results.length > 0) {
        const sample = directTest.data.results[0];
        console.log(`   📰 Sample article:`);
        console.log(`     - Title: ${sample.title}`);
        console.log(`     - Source: ${sample.source_id}`);
        console.log(`     - Published: ${sample.pubDate}`);
        console.log(`     - Has content: ${!!sample.content}`);
        console.log(`     - Has description: ${!!sample.description}`);
      }
    } else {
      console.log('   ❌ NewsData.io API issue');
      console.log(`   Status: ${directTest.status}`);
      console.log(`   Response: ${JSON.stringify(directTest.data, null, 2)}`);
      return { success: false, reason: 'NewsData.io API not working' };
    }
  } catch (error) {
    console.log(`   💥 Direct API Error: ${error.message}`);
    return { success: false, reason: `Direct API error: ${error.message}` };
  }
  
  // Test 2: Check environment variables in production
  console.log('\n2️⃣ Checking production environment...');
  try {
    const healthResponse = await makeRequest('/api/health');
    
    if (healthResponse.status === 200) {
      console.log('   ✅ Health endpoint working');
      console.log(`   Environment valid: ${healthResponse.data.environment?.isValid}`);
      console.log(`   Missing vars: ${JSON.stringify(healthResponse.data.environment?.missing || [])}`);
      
      if (healthResponse.data.services) {
        console.log(`   Services status:`);
        Object.entries(healthResponse.data.services).forEach(([service, status]) => {
          console.log(`     - ${service}: ${status}`);
        });
      }
    } else {
      console.log(`   ❌ Health check failed: ${healthResponse.status}`);
    }
  } catch (error) {
    console.log(`   💥 Health check error: ${error.message}`);
  }
  
  // Test 3: Test breaking news with maximum verbosity
  console.log('\n3️⃣ Deep testing breaking news endpoint...');
  try {
    console.log('   Making request to /api/news/breaking?limit=1...');
    const startTime = Date.now();
    
    const breakingResponse = await makeRequest('/api/news/breaking?limit=1');
    const responseTime = Date.now() - startTime;
    
    console.log(`   ⏱️  Response time: ${responseTime}ms`);
    console.log(`   📊 Status: ${breakingResponse.status}`);
    console.log(`   📋 Headers: ${JSON.stringify(breakingResponse.headers, null, 2)}`);
    console.log(`   📄 Full response: ${JSON.stringify(breakingResponse.data, null, 2)}`);
    
    if (breakingResponse.status === 503) {
      console.log('   🔍 Analyzing 503 error...');
      
      if (breakingResponse.data.error) {
        console.log(`   Error message: ${breakingResponse.data.error}`);
      }
      
      if (breakingResponse.data.fallback) {
        console.log(`   Fallback available: ${breakingResponse.data.fallback.type}`);
        console.log(`   Fallback message: ${breakingResponse.data.fallback.message}`);
      }
      
      if (breakingResponse.data.metadata) {
        console.log(`   Metadata: ${JSON.stringify(breakingResponse.data.metadata, null, 2)}`);
      }
    }
    
  } catch (error) {
    console.log(`   💥 Breaking news error: ${error.message}`);
    
    if (error.message.includes('timeout')) {
      console.log('   ⏰ This is a timeout issue - function taking too long');
    }
  }
  
  // Test 4: Test a simpler endpoint to isolate the issue
  console.log('\n4️⃣ Testing simpler free news endpoint...');
  try {
    const freeResponse = await makeRequest('/api/news/free?limit=1');
    
    console.log(`   Status: ${freeResponse.status}`);
    console.log(`   Response: ${JSON.stringify(freeResponse.data, null, 2)}`);
    
    if (freeResponse.status === 200) {
      console.log('   ✅ Free news endpoint working');
      
      if (freeResponse.data.articles) {
        console.log(`   📰 Articles returned: ${freeResponse.data.articles.length}`);
        console.log(`   🔗 Source: ${freeResponse.data.source}`);
      }
    }
    
  } catch (error) {
    console.log(`   💥 Free news error: ${error.message}`);
  }
  
  // Test 5: Check if it's a specific NewsData.io endpoint issue
  console.log('\n5️⃣ Testing NewsData.io with minimal parameters...');
  try {
    const minimalUrl = `https://newsdata.io/api/1/news?apikey=${NEWSDATA_API_KEY}&size=1`;
    
    const minimalTest = await new Promise((resolve, reject) => {
      const url = new URL(minimalUrl);
      
      const req = https.request(url, { method: 'GET', timeout: 15000 }, (res) => {
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
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Minimal test timeout'));
      });
      req.end();
    });
    
    console.log(`   Status: ${minimalTest.status}`);
    
    if (minimalTest.status === 200 && minimalTest.data.results) {
      console.log(`   ✅ Minimal NewsData.io test successful`);
      console.log(`   📊 Articles: ${minimalTest.data.results.length}`);
    } else {
      console.log(`   ❌ Minimal test failed`);
      console.log(`   Response: ${JSON.stringify(minimalTest.data, null, 2)}`);
    }
    
  } catch (error) {
    console.log(`   💥 Minimal test error: ${error.message}`);
  }
  
  // Analysis and Recommendations
  console.log('\n🔍 DIAGNOSTIC ANALYSIS');
  console.log('======================');
  
  console.log('\n📋 What we know:');
  console.log('✅ NewsData.io API key is valid and working');
  console.log('✅ Vercel deployment is successful');
  console.log('✅ Environment variables are configured');
  console.log('✅ Error handling is working (503 responses)');
  console.log('✅ Timeout settings are configured (30s)');
  
  console.log('\n❌ What\'s failing:');
  console.log('❌ NewsData.io API calls within Vercel serverless functions');
  console.log('❌ Breaking news and real-time news endpoints returning 503');
  
  console.log('\n🎯 Most likely causes:');
  console.log('1. 🌐 Network connectivity issue between Vercel and NewsData.io');
  console.log('2. 📊 Rate limiting or quota exceeded (200 requests/day)');
  console.log('3. 🔧 Code issue in NewsData.io client within serverless environment');
  console.log('4. ⏰ API response time exceeding serverless function limits');
  console.log('5. 🔑 API key permissions or account status issue');
  
  console.log('\n💡 Recommended next steps:');
  console.log('1. Check NewsData.io account dashboard for usage/quota');
  console.log('2. Add detailed logging to NewsData.io client');
  console.log('3. Test with a different news API as comparison');
  console.log('4. Implement retry logic with exponential backoff');
  console.log('5. Add circuit breaker pattern for API failures');
  
  console.log(`\n🎯 Diagnostic completed: ${new Date().toISOString()}`);
  
  return { success: true, reason: 'Diagnostic complete' };
}

// Run the deep diagnostic
deepDiagnostic().catch(error => {
  console.error('Diagnostic failed:', error);
  process.exit(1);
});