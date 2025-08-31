#!/usr/bin/env node

const https = require('https');

const BASE_URL = 'https://smartkhabar-hx82vqjwg-prateeks-projects-018799ca.vercel.app';

async function makeRequest(url, timeout = 15000) {
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

async function testProductionEndpoints() {
  console.log('🔍 Testing Production News Endpoints');
  console.log('====================================');
  console.log(`📍 URL: ${BASE_URL}`);
  console.log(`🕐 Started: ${new Date().toISOString()}`);
  
  const tests = [
    { name: 'Health Check', path: '/api/health' },
    { name: 'Breaking News', path: '/api/news/breaking?limit=3' },
    { name: 'Real-time News', path: '/api/news/realtime?limit=3' },
    { name: 'Free News', path: '/api/news/free?limit=3' },
    { name: 'Database Test', path: '/api/db-test' }
  ];
  
  for (const test of tests) {
    console.log(`\n🧪 ${test.name}`);
    console.log('----------------------------');
    
    try {
      const result = await makeRequest(`${BASE_URL}${test.path}`);
      console.log(`⏱️  Duration: ${result.duration}ms`);
      console.log(`📊 Status: ${result.status}`);
      
      if (result.status === 200) {
        console.log(`✅ SUCCESS`);
        try {
          const data = JSON.parse(result.data);
          if (data.articles) {
            console.log(`📰 Articles: ${data.articles.length}`);
            console.log(`🔗 Source: ${data.source || 'unknown'}`);
            if (data.articles.length > 0) {
              console.log(`📝 First Article: "${data.articles[0].headline?.substring(0, 50) || data.articles[0].title?.substring(0, 50) || 'No title'}..."`);
            }
          }
          if (data.success !== undefined) {
            console.log(`✨ Success: ${data.success}`);
          }
        } catch (e) {
          console.log(`📄 Response length: ${result.data.length} chars`);
        }
      } else {
        console.log(`❌ FAILED`);
        try {
          const errorData = JSON.parse(result.data);
          console.log(`🔥 Error: ${errorData.error}`);
          if (errorData.fallback) {
            console.log(`🔄 Fallback Type: ${errorData.fallback.type}`);
            console.log(`💬 Fallback Message: ${errorData.fallback.message}`);
          }
        } catch (e) {
          console.log(`🔥 Raw response: ${result.data.substring(0, 200)}`);
        }
      }
      
    } catch (error) {
      console.log(`❌ ERROR: ${error.message}`);
    }
  }
  
  console.log(`\n🎯 Test completed: ${new Date().toISOString()}`);
}

testProductionEndpoints().catch(console.error);