/**
 * Manual test script for the summary API
 */

const testSummaryAPI = async () => {
  console.log('Testing Summary API...');
  
  try {
    // Test GET endpoint
    console.log('\n1. Testing GET /api/articles/summary');
    const getResponse = await fetch('http://localhost:3000/api/articles/summary');
    const getResult = await getResponse.json();
    console.log('GET Response:', JSON.stringify(getResult, null, 2));
    
    // Test POST endpoint with valid data
    console.log('\n2. Testing POST /api/articles/summary with valid data');
    const validData = {
      articles: [{
        id: 'test-article-1',
        headline: 'Test Article Headline',
        content: 'This is a test article content that should be summarized by the AI system.',
        source: 'test-source',
        category: 'technology',
        publishedAt: '2024-01-01T00:00:00Z',
        url: 'https://example.com/test-article',
        tags: ['test', 'article']
      }],
      tone: 'casual',
      maxReadingTime: 5,
      userId: 'test-user-123'
    };
    
    const postResponse = await fetch('http://localhost:3000/api/articles/summary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validData)
    });
    
    const postResult = await postResponse.json();
    console.log('POST Response Status:', postResponse.status);
    console.log('POST Response:', JSON.stringify(postResult, null, 2));
    
    // Test POST endpoint with invalid data
    console.log('\n3. Testing POST /api/articles/summary with invalid data');
    const invalidData = {
      articles: [], // Empty array should fail
      tone: 'casual',
      maxReadingTime: 5,
      userId: 'test-user-123'
    };
    
    const invalidResponse = await fetch('http://localhost:3000/api/articles/summary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invalidData)
    });
    
    const invalidResult = await invalidResponse.json();
    console.log('Invalid POST Response Status:', invalidResponse.status);
    console.log('Invalid POST Response:', JSON.stringify(invalidResult, null, 2));
    
  } catch (error) {
    console.error('Test failed:', error);
  }
};

// Export for use in other contexts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { testSummaryAPI };
} else {
  // Run if called directly
  testSummaryAPI();
}