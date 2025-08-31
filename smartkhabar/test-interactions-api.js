/**
 * Test script for the user interaction tracking API
 * This script tests the /api/interactions endpoint functionality
 */

const API_BASE = 'http://localhost:3000';

async function testInteractionsAPI() {
  console.log('🧪 Testing User Interaction Tracking API...\n');

  try {
    // Test 1: Track a single interaction
    console.log('1. Testing single interaction tracking...');
    const singleInteractionResponse = await fetch(`${API_BASE}/api/interactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: 'test-user-123',
        articleId: 'article-456',
        action: 'read_more',
      }),
    });

    const singleResult = await singleInteractionResponse.json();
    console.log('✅ Single interaction response:', JSON.stringify(singleResult, null, 2));

    // Test 2: Track batch interactions
    console.log('\n2. Testing batch interaction tracking...');
    const batchInteractionResponse = await fetch(`${API_BASE}/api/interactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: 'test-user-123',
        interactions: [
          {
            userId: 'test-user-123',
            articleId: 'article-789',
            action: 'like',
          },
          {
            userId: 'test-user-123',
            articleId: 'article-101',
            action: 'share',
          },
        ],
      }),
    });

    const batchResult = await batchInteractionResponse.json();
    console.log('✅ Batch interaction response:', JSON.stringify(batchResult, null, 2));

    // Test 3: Get basic analytics
    console.log('\n3. Testing basic analytics...');
    const basicAnalyticsResponse = await fetch(
      `${API_BASE}/api/interactions?userId=test-user-123`
    );

    const basicAnalytics = await basicAnalyticsResponse.json();
    console.log('✅ Basic analytics response:', JSON.stringify(basicAnalytics, null, 2));

    // Test 4: Get detailed analytics
    console.log('\n4. Testing detailed analytics...');
    const detailedAnalyticsResponse = await fetch(
      `${API_BASE}/api/interactions?userId=test-user-123&type=detailed`
    );

    const detailedAnalytics = await detailedAnalyticsResponse.json();
    console.log('✅ Detailed analytics response:', JSON.stringify(detailedAnalytics, null, 2));

    // Test 5: Test validation errors
    console.log('\n5. Testing validation errors...');
    const invalidResponse = await fetch(`${API_BASE}/api/interactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: 'test-user-123',
        // Missing articleId and action
      }),
    });

    const invalidResult = await invalidResponse.json();
    console.log('✅ Validation error response:', JSON.stringify(invalidResult, null, 2));

    // Test 6: Test missing userId in analytics
    console.log('\n6. Testing missing userId in analytics...');
    const missingUserResponse = await fetch(`${API_BASE}/api/interactions`);
    const missingUserResult = await missingUserResponse.json();
    console.log('✅ Missing userId response:', JSON.stringify(missingUserResult, null, 2));

    console.log('\n🎉 All interaction API tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Make sure the development server is running:');
      console.log('   npm run dev');
    }
  }
}

// Run the tests
testInteractionsAPI();