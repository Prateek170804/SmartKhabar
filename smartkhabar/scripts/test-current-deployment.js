#!/usr/bin/env node

const https = require('https');

const BASE_URL = 'https://smartkhabar-nw2dfo0xd-prateeks-projects-018799ca.vercel.app';

async function makeRequest(url, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const req = https.get(url, { timeout }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const duration = Date.now() - startTime;
        resolve({
          status: res.statusCode,
          data: data,
          duration: duration,
          headers: res.headers
        });
      });
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.on('error', (err) => {
      reject(err);
    });
  });
}

async function testEndpoint(name, path) {
  console.log(`\n🔍 Testing ${name}...`);
  try {
    const result = await makeRequest(`${BASE_URL}${path}`);
    console.log(`   Status: ${result.status} (${result.duration}ms)`);
    
    if (result.status === 200) {
      console.log(`   ✅ SUCCESS`);
      
      // Try to parse JSON response
      try {
        const jsonData = JSON.parse(result.data);
        if (jsonData.articles) {
          console.log(`   📰 Articles: ${jsonData.articles.length}`);
        }
        if (jsonData.source) {
          console.log(`   🔗 Source: ${jsonData.source}`);
        }
        if (jsonData.success !== undefined) {
          console.log(`   ✨ Success: ${jsonData.success}`);
        }
      } catch (e) {
        // Not JSON, that's fine
        console.log(`   📄 Response length: ${result.data.length} chars`);
      }
    } else {
      console.log(`   ❌ FAILED - Status ${result.status}`);
      
      // Try to get error details
      try {
        const errorData = JSON.parse(result.data);
        if (errorData.error) {
          console.log(`   🔥 Error: ${errorData.error}`);
        }
      } catch (e) {
        console.log(`   🔥 Raw response: ${result.data.substring(0, 200)}`);
      }
    }
    
    return result.status === 200;
  } catch (error) {
    console.log(`   ❌ FAILED - ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🚀 Testing Current Deployment');
  console.log('==============================');
  console.log(`📍 URL: ${BASE_URL}`);
  console.log(`🕐 Started: ${new Date().toISOString()}`);
  
  const tests = [
    ['Health Check', '/api/health'],
    ['Breaking News API', '/api/news/breaking'],
    ['Real-time News API', '/api/news/realtime'],
    ['Free News API', '/api/news/free'],
    ['Database Test', '/api/db-test']
  ];
  
  let successCount = 0;
  const totalTests = tests.length;
  
  for (const [name, path] of tests) {
    const success = await testEndpoint(name, path);
    if (success) successCount++;
  }
  
  console.log('\n📊 Test Results Summary');
  console.log('========================');
  console.log(`✅ Working: ${successCount}/${totalTests}`);
  console.log(`📈 Success Rate: ${((successCount / totalTests) * 100).toFixed(1)}%`);
  
  if (successCount < totalTests) {
    console.log('\n🔴 Issues Found:');
    console.log('❌ Some endpoints are not working properly');
    console.log('📰 News collection capabilities may be limited');
  } else {
    console.log('\n🟢 All Systems Operational!');
    console.log('✨ NewsData.io integration is working correctly');
  }
  
  console.log(`\n🎯 Test completed: ${new Date().toISOString()}`);
}

main().catch(console.error);