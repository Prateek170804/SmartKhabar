#!/usr/bin/env node

/**
 * Production API Test Script
 * Tests the deployed Vercel API endpoints with newsdata.io integration
 */

const https = require('https');
const { URL } = require('url');

// Production URL from .env.production
const PRODUCTION_URL = 'https://smartkhabar-e8rnt3sgj-prateeks-projects-018799ca.vercel.app';

class ProductionAPITester {
  constructor() {
    this.baseUrl = PRODUCTION_URL;
    this.results = {
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  async makeRequest(endpoint, options = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(endpoint, this.baseUrl);
      
      const requestOptions = {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'SmartKhabar-Production-Test/1.0',
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
              headers: res.headers,
              data: jsonData
            });
          } catch (error) {
            resolve({
              status: res.statusCode,
              headers: res.headers,
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

  async runTest(name, testFn) {
    console.log(`\n🧪 Testing: ${name}`);
    try {
      const result = await testFn();
      if (result.success) {
        console.log(`✅ PASS: ${name}`);
        this.results.passed++;
      } else {
        console.log(`❌ FAIL: ${name} - ${result.message}`);
        this.results.failed++;
      }
      this.results.tests.push({ name, ...result });
    } catch (error) {
      console.log(`❌ ERROR: ${name} - ${error.message}`);
      this.results.failed++;
      this.results.tests.push({ name, success: false, message: error.message });
    }
  }

  async testHealthEndpoint() {
    return this.runTest('Health Check', async () => {
      const response = await this.makeRequest('/api/health');
      
      if (response.status === 200 && response.data.status === 'ok') {
        return { success: true, message: 'Health endpoint working' };
      }
      
      return { 
        success: false, 
        message: `Health check failed: ${response.status} - ${JSON.stringify(response.data)}` 
      };
    });
  }

  async testNewsDataIntegration() {
    return this.runTest('NewsData.io Integration', async () => {
      const response = await this.makeRequest('/api/news/breaking');
      
      if (response.status === 200 && Array.isArray(response.data.articles)) {
        const articles = response.data.articles;
        if (articles.length > 0) {
          const hasNewsDataFields = articles.some(article => 
            article.source && article.title && article.publishedAt
          );
          
          if (hasNewsDataFields) {
            return { 
              success: true, 
              message: `Breaking news working: ${articles.length} articles fetched` 
            };
          }
        }
        
        return { 
          success: false, 
          message: `No articles returned or missing required fields` 
        };
      }
      
      return { 
        success: false, 
        message: `Breaking news failed: ${response.status} - ${JSON.stringify(response.data)}` 
      };
    });
  }

  async testRealtimeNews() {
    return this.runTest('Realtime News API', async () => {
      const response = await this.makeRequest('/api/news/realtime');
      
      if (response.status === 200 && response.data.articles) {
        return { 
          success: true, 
          message: `Realtime news working: ${response.data.articles.length} articles` 
        };
      }
      
      return { 
        success: false, 
        message: `Realtime news failed: ${response.status}` 
      };
    });
  }

  async testFreeNewsEndpoint() {
    return this.runTest('Free News API', async () => {
      const response = await this.makeRequest('/api/news/free');
      
      if (response.status === 200 && response.data.articles) {
        return { 
          success: true, 
          message: `Free news working: ${response.data.articles.length} articles` 
        };
      }
      
      return { 
        success: false, 
        message: `Free news failed: ${response.status}` 
      };
    });
  }

  async testDatabaseConnection() {
    return this.runTest('Database Connection', async () => {
      const response = await this.makeRequest('/api/db-test');
      
      if (response.status === 200 && response.data.status === 'connected') {
        return { 
          success: true, 
          message: 'Database connection working' 
        };
      }
      
      return { 
        success: false, 
        message: `Database test failed: ${response.status}` 
      };
    });
  }

  async testAuthEndpoints() {
    return this.runTest('Authentication System', async () => {
      // Test registration
      const testUser = {
        email: `test-${Date.now()}@example.com`,
        password: 'testpassword123',
        name: 'Test User'
      };

      const registerResponse = await this.makeRequest('/api/auth/register', {
        method: 'POST',
        body: testUser
      });

      if (registerResponse.status === 201 && registerResponse.data.token) {
        // Test login
        const loginResponse = await this.makeRequest('/api/auth/login', {
          method: 'POST',
          body: {
            email: testUser.email,
            password: testUser.password
          }
        });

        if (loginResponse.status === 200 && loginResponse.data.token) {
          return { 
            success: true, 
            message: 'Auth system working (register + login)' 
          };
        }
      }
      
      return { 
        success: false, 
        message: `Auth test failed: Register ${registerResponse.status}, Login status unknown` 
      };
    });
  }

  async testSummarizationAPI() {
    return this.runTest('Article Summarization', async () => {
      const testArticle = {
        title: "Test Article",
        content: "This is a test article content that should be summarized by the API. It contains multiple sentences to test the summarization functionality.",
        url: "https://example.com/test"
      };

      const response = await this.makeRequest('/api/articles/summary/free', {
        method: 'POST',
        body: testArticle
      });

      if (response.status === 200 && response.data.summary) {
        return { 
          success: true, 
          message: 'Summarization API working' 
        };
      }
      
      return { 
        success: false, 
        message: `Summarization failed: ${response.status}` 
      };
    });
  }

  async runAllTests() {
    console.log('🚀 Starting Production API Tests...');
    console.log(`📍 Testing: ${this.baseUrl}`);
    
    // Run all tests
    await this.testHealthEndpoint();
    await this.testNewsDataIntegration();
    await this.testRealtimeNews();
    await this.testFreeNewsEndpoint();
    await this.testDatabaseConnection();
    await this.testAuthEndpoints();
    await this.testSummarizationAPI();

    // Print summary
    console.log('\n📊 Test Results Summary:');
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    console.log(`📈 Success Rate: ${((this.results.passed / (this.results.passed + this.results.failed)) * 100).toFixed(1)}%`);

    if (this.results.failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results.tests
        .filter(test => !test.success)
        .forEach(test => {
          console.log(`  - ${test.name}: ${test.message}`);
        });
    }

    console.log('\n🎯 Production API Test Complete!');
    
    // Exit with appropriate code
    process.exit(this.results.failed > 0 ? 1 : 0);
  }
}

// Run the tests
const tester = new ProductionAPITester();
tester.runAllTests().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});