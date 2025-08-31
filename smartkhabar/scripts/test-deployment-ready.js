#!/usr/bin/env node

/**
 * Deployment Readiness Test
 * Comprehensive test of all APIs and functionality
 */

require('dotenv').config({ path: '.env.local' });

const BASE_URL = 'http://localhost:3000';

async function testAPI(endpoint, options = {}) {
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    
    const data = await response.json();
    return { success: response.ok, data, status: response.status };
  } catch (error) {
    return { success: false, error: error.message, status: 0 };
  }
}

async function runTests() {
  console.log('🚀 SmartKhabar Deployment Readiness Test\n');
  
  const tests = [
    {
      name: 'Health Check',
      test: () => testAPI('/api/health')
    },
    {
      name: 'Free News API',
      test: () => testAPI('/api/news/free?category=technology&limit=5')
    },
    {
      name: 'Free Summary API (GET)',
      test: () => testAPI('/api/articles/summary/free')
    },
    {
      name: 'Free Summary API (POST)',
      test: () => testAPI('/api/articles/summary/free', {
        method: 'POST',
        body: JSON.stringify({
          content: 'This is a test article about artificial intelligence and machine learning technologies.',
          tone: 'casual',
          maxLength: 100,
          articleId: 'test-123'
        })
      })
    },
    {
      name: 'Production Monitoring',
      test: () => testAPI('/api/monitoring/production')
    },
    {
      name: 'Performance Monitoring',
      test: () => testAPI('/api/monitoring/performance')
    },
    {
      name: 'Cron Job (Manual Trigger)',
      test: () => testAPI('/api/cron/collect-news', {
        method: 'POST'
      })
    }
  ];
  
  const results = [];
  
  for (const { name, test } of tests) {
    console.log(`🔍 Testing ${name}...`);
    
    const result = await test();
    results.push({ name, ...result });
    
    if (result.success) {
      console.log(`✅ ${name}: OK`);
      if (result.data && typeof result.data === 'object') {
        if (result.data.articles) {
          console.log(`   Articles: ${result.data.articles.length}`);
        }
        if (result.data.summary) {
          console.log(`   Summary: ${result.data.summary.substring(0, 50)}...`);
        }
        if (result.data.apiUsage) {
          console.log(`   API Usage:`, result.data.apiUsage);
        }
      }
    } else {
      console.log(`❌ ${name}: ${result.error || 'Failed'}`);
      if (result.data && result.data.error) {
        console.log(`   Error: ${result.data.error}`);
      }
    }
    console.log('');
  }
  
  // Summary
  console.log('📊 Test Results Summary:');
  console.log('========================');
  
  const passed = results.filter(r => r.success).length;
  const total = results.length;
  
  results.forEach(({ name, success, status }) => {
    console.log(`${success ? '✅' : '❌'} ${name} (${status})`);
  });
  
  console.log(`\nPassed: ${passed}/${total}`);
  
  if (passed >= total * 0.8) { // 80% pass rate
    console.log('🎉 Deployment ready! Most tests passed.');
    
    console.log('\n🚀 Next Steps:');
    console.log('1. Run: npm run vercel:deploy');
    console.log('2. Set environment variables in Vercel dashboard');
    console.log('3. Test deployed endpoints');
    
    return true;
  } else {
    console.log('⚠️  Some critical tests failed. Fix issues before deployment.');
    return false;
  }
}

async function main() {
  // Check if server is running
  try {
    await fetch(`${BASE_URL}/api/health`);
  } catch (error) {
    console.log('❌ Server not running. Start with: npm run dev');
    process.exit(1);
  }
  
  const success = await runTests();
  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main().catch(console.error);
}