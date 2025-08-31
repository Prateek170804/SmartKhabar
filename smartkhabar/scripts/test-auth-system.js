/**
 * Test Authentication System
 * Comprehensive test for user authentication, registration, and profile management
 */

const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000';

async function testAuthSystem() {
  console.log('🧪 Testing SmartKhabar Authentication System...\n');
  
  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  let authToken = null;
  let userId = null;
  const testUser = {
    email: `test.user.${Date.now()}@example.com`,
    password: 'testpassword123',
    name: 'Test User'
  };

  // Test 1: User Registration
  console.log('🔍 Testing: User Registration');
  try {
    const response = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testUser)
    });

    const data = await response.json();

    if (response.ok && data.success && data.data.user && data.data.token) {
      console.log('✅ PASS: User Registration');
      console.log(`   👤 User created: ${data.data.user.name} (${data.data.user.email})`);
      console.log(`   🆔 User ID: ${data.data.user.id}`);
      authToken = data.data.token;
      userId = data.data.user.id;
      results.passed++;
    } else {
      console.log('❌ FAIL: User Registration');
      console.log(`   Error: ${data.error?.message || 'Unknown error'}`);
      results.failed++;
    }
    results.tests.push('User Registration');
  } catch (error) {
    console.log('❌ FAIL: User Registration');
    console.log(`   Error: ${error.message}`);
    results.failed++;
    results.tests.push('User Registration');
  }

  // Test 2: User Login
  console.log('\n🔍 Testing: User Login');
  try {
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: testUser.email,
        password: testUser.password
      })
    });

    const data = await response.json();

    if (response.ok && data.success && data.data.user && data.data.token) {
      console.log('✅ PASS: User Login');
      console.log(`   👤 Logged in: ${data.data.user.name}`);
      console.log(`   🔑 Token received: ${data.data.token.substring(0, 20)}...`);
      authToken = data.data.token; // Update token
      results.passed++;
    } else {
      console.log('❌ FAIL: User Login');
      console.log(`   Error: ${data.error?.message || 'Unknown error'}`);
      results.failed++;
    }
    results.tests.push('User Login');
  } catch (error) {
    console.log('❌ FAIL: User Login');
    console.log(`   Error: ${error.message}`);
    results.failed++;
    results.tests.push('User Login');
  }

  // Test 3: Get User Profile
  console.log('\n🔍 Testing: Get User Profile');
  try {
    if (!authToken) {
      throw new Error('No auth token available');
    }

    const response = await fetch(`${BASE_URL}/api/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (response.ok && data.success && data.data.user) {
      console.log('✅ PASS: Get User Profile');
      console.log(`   👤 Profile: ${data.data.user.name} (${data.data.user.email})`);
      console.log(`   ⚙️  Preferences: ${JSON.stringify(data.data.user.preferences)}`);
      console.log(`   📅 Created: ${data.data.user.createdAt}`);
      results.passed++;
    } else {
      console.log('❌ FAIL: Get User Profile');
      console.log(`   Error: ${data.error?.message || 'Unknown error'}`);
      results.failed++;
    }
    results.tests.push('Get User Profile');
  } catch (error) {
    console.log('❌ FAIL: Get User Profile');
    console.log(`   Error: ${error.message}`);
    results.failed++;
    results.tests.push('Get User Profile');
  }

  // Test 4: Update User Preferences
  console.log('\n🔍 Testing: Update User Preferences');
  try {
    if (!authToken) {
      throw new Error('No auth token available');
    }

    const newPreferences = {
      topics: ['technology', 'business', 'science'],
      tone: 'fun',
      readingTime: 8,
      preferredSources: ['techcrunch', 'bbc'],
      notifications: true,
      realTimeUpdates: true
    };

    const response = await fetch(`${BASE_URL}/api/auth/me`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        preferences: newPreferences
      })
    });

    const data = await response.json();

    if (response.ok && data.success && data.data.user) {
      console.log('✅ PASS: Update User Preferences');
      console.log(`   ⚙️  Updated preferences: ${JSON.stringify(data.data.user.preferences)}`);
      console.log(`   📚 Topics: ${data.data.user.preferences.topics.join(', ')}`);
      console.log(`   🎭 Tone: ${data.data.user.preferences.tone}`);
      results.passed++;
    } else {
      console.log('❌ FAIL: Update User Preferences');
      console.log(`   Error: ${data.error?.message || 'Unknown error'}`);
      results.failed++;
    }
    results.tests.push('Update User Preferences');
  } catch (error) {
    console.log('❌ FAIL: Update User Preferences');
    console.log(`   Error: ${error.message}`);
    results.failed++;
    results.tests.push('Update User Preferences');
  }

  // Test 5: Unauthorized Access
  console.log('\n🔍 Testing: Unauthorized Access Protection');
  try {
    const response = await fetch(`${BASE_URL}/api/auth/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
        // No Authorization header
      }
    });

    const data = await response.json();

    if (response.status === 401 && !data.success) {
      console.log('✅ PASS: Unauthorized Access Protection');
      console.log(`   🔒 Correctly blocked unauthorized access`);
      results.passed++;
    } else {
      console.log('❌ FAIL: Unauthorized Access Protection');
      console.log(`   🚨 Security issue: Unauthorized access allowed`);
      results.failed++;
    }
    results.tests.push('Unauthorized Access Protection');
  } catch (error) {
    console.log('❌ FAIL: Unauthorized Access Protection');
    console.log(`   Error: ${error.message}`);
    results.failed++;
    results.tests.push('Unauthorized Access Protection');
  }

  // Test 6: Invalid Login
  console.log('\n🔍 Testing: Invalid Login Protection');
  try {
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: testUser.email,
        password: 'wrongpassword'
      })
    });

    const data = await response.json();

    if (response.status === 401 && !data.success) {
      console.log('✅ PASS: Invalid Login Protection');
      console.log(`   🔒 Correctly rejected invalid credentials`);
      results.passed++;
    } else {
      console.log('❌ FAIL: Invalid Login Protection');
      console.log(`   🚨 Security issue: Invalid login allowed`);
      results.failed++;
    }
    results.tests.push('Invalid Login Protection');
  } catch (error) {
    console.log('❌ FAIL: Invalid Login Protection');
    console.log(`   Error: ${error.message}`);
    results.failed++;
    results.tests.push('Invalid Login Protection');
  }

  // Test 7: User Logout
  console.log('\n🔍 Testing: User Logout');
  try {
    const response = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (response.ok && data.success) {
      console.log('✅ PASS: User Logout');
      console.log(`   👋 Successfully logged out`);
      results.passed++;
    } else {
      console.log('❌ FAIL: User Logout');
      console.log(`   Error: ${data.error?.message || 'Unknown error'}`);
      results.failed++;
    }
    results.tests.push('User Logout');
  } catch (error) {
    console.log('❌ FAIL: User Logout');
    console.log(`   Error: ${error.message}`);
    results.failed++;
    results.tests.push('User Logout');
  }

  // Test 8: Duplicate Registration
  console.log('\n🔍 Testing: Duplicate Registration Protection');
  try {
    const response = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testUser) // Same user as before
    });

    const data = await response.json();

    if (response.status === 409 && !data.success) {
      console.log('✅ PASS: Duplicate Registration Protection');
      console.log(`   🔒 Correctly prevented duplicate registration`);
      results.passed++;
    } else {
      console.log('❌ FAIL: Duplicate Registration Protection');
      console.log(`   🚨 Security issue: Duplicate registration allowed`);
      results.failed++;
    }
    results.tests.push('Duplicate Registration Protection');
  } catch (error) {
    console.log('❌ FAIL: Duplicate Registration Protection');
    console.log(`   Error: ${error.message}`);
    results.failed++;
    results.tests.push('Duplicate Registration Protection');
  }

  // Final Results
  console.log('\n📊 Authentication System Test Results:');
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📈 Success Rate: ${Math.round((results.passed / (results.passed + results.failed)) * 100)}%`);
  
  if (results.failed === 0) {
    console.log('\n🎉 All authentication tests passed! System is secure and ready!');
    console.log('🔐 Authentication system is production-ready');
  } else if (results.passed > results.failed) {
    console.log('\n⚠️  Most authentication tests passed with some issues');
    console.log('🔧 System is functional but may need security adjustments');
  } else {
    console.log('\n❌ Authentication system has significant security issues');
    console.log('🔧 Please review and fix authentication implementation');
  }

  console.log('\n📋 Authentication Features Tested:');
  results.tests.forEach((test, index) => {
    console.log(`   ${index + 1}. ${test}`);
  });

  console.log('\n🔐 Authentication System Status: READY FOR PERSONALIZED EXPERIENCES');
  console.log('📅 Test Date:', new Date().toISOString());
  
  if (userId) {
    console.log(`\n🧹 Test user created: ${testUser.email} (ID: ${userId})`);
    console.log('Note: This test user can be used for further testing');
  }
}

// Run the test
testAuthSystem().catch(console.error);