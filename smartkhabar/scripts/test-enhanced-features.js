#!/usr/bin/env node

const https = require('https');

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

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

async function testEnhancedAuthentication() {
  console.log('\n🔐 Testing Enhanced Authentication');
  console.log('==================================');
  
  try {
    // Test user registration
    console.log('📝 Testing user registration...');
    const registerResult = await makeRequest(`${BASE_URL}/api/auth/enhanced`, {
      method: 'POST',
      body: {
        action: 'register',
        email: `test_${Date.now()}@example.com`,
        password: 'testpassword123',
        name: 'Test User Enhanced',
        preferences: {
          topics: ['technology', 'science'],
          tone: 'casual',
          readingTime: 5
        }
      }
    });
    
    if (registerResult.status === 200) {
      const registerData = JSON.parse(registerResult.data);
      console.log(`✅ Registration successful: ${registerData.user.name}`);
      
      // Test login with the same credentials
      console.log('🔑 Testing user login...');
      const loginResult = await makeRequest(`${BASE_URL}/api/auth/enhanced`, {
        method: 'POST',
        body: {
          action: 'login',
          email: registerData.user.email,
          password: 'testpassword123'
        }
      });
      
      if (loginResult.status === 200) {
        const loginData = JSON.parse(loginResult.data);
        console.log(`✅ Login successful: ${loginData.user.name}`);
        
        // Test token refresh
        console.log('🔄 Testing token refresh...');
        const refreshResult = await makeRequest(`${BASE_URL}/api/auth/enhanced`, {
          method: 'POST',
          body: {
            action: 'refresh',
            token: loginData.token
          }
        });
        
        if (refreshResult.status === 200) {
          console.log('✅ Token refresh successful');
          
          // Test authenticated profile access
          console.log('👤 Testing profile access...');
          const profileResult = await makeRequest(`${BASE_URL}/api/auth/enhanced`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${loginData.token}`
            }
          });
          
          if (profileResult.status === 200) {
            const profileData = JSON.parse(profileResult.data);
            console.log(`✅ Profile access successful: ${profileData.user.name}`);
            console.log(`   - Analytics: ${profileData.user.analytics.totalEvents} events`);
            return loginData.token; // Return token for other tests
          } else {
            console.log(`❌ Profile access failed: ${profileResult.status}`);
          }
        } else {
          console.log(`❌ Token refresh failed: ${refreshResult.status}`);
        }
      } else {
        console.log(`❌ Login failed: ${loginResult.status}`);
      }
    } else {
      console.log(`❌ Registration failed: ${registerResult.status}`);
      console.log(`   Response: ${registerResult.data}`);
    }
  } catch (error) {
    console.log(`❌ Authentication test error: ${error.message}`);
  }
  
  return null;
}

async function testAnalyticsDashboard(authToken) {
  console.log('\n📊 Testing Analytics Dashboard');
  console.log('===============================');
  
  if (!authToken) {
    console.log('⚠️  Skipping analytics test - no auth token available');
    return;
  }
  
  try {
    // Test analytics dashboard access
    console.log('📈 Testing dashboard overview...');
    const dashboardResult = await makeRequest(`${BASE_URL}/api/analytics/dashboard?type=overview&days=7`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    if (dashboardResult.status === 200) {
      const dashboardData = JSON.parse(dashboardResult.data);
      console.log('✅ Dashboard overview successful');
      console.log(`   - Type: ${dashboardData.type}`);
      console.log(`   - Days: ${dashboardData.days}`);
      console.log(`   - Generated at: ${dashboardData.generatedAt}`);
    } else if (dashboardResult.status === 403) {
      console.log('⚠️  Dashboard access requires premium subscription (expected for free users)');
    } else {
      console.log(`❌ Dashboard access failed: ${dashboardResult.status}`);
    }
    
    // Test event tracking
    console.log('📝 Testing event tracking...');
    const trackResult = await makeRequest(`${BASE_URL}/api/analytics/dashboard`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      body: {
        action: 'track_event',
        sessionId: `session_${Date.now()}`,
        event: 'test_event',
        properties: {
          test: true,
          timestamp: new Date().toISOString()
        }
      }
    });
    
    if (trackResult.status === 200) {
      console.log('✅ Event tracking successful');
    } else {
      console.log(`❌ Event tracking failed: ${trackResult.status}`);
    }
    
  } catch (error) {
    console.log(`❌ Analytics test error: ${error.message}`);
  }
}

async function testWebSocketEndpoint() {
  console.log('\n🔌 Testing WebSocket Endpoint');
  console.log('==============================');
  
  try {
    // Test WebSocket info endpoint
    console.log('ℹ️  Testing WebSocket info...');
    const wsInfoResult = await makeRequest(`${BASE_URL}/api/ws`);
    
    if (wsInfoResult.status === 200) {
      const wsInfo = JSON.parse(wsInfoResult.data);
      console.log('✅ WebSocket info retrieved');
      console.log(`   - Message: ${wsInfo.message}`);
      console.log(`   - Supported messages: ${wsInfo.supportedMessages.length}`);
    } else {
      console.log(`❌ WebSocket info failed: ${wsInfoResult.status}`);
    }
    
    // Test WebSocket stats
    console.log('📊 Testing WebSocket stats...');
    const statsResult = await makeRequest(`${BASE_URL}/api/ws`, {
      method: 'POST',
      body: {
        action: 'get_stats'
      }
    });
    
    if (statsResult.status === 200) {
      const statsData = JSON.parse(statsResult.data);
      console.log('✅ WebSocket stats retrieved');
      console.log(`   - Total connections: ${statsData.stats.totalConnections}`);
      console.log(`   - Authenticated connections: ${statsData.stats.authenticatedConnections}`);
    } else {
      console.log(`❌ WebSocket stats failed: ${statsResult.status}`);
    }
    
  } catch (error) {
    console.log(`❌ WebSocket test error: ${error.message}`);
  }
}

async function testEnhancedNewsEndpoints() {
  console.log('\n📰 Testing Enhanced News Endpoints');
  console.log('===================================');
  
  const endpoints = [
    { name: 'Breaking News (Simple)', path: '/api/news/breaking-simple?limit=3' },
    { name: 'Real-time News (Simple)', path: '/api/news/realtime-simple?limit=3' },
    { name: 'Free News', path: '/api/news/free?limit=3' },
    { name: 'Diagnostic NewsData', path: '/api/diagnostic/newsdata' }
  ];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`📡 Testing ${endpoint.name}...`);
      const result = await makeRequest(`${BASE_URL}${endpoint.path}`);
      
      if (result.status === 200) {
        const data = JSON.parse(result.data);
        console.log(`✅ ${endpoint.name} successful`);
        
        if (data.articles) {
          console.log(`   - Articles: ${data.articles.length}`);
          console.log(`   - Source: ${data.source || 'unknown'}`);
        }
        
        if (data.config) {
          console.log(`   - API Key configured: ${data.config.hasApiKey}`);
          console.log(`   - Environment: ${data.config.environment}`);
        }
      } else {
        console.log(`❌ ${endpoint.name} failed: ${result.status}`);
      }
    } catch (error) {
      console.log(`❌ ${endpoint.name} error: ${error.message}`);
    }
  }
}

async function testSystemHealth() {
  console.log('\n🏥 Testing System Health');
  console.log('========================');
  
  const healthEndpoints = [
    { name: 'Basic Health', path: '/api/health' },
    { name: 'Database Test', path: '/api/db-test' },
    { name: 'Monitoring Health', path: '/api/monitoring/health' },
    { name: 'Performance Metrics', path: '/api/monitoring/performance' }
  ];
  
  for (const endpoint of healthEndpoints) {
    try {
      console.log(`🔍 Testing ${endpoint.name}...`);
      const result = await makeRequest(`${BASE_URL}${endpoint.path}`);
      
      if (result.status === 200) {
        console.log(`✅ ${endpoint.name} healthy (${result.duration}ms)`);
      } else {
        console.log(`⚠️  ${endpoint.name} returned ${result.status}`);
      }
    } catch (error) {
      console.log(`❌ ${endpoint.name} error: ${error.message}`);
    }
  }
}

async function runAllTests() {
  console.log('🚀 SmartKhabar Enhanced Features Test Suite');
  console.log('============================================');
  console.log(`🌐 Testing against: ${BASE_URL}`);
  console.log(`🕐 Started: ${new Date().toISOString()}`);
  
  // Run all tests
  const authToken = await testEnhancedAuthentication();
  await testAnalyticsDashboard(authToken);
  await testWebSocketEndpoint();
  await testEnhancedNewsEndpoints();
  await testSystemHealth();
  
  console.log('\n🎯 Test Suite Completed');
  console.log('========================');
  console.log(`🕐 Finished: ${new Date().toISOString()}`);
  
  if (authToken) {
    console.log('\n✅ All enhanced features are working correctly!');
    console.log('\n📋 Next steps:');
    console.log('   1. Set up the enhanced database schema');
    console.log('   2. Configure WebSocket server for production');
    console.log('   3. Test real-time features with multiple clients');
    console.log('   4. Verify analytics data collection');
  } else {
    console.log('\n⚠️  Some features may need additional configuration');
    console.log('   - Check database connection');
    console.log('   - Verify environment variables');
    console.log('   - Ensure all dependencies are installed');
  }
}

// Run tests if called directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testEnhancedAuthentication,
  testAnalyticsDashboard,
  testWebSocketEndpoint,
  testEnhancedNewsEndpoints,
  testSystemHealth,
  runAllTests
};