#!/usr/bin/env node

/**
 * Deployment Validation Script for SmartKhabar
 * Performs comprehensive checks before and after deployment
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    
    const req = client.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

async function testHealthEndpoint(baseUrl) {
  console.log('🏥 Testing health endpoint...');
  
  try {
    const response = await makeRequest(`${baseUrl}/api/health`);
    
    if (response.status === 200) {
      console.log('✅ Health endpoint is working');
      console.log(`   Response: ${JSON.stringify(response.data, null, 2)}`);
      return true;
    } else {
      console.log(`❌ Health endpoint returned status ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Health endpoint failed: ${error.message}`);
    return false;
  }
}

async function testNewsEndpoint(baseUrl) {
  console.log('📰 Testing news endpoint...');
  
  try {
    const response = await makeRequest(`${baseUrl}/api/news/free`);
    
    if (response.status === 200) {
      console.log('✅ News endpoint is working');
      if (response.data && response.data.articles) {
        console.log(`   Found ${response.data.articles.length} articles`);
      }
      return true;
    } else {
      console.log(`❌ News endpoint returned status ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ News endpoint failed: ${error.message}`);
    return false;
  }
}

async function testSummaryEndpoint(baseUrl) {
  console.log('📝 Testing summary endpoint...');
  
  try {
    const testArticle = {
      title: "Test Article",
      content: "This is a test article content for validation purposes.",
      url: "https://example.com/test"
    };
    
    const response = await makeRequest(`${baseUrl}/api/articles/summary/free?` + 
      new URLSearchParams({
        title: testArticle.title,
        content: testArticle.content,
        url: testArticle.url
      }));
    
    if (response.status === 200) {
      console.log('✅ Summary endpoint is working');
      return true;
    } else {
      console.log(`❌ Summary endpoint returned status ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Summary endpoint failed: ${error.message}`);
    return false;
  }
}

async function testDatabaseConnection(baseUrl) {
  console.log('🗄️  Testing database connection...');
  
  try {
    const response = await makeRequest(`${baseUrl}/api/monitoring/health`);
    
    if (response.status === 200 && response.data && response.data.database) {
      console.log('✅ Database connection is working');
      console.log(`   Status: ${response.data.database.status}`);
      return true;
    } else {
      console.log('❌ Database connection test failed');
      return false;
    }
  } catch (error) {
    console.log(`❌ Database connection test failed: ${error.message}`);
    return false;
  }
}

async function validateDeployment(baseUrl) {
  console.log(`🔍 Validating deployment at: ${baseUrl}\n`);
  
  const tests = [
    () => testHealthEndpoint(baseUrl),
    () => testNewsEndpoint(baseUrl),
    () => testSummaryEndpoint(baseUrl),
    () => testDatabaseConnection(baseUrl)
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      const result = await test();
      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      console.log(`❌ Test failed with error: ${error.message}`);
      failed++;
    }
    console.log(''); // Add spacing between tests
  }
  
  console.log('========================================');
  console.log(`Validation Results: ${passed} passed, ${failed} failed`);
  console.log('========================================');
  
  if (failed === 0) {
    console.log('🎉 All tests passed! Deployment is successful.');
    return true;
  } else {
    console.log('❌ Some tests failed. Please check the deployment.');
    return false;
  }
}

function checkPreDeployment() {
  console.log('🔍 Running pre-deployment checks...\n');
  
  // Check if required files exist
  const requiredFiles = [
    '.env.production',
    'vercel.json',
    'package.json',
    'next.config.ts'
  ];
  
  let allFilesExist = true;
  
  requiredFiles.forEach(file => {
    const filePath = path.join(__dirname, '..', file);
    if (fs.existsSync(filePath)) {
      console.log(`✅ ${file} exists`);
    } else {
      console.log(`❌ ${file} is missing`);
      allFilesExist = false;
    }
  });
  
  if (!allFilesExist) {
    console.log('\n❌ Pre-deployment check failed: Missing required files');
    return false;
  }
  
  // Check environment variables
  try {
    execSync('node scripts/setup-production-env.js validate', { stdio: 'pipe' });
    console.log('✅ Environment variables are valid');
  } catch (error) {
    console.log('❌ Environment variables validation failed');
    return false;
  }
  
  // Check if build passes
  try {
    console.log('🏗️  Testing build...');
    execSync('npm run build', { stdio: 'pipe' });
    console.log('✅ Build successful');
  } catch (error) {
    console.log('❌ Build failed');
    return false;
  }
  
  console.log('\n🎉 Pre-deployment checks passed!');
  return true;
}

async function main() {
  const command = process.argv[2];
  const url = process.argv[3];
  
  switch (command) {
    case 'pre':
      if (checkPreDeployment()) {
        process.exit(0);
      } else {
        process.exit(1);
      }
      break;
      
    case 'post':
      if (!url) {
        console.error('❌ Please provide the deployment URL');
        console.error('Usage: node scripts/validate-deployment.js post https://your-app.vercel.app');
        process.exit(1);
      }
      
      const success = await validateDeployment(url);
      process.exit(success ? 0 : 1);
      break;
      
    default:
      console.log('SmartKhabar Deployment Validation\n');
      console.log('Usage:');
      console.log('  node scripts/validate-deployment.js pre                    - Run pre-deployment checks');
      console.log('  node scripts/validate-deployment.js post <deployment-url> - Validate deployed application');
      console.log('\nExample:');
      console.log('  node scripts/validate-deployment.js post https://smartkhabar.vercel.app');
      break;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  validateDeployment,
  checkPreDeployment
};