#!/usr/bin/env node

/**
 * Quick Production Check
 * Fast test to see current status of NewsData.io integration
 */

const https = require('https');
const { URL } = require('url');

const PRODUCTION_URL = 'https://smartkhabar-e8rnt3sgj-prateeks-projects-018799ca.vercel.app';

async function makeRequest(endpoint) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, PRODUCTION_URL);
    
    const req = https.request(url, { method: 'GET', timeout: 10000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: data ? JSON.parse(data) : {}
          });
        } catch (error) {
          resolve({
            status: res.statusCode,
            data: data,
            parseError: true
          });
        }
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
    
    req.end();
  });
}

async function quickCheck() {
  console.log('⚡ Quick Production Check');
  console.log('========================');
  console.log(`📍 ${PRODUCTION_URL}`);
  
  const endpoints = [
    { name: 'Health', path: '/api/health' },
    { name: 'Breaking News', path: '/api/news/breaking?limit=1' },
    { name: 'Real-time News', path: '/api/news/realtime?limit=1' },
    { name: 'Free News', path: '/api/news/free?limit=1' }
  ];
  
  let workingEndpoints = 0;
  let realTimeAvailable = false;
  
  for (const endpoint of endpoints) {
    try {
      console.log(`\n🔍 ${endpoint.name}...`);
      const response = await makeRequest(endpoint.path);
      
      if (response.status === 200) {
        console.log(`   ✅ Status: ${response.status}`);
        
        if (response.data.articles) {
          console.log(`   📰 Articles: ${response.data.articles.length}`);
          console.log(`   🔗 Source: ${response.data.source || 'unknown'}`);
          
          if (response.data.breaking || response.data.realTime) {
            console.log(`   🔴 Real-time: YES`);
            realTimeAvailable = true;
          }
        } else if (response.data.status === 'ok') {
          console.log(`   💚 Health: OK`);
        }
        
        workingEndpoints++;
      } else {
        console.log(`   ❌ Status: ${response.status}`);
        if (response.status === 404) {
          console.log(`   📝 Note: Endpoint not deployed`);
        }
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }
  
  console.log('\n📊 Summary');
  console.log('===========');
  console.log(`✅ Working: ${workingEndpoints}/${endpoints.length}`);
  console.log(`🔴 Real-time News: ${realTimeAvailable ? 'Available' : 'Not Available'}`);
  
  if (realTimeAvailable) {
    console.log('\n🎉 SUCCESS: NewsData.io real-time news is working in production!');
  } else {
    console.log('\n⚠️  ISSUE: Real-time news endpoints are not working properly');
    console.log('   Possible causes:');
    console.log('   - Endpoints not deployed (404 errors)');
    console.log('   - API key issues');
    console.log('   - Build/runtime errors');
  }
}

quickCheck().catch(console.error);