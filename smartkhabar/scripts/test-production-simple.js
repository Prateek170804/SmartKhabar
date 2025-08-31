#!/usr/bin/env node

/**
 * Simple Production Test - Just test the core endpoints
 */

const https = require('https');
const { URL } = require('url');

const PRODUCTION_URL = 'https://smartkhabar-e8rnt3sgj-prateeks-projects-018799ca.vercel.app';

async function makeRequest(endpoint, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, PRODUCTION_URL);
    
    const requestOptions = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SmartKhabar-Test/1.0',
        ...options.headers
      }
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
            data: jsonData
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

    req.on('error', (error) => {
      reject(error);
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

async function testEndpoints() {
  console.log('🚀 Testing Production Endpoints...');
  console.log(`📍 URL: ${PRODUCTION_URL}`);
  
  // Test 1: Health Check
  console.log('\n1. Testing Health Check...');
  try {
    const health = await makeRequest('/api/health');
    console.log(`   Status: ${health.status}`);
    console.log(`   Response: ${JSON.stringify(health.data, null, 2)}`);
  } catch (error) {
    console.log(`   Error: ${error.message}`);
  }

  // Test 2: Free News API
  console.log('\n2. Testing Free News API...');
  try {
    const news = await makeRequest('/api/news/free');
    console.log(`   Status: ${news.status}`);
    if (news.data.articles) {
      console.log(`   Articles: ${news.data.articles.length}`);
      console.log(`   First article: ${news.data.articles[0]?.title || 'N/A'}`);
    } else {
      console.log(`   Response: ${JSON.stringify(news.data, null, 2)}`);
    }
  } catch (error) {
    console.log(`   Error: ${error.message}`);
  }

  // Test 3: Breaking News API
  console.log('\n3. Testing Breaking News API...');
  try {
    const breaking = await makeRequest('/api/news/breaking');
    console.log(`   Status: ${breaking.status}`);
    if (breaking.data.articles) {
      console.log(`   Articles: ${breaking.data.articles.length}`);
      console.log(`   Source: ${breaking.data.source || 'N/A'}`);
    } else {
      console.log(`   Response: ${JSON.stringify(breaking.data, null, 2)}`);
    }
  } catch (error) {
    console.log(`   Error: ${error.message}`);
  }

  // Test 4: Database Test
  console.log('\n4. Testing Database Connection...');
  try {
    const db = await makeRequest('/api/db-test');
    console.log(`   Status: ${db.status}`);
    console.log(`   Response: ${JSON.stringify(db.data, null, 2)}`);
  } catch (error) {
    console.log(`   Error: ${error.message}`);
  }

  // Test 5: Test Auth Registration
  console.log('\n5. Testing Auth Registration...');
  try {
    const testUser = {
      email: `test-${Date.now()}@example.com`,
      password: 'testpass123',
      name: 'Test User'
    };
    
    const register = await makeRequest('/api/auth/register', {
      method: 'POST',
      body: testUser
    });
    
    console.log(`   Status: ${register.status}`);
    if (register.data.success) {
      console.log(`   Success: User registered with ID ${register.data.data?.user?.id}`);
      console.log(`   Token length: ${register.data.data?.token?.length || 0} chars`);
    } else {
      console.log(`   Error: ${register.data.error?.message || 'Unknown error'}`);
    }
  } catch (error) {
    console.log(`   Error: ${error.message}`);
  }

  console.log('\n✅ Production test complete!');
}

testEndpoints().catch(console.error);