#!/usr/bin/env node

/**
 * Deploy and Test Script
 * Deploys to Vercel and tests the NewsData.io integration
 */

const { execSync } = require('child_process');
const https = require('https');
const { URL } = require('url');

const PRODUCTION_URL = 'https://smartkhabar-e8rnt3sgj-prateeks-projects-018799ca.vercel.app';

class DeploymentTester {
  constructor() {
    this.baseUrl = PRODUCTION_URL;
  }

  async makeRequest(endpoint, options = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(endpoint, this.baseUrl);
      
      const requestOptions = {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'SmartKhabar-Deploy-Test/1.0',
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

  async checkCurrentDeployment() {
    console.log('🔍 Checking current deployment status...');
    
    try {
      const health = await this.makeRequest('/api/health');
      console.log(`   Health Check: ${health.status === 200 ? '✅ OK' : '❌ FAIL'}`);
      
      const breaking = await this.makeRequest('/api/news/breaking?limit=1');
      console.log(`   Breaking News: ${breaking.status === 200 ? '✅ OK' : `❌ ${breaking.status}`}`);
      
      const realtime = await this.makeRequest('/api/news/realtime?limit=1');
      console.log(`   Real-time News: ${realtime.status === 200 ? '✅ OK' : `❌ ${realtime.status}`}`);
      
      return {
        health: health.status === 200,
        breaking: breaking.status === 200,
        realtime: realtime.status === 200
      };
      
    } catch (error) {
      console.log(`   ❌ Error checking deployment: ${error.message}`);
      return { health: false, breaking: false, realtime: false };
    }
  }

  async deployToVercel() {
    console.log('🚀 Deploying to Vercel...');
    
    try {
      // Check if vercel CLI is available
      try {
        execSync('vercel --version', { stdio: 'pipe' });
      } catch (error) {
        console.log('❌ Vercel CLI not found. Please install it with: npm i -g vercel');
        return false;
      }
      
      // Deploy to production
      console.log('   Deploying to production...');
      const deployOutput = execSync('vercel --prod --yes', { 
        encoding: 'utf8',
        cwd: process.cwd()
      });
      
      console.log('   ✅ Deployment completed');
      console.log('   Waiting 30 seconds for deployment to propagate...');
      
      // Wait for deployment to propagate
      await new Promise(resolve => setTimeout(resolve, 30000));
      
      return true;
      
    } catch (error) {
      console.log(`   ❌ Deployment failed: ${error.message}`);
      return false;
    }
  }

  async testNewsDataEndpoints() {
    console.log('🧪 Testing NewsData.io endpoints...');
    
    const tests = [
      {
        name: 'Breaking News',
        endpoint: '/api/news/breaking?limit=3',
        expectRealTime: true
      },
      {
        name: 'Real-time News',
        endpoint: '/api/news/realtime?limit=3&timeframe=1',
        expectRealTime: true
      },
      {
        name: 'Free News',
        endpoint: '/api/news/free?limit=3',
        expectRealTime: false
      }
    ];
    
    let passedTests = 0;
    let realTimeWorking = false;
    
    for (const test of tests) {
      try {
        console.log(`\n   Testing ${test.name}...`);
        const response = await this.makeRequest(test.endpoint);
        
        if (response.status === 200) {
          const data = response.data;
          
          if (data.articles && Array.isArray(data.articles)) {
            console.log(`     ✅ SUCCESS: ${data.articles.length} articles`);
            console.log(`     Source: ${data.source || 'unknown'}`);
            
            if (data.articles.length > 0) {
              const firstArticle = data.articles[0];
              console.log(`     Sample: ${firstArticle.headline || firstArticle.title || 'N/A'}`);
              
              // Check if this is real-time news
              if (test.expectRealTime && (data.breaking || data.realTime)) {
                console.log(`     🔴 REAL-TIME: Confirmed real-time news capability`);
                realTimeWorking = true;
              }
            }
            
            passedTests++;
          } else {
            console.log(`     ❌ FAIL: No articles in response`);
          }
        } else {
          console.log(`     ❌ FAIL: HTTP ${response.status}`);
        }
        
      } catch (error) {
        console.log(`     ❌ ERROR: ${error.message}`);
      }
    }
    
    return { passedTests, totalTests: tests.length, realTimeWorking };
  }

  async run() {
    console.log('🎯 SmartKhabar Deployment & Test Pipeline');
    console.log('==========================================');
    console.log(`📍 Target: ${this.baseUrl}`);
    console.log(`🕐 Started: ${new Date().toISOString()}`);
    
    // Step 1: Check current deployment
    const currentStatus = await this.checkCurrentDeployment();
    
    // Step 2: Deploy if needed
    if (!currentStatus.breaking || !currentStatus.realtime) {
      console.log('\n📦 Deployment needed - missing endpoints detected');
      const deploySuccess = await this.deployToVercel();
      
      if (!deploySuccess) {
        console.log('\n❌ Deployment failed. Cannot proceed with testing.');
        return;
      }
    } else {
      console.log('\n✅ All endpoints are available, skipping deployment');
    }
    
    // Step 3: Test NewsData.io integration
    console.log('\n🧪 Testing NewsData.io Integration...');
    const testResults = await this.testNewsDataEndpoints();
    
    // Step 4: Summary
    console.log('\n📊 Final Results');
    console.log('=================');
    console.log(`✅ Passed Tests: ${testResults.passedTests}/${testResults.totalTests}`);
    console.log(`📈 Success Rate: ${((testResults.passedTests / testResults.totalTests) * 100).toFixed(1)}%`);
    
    if (testResults.realTimeWorking) {
      console.log('🔴 REAL-TIME NEWS: ✅ Working');
      console.log('📰 Your production API can deliver real-time news updates via NewsData.io');
    } else {
      console.log('🔴 REAL-TIME NEWS: ❌ Not Working');
      console.log('📰 Real-time news capabilities are not available');
    }
    
    console.log(`\n🎯 Pipeline completed: ${new Date().toISOString()}`);
    
    // Exit with appropriate code
    process.exit(testResults.passedTests === testResults.totalTests ? 0 : 1);
  }
}

// Run the deployment and test pipeline
const tester = new DeploymentTester();
tester.run().catch(error => {
  console.error('Pipeline failed:', error);
  process.exit(1);
});