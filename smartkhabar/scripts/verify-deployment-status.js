#!/usr/bin/env node

/**
 * Deployment Status Verification
 * Comprehensive check of what's working in production after NewsData.io integration
 */

const https = require('https');
const { URL } = require('url');

const PRODUCTION_URL = 'https://smartkhabar-e8rnt3sgj-prateeks-projects-018799ca.vercel.app';

class DeploymentVerifier {
  constructor() {
    this.baseUrl = PRODUCTION_URL;
    this.results = {
      working: [],
      failing: [],
      total: 0
    };
  }

  async makeRequest(endpoint, options = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(endpoint, this.baseUrl);
      
      const requestOptions = {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'SmartKhabar-Deployment-Verifier/1.0',
          ...options.headers
        },
        timeout: 15000
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
              data: jsonData,
              rawData: data
            });
          } catch (error) {
            resolve({
              status: res.statusCode,
              data: data,
              parseError: error.message,
              rawData: data
            });
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (options.body) {
        req.write(JSON.stringify(options.body));
      }

      req.end();
    });
  }

  async testEndpoint(name, endpoint, expectedStatus = 200, testData = null) {
    this.results.total++;
    
    try {
      console.log(`\n🔍 Testing ${name}...`);
      const startTime = Date.now();
      
      const options = testData ? {
        method: 'POST',
        body: testData
      } : {};
      
      const response = await this.makeRequest(endpoint, options);
      const responseTime = Date.now() - startTime;
      
      console.log(`   Status: ${response.status} (${responseTime}ms)`);
      
      if (response.status === expectedStatus) {
        console.log(`   ✅ WORKING`);
        
        // Additional checks for specific endpoints
        if (endpoint.includes('/news/') && response.data.articles !== undefined) {
          console.log(`   📰 Articles: ${response.data.articles.length}`);
          console.log(`   🔗 Source: ${response.data.source || 'unknown'}`);
          
          if (response.data.breaking || response.data.realTime) {
            console.log(`   🔴 Real-time: ${response.data.breaking ? 'BREAKING' : 'REALTIME'}`);
          }
        }
        
        if (response.data.success !== undefined) {
          console.log(`   ✨ Success: ${response.data.success}`);
        }
        
        this.results.working.push({
          name,
          endpoint,
          status: response.status,
          responseTime,
          hasData: !!response.data
        });
        
      } else {
        console.log(`   ❌ FAILING - Expected ${expectedStatus}, got ${response.status}`);
        
        if (response.status === 404) {
          console.log(`   📝 Note: Endpoint not deployed or route missing`);
        } else if (response.status >= 500) {
          console.log(`   🔥 Note: Server error - check logs`);
        } else if (response.status >= 400) {
          console.log(`   ⚠️  Note: Client error - check request format`);
        }
        
        this.results.failing.push({
          name,
          endpoint,
          status: response.status,
          responseTime,
          error: response.data.error || 'Unknown error'
        });
      }
      
    } catch (error) {
      console.log(`   💥 ERROR: ${error.message}`);
      this.results.failing.push({
        name,
        endpoint,
        error: error.message
      });
    }
  }

  async runFullVerification() {
    console.log('🚀 SmartKhabar Deployment Verification');
    console.log('======================================');
    console.log(`📍 Production URL: ${this.baseUrl}`);
    console.log(`🕐 Started: ${new Date().toISOString()}`);
    
    // Core API endpoints
    await this.testEndpoint('Health Check', '/api/health');
    await this.testEndpoint('Debug Info', '/api/debug');
    await this.testEndpoint('Database Test', '/api/db-test');
    
    // News endpoints (the main focus)
    await this.testEndpoint('Free News API', '/api/news/free');
    await this.testEndpoint('Breaking News API', '/api/news/breaking');
    await this.testEndpoint('Real-time News API', '/api/news/realtime');
    await this.testEndpoint('Personalized News API', '/api/news/personalized');
    
    // Auth endpoints
    await this.testEndpoint('Auth Registration', '/api/auth/register', 400, {
      // Intentionally incomplete to test validation
      email: 'test@example.com'
    });
    
    // Article processing
    await this.testEndpoint('Article Summary (Free)', '/api/articles/summary/free', 400, {
      // Intentionally incomplete to test validation
      title: 'Test Article'
    });
    
    // Preferences
    await this.testEndpoint('User Preferences', '/api/preferences', 401); // Should require auth
    
    // Monitoring
    await this.testEndpoint('Performance Monitoring', '/api/monitoring/performance');
    await this.testEndpoint('Health Monitoring', '/api/monitoring/health');
    
    // Print comprehensive summary
    console.log('\n📊 Deployment Verification Results');
    console.log('===================================');
    
    const workingCount = this.results.working.length;
    const failingCount = this.results.failing.length;
    const successRate = ((workingCount / this.results.total) * 100).toFixed(1);
    
    console.log(`✅ Working Endpoints: ${workingCount}/${this.results.total}`);
    console.log(`❌ Failing Endpoints: ${failingCount}/${this.results.total}`);
    console.log(`📈 Success Rate: ${successRate}%`);
    
    if (this.results.working.length > 0) {
      console.log('\n✅ Working Endpoints:');
      this.results.working.forEach(result => {
        console.log(`  ✓ ${result.name} (${result.status}) - ${result.responseTime}ms`);
      });
    }
    
    if (this.results.failing.length > 0) {
      console.log('\n❌ Failing Endpoints:');
      this.results.failing.forEach(result => {
        console.log(`  ✗ ${result.name} - ${result.status || 'ERROR'}: ${result.error || 'Unknown'}`);
      });
    }
    
    // NewsData.io specific analysis
    console.log('\n🔴 NewsData.io Integration Status:');
    const newsEndpoints = this.results.working.filter(r => r.endpoint.includes('/news/'));
    const breakingNews = this.results.working.find(r => r.endpoint.includes('/breaking'));
    const realtimeNews = this.results.working.find(r => r.endpoint.includes('/realtime'));
    
    if (newsEndpoints.length > 0) {
      console.log(`✅ News endpoints working: ${newsEndpoints.length}`);
    } else {
      console.log(`❌ No news endpoints are working`);
    }
    
    if (breakingNews) {
      console.log(`✅ Breaking news: AVAILABLE`);
    } else {
      console.log(`❌ Breaking news: NOT AVAILABLE (404 - not deployed)`);
    }
    
    if (realtimeNews) {
      console.log(`✅ Real-time news: AVAILABLE`);
    } else {
      console.log(`❌ Real-time news: NOT AVAILABLE (404 - not deployed)`);
    }
    
    // Deployment recommendations
    console.log('\n💡 Recommendations:');
    
    if (failingCount > workingCount) {
      console.log('🔄 Major deployment issues detected. Consider redeploying.');
    }
    
    if (!breakingNews || !realtimeNews) {
      console.log('📦 Breaking/Real-time news endpoints missing. Latest build may not be deployed.');
      console.log('   → Run: vercel --prod to deploy latest changes');
    }
    
    if (newsEndpoints.length === 0) {
      console.log('🚨 No news endpoints working. Check NewsData.io API key and environment variables.');
    }
    
    console.log(`\n🎯 Verification completed: ${new Date().toISOString()}`);
    
    // Exit with appropriate code
    process.exit(failingCount > workingCount ? 1 : 0);
  }
}

// Run the verification
const verifier = new DeploymentVerifier();
verifier.runFullVerification().catch(error => {
  console.error('Verification failed:', error);
  process.exit(1);
});