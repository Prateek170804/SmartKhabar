#!/usr/bin/env node

const https = require('https');

const BASE_URL = 'https://smartkhabar-mbtl8fpdw-prateeks-projects-018799ca.vercel.app';

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

async function testDiagnosticEndpoint() {
  console.log('🔍 Testing NewsData Diagnostic Endpoint');
  console.log('=======================================');
  console.log(`📍 URL: ${BASE_URL}`);
  console.log(`🕐 Started: ${new Date().toISOString()}`);
  
  const tests = [
    { name: 'Basic Test', path: '/api/diagnostic/newsdata' },
    { name: 'Breaking News Test', path: '/api/diagnostic/newsdata?test=breaking' },
    { name: 'Category Test', path: '/api/diagnostic/newsdata?test=category' }
  ];
  
  for (const test of tests) {
    console.log(`\n🧪 ${test.name}`);
    console.log('----------------------------');
    
    try {
      const result = await makeRequest(`${BASE_URL}${test.path}`);
      console.log(`⏱️  Duration: ${result.duration}ms`);
      console.log(`📊 Status: ${result.status}`);
      
      if (result.status === 200) {
        const data = JSON.parse(result.data);
        console.log(`✅ SUCCESS`);
        console.log(`🔧 Test Type: ${data.test}`);
        console.log(`⚙️  Has API Key: ${data.config.hasApiKey}`);
        console.log(`🔑 API Key Length: ${data.config.apiKeyLength}`);
        console.log(`🌍 Environment: ${data.config.environment}`);
        
        if (data.result) {
          console.log(`📰 Total Results: ${data.result.totalResults}`);
          console.log(`📄 Articles Returned: ${data.result.articlesReturned}`);
          console.log(`📝 First Article: ${data.result.firstArticleTitle}`);
          console.log(`🔗 Source: ${data.result.firstArticleSource}`);
        }
      } else {
        console.log(`❌ FAILED`);
        try {
          const errorData = JSON.parse(result.data);
          console.log(`🔥 Error: ${errorData.error}`);
          if (errorData.config) {
            console.log(`⚙️  Has API Key: ${errorData.config.hasApiKey}`);
            console.log(`🔑 API Key Length: ${errorData.config.apiKeyLength}`);
            console.log(`🌍 Environment: ${errorData.config.environment}`);
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

testDiagnosticEndpoint().catch(console.error);