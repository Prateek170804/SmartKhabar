#!/usr/bin/env node

/**
 * Test deployment pipeline
 * Validates that the deployment configuration is working correctly
 */

const https = require('https');
const http = require('http');

async function testEndpoint(url, expectedStatus = 200) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    
    const req = client.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          data: data,
          headers: res.headers
        });
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

async function testDeployment(baseUrl) {
  console.log(`🧪 Testing deployment at: ${baseUrl}\n`);
  
  const endpoints = [
    { path: '/health', name: 'Health Check' },
    { path: '/api/health', name: 'API Health Check' },
    { path: '/api/monitoring/health', name: 'Monitoring Health' },
    { path: '/', name: 'Home Page' }
  ];
  
  const results = [];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`Testing ${endpoint.name}...`);
      const result = await testEndpoint(`${baseUrl}${endpoint.path}`);
      
      const success = result.status >= 200 && result.status < 400;
      console.log(`${success ? '✅' : '❌'} ${endpoint.name}: ${result.status}`);
      
      results.push({
        ...endpoint,
        status: result.status,
        success
      });
      
    } catch (error) {
      console.log(`❌ ${endpoint.name}: Error - ${error.message}`);
      results.push({
        ...endpoint,
        status: 'ERROR',
        success: false,
        error: error.message
      });
    }
  }
  
  console.log('\n📊 Test Results Summary:');
  const passed = results.filter(r => r.success).length;
  const total = results.length;
  
  console.log(`Passed: ${passed}/${total}`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! Deployment is working correctly.');
    return true;
  } else {
    console.log('⚠️  Some tests failed. Check the deployment configuration.');
    return false;
  }
}

function main() {
  const baseUrl = process.argv[2];
  
  if (!baseUrl) {
    console.log('Usage: node scripts/test-deployment.js <base-url>');
    console.log('Example: node scripts/test-deployment.js https://your-app.vercel.app');
    process.exit(1);
  }
  
  testDeployment(baseUrl)
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

if (require.main === module) {
  main();
}

module.exports = { testDeployment, testEndpoint };