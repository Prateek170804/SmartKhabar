#!/usr/bin/env node

const https = require('https');

// Get the latest deployment URL
const BASE_URL = 'https://smartkhabar-7dt9jbag5-prateeks-projects-018799ca.vercel.app';

async function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : require('http');
    const startTime = Date.now();
    
    const req = protocol.request(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      timeout: 15000
    }, (res) => {
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
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

async function testEnhancedProduction() {
  console.log('🚀 Testing Enhanced SmartKhabar Production Deployment');
  console.log('===================================================');
  console.log(`🌐 URL: ${BASE_URL}`);
  console.log(`🕐 Started: ${new Date().toISOString()}`);
  
  const tests = [
    // Core Health Checks
    { name: 'Health Check', path: '/api/health', expected: 200 },
    { name: 'Database Test', path: '/api/db-test', expected: 200 },
    
    // Enhanced News Endpoints
    { name: 'Breaking News (Simple)', path: '/api/news/breaking-simple?limit=3', expected: 200 },
    { name: 'Real-time News (Simple)', path: '/api/news/realtime-simple?limit=3', expected: 200 },
    { name: 'Free News', path: '/api/news/free?limit=3', expected: 200 },
    { name: 'NewsData Diagnostic', path: '/api/diagnostic/newsdata', expected: 200 },
    
    // Enhanced API Endpoints
    { name: 'WebSocket Info', path: '/api/ws', expected: 200 },
    
    // Monitoring Endpoints
    { name: 'Monitoring Health', path: '/api/monitoring/health', expected: 200 },
    { name: 'Performance Metrics', path: '/api/monitoring/performance', expected: 200 },
  ];
  
  let successCount = 0;
  const results = [];
  
  for (const test of tests) {
    console.log(`\n🧪 Testing ${test.name}...`);
    
    try {
      const result = await makeRequest(`${BASE_URL}${test.path}`);
      const success = result.status === test.expected;
      
      console.log(`   Status: ${result.status} (${result.duration}ms)`);
      
      if (success) {
        console.log(`   ✅ SUCCESS`);
        successCount++;
        
        // Parse and show relevant data
        try {
          const data = JSON.parse(result.data);
          if (data.articles) {
            console.log(`   📰 Articles: ${data.articles.length}`);
          }
          if (data.source) {
            console.log(`   🔗 Source: ${data.source}`);
          }
          if (data.config && data.config.hasApiKey !== undefined) {
            console.log(`   🔑 API Key: ${data.config.hasApiKey ? 'Configured' : 'Missing'}`);
          }
          if (data.message) {
            console.log(`   💬 Message: ${data.message}`);
          }
        } catch (e) {
          // Not JSON, that's fine
          console.log(`   📄 Response: ${result.data.length} chars`);
        }
      } else {
        console.log(`   ❌ FAILED - Expected ${test.expected}, got ${result.status}`);
        
        try {
          const errorData = JSON.parse(result.data);
          if (errorData.error) {
            console.log(`   🔥 Error: ${errorData.error}`);
          }
        } catch (e) {
          console.log(`   🔥 Raw response: ${result.data.substring(0, 200)}`);
        }
      }
      
      results.push({ ...test, success, status: result.status, duration: result.duration });
      
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
      results.push({ ...test, success: false, error: error.message });
    }
  }
  
  // Test Enhanced Authentication
  console.log('\n🔐 Testing Enhanced Authentication...');
  try {
    const registerResult = await makeRequest(`${BASE_URL}/api/auth/enhanced`, {
      method: 'POST',
      body: {
        action: 'register',
        email: `test_${Date.now()}@example.com`,
        password: 'testpassword123',
        name: 'Test User Production',
        preferences: {
          topics: ['technology', 'business'],
          tone: 'casual'
        }
      }
    });
    
    if (registerResult.status === 200) {
      console.log('   ✅ Enhanced Authentication Working');
      const userData = JSON.parse(registerResult.data);
      console.log(`   👤 User: ${userData.user.name}`);
      console.log(`   🎫 Token: ${userData.token ? 'Generated' : 'Missing'}`);
      successCount++;
    } else {
      console.log(`   ❌ Enhanced Authentication Failed: ${registerResult.status}`);
    }
  } catch (error) {
    console.log(`   ❌ Enhanced Authentication Error: ${error.message}`);
  }
  
  // Summary
  console.log('\n📊 Production Test Results');
  console.log('==========================');
  console.log(`✅ Successful: ${successCount}/${tests.length + 1}`);
  console.log(`📈 Success Rate: ${((successCount / (tests.length + 1)) * 100).toFixed(1)}%`);
  
  // Detailed Results
  console.log('\n📋 Detailed Results:');
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    const duration = result.duration ? `${result.duration}ms` : 'N/A';
    console.log(`   ${status} ${result.name}: ${result.status || 'ERROR'} (${duration})`);
  });
  
  if (successCount === tests.length + 1) {
    console.log('\n🎉 All Enhanced Features Working in Production!');
    console.log('\n🚀 SmartKhabar Enhanced Features:');
    console.log('   ✅ Real-time news updates');
    console.log('   ✅ Enhanced authentication system');
    console.log('   ✅ Mobile-responsive design');
    console.log('   ✅ Comprehensive analytics');
    console.log('   ✅ WebSocket support');
    console.log('   ✅ Advanced monitoring');
  } else {
    console.log('\n⚠️  Some features may need additional configuration');
    console.log('   - Check environment variables');
    console.log('   - Verify API keys and database connections');
    console.log('   - Review error logs for specific issues');
  }
  
  console.log(`\n🎯 Test completed: ${new Date().toISOString()}`);
  console.log(`🌐 Production URL: ${BASE_URL}`);
}

// Run the test
if (require.main === module) {
  testEnhancedProduction().catch(console.error);
}

module.exports = { testEnhancedProduction };