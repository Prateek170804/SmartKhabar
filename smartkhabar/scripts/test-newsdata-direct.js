#!/usr/bin/env node

const https = require('https');

const API_KEY = process.env.NEWSDATA_API_KEY || 'your_newsdata_api_key_here';
const BASE_URL = 'https://newsdata.io/api/1';

async function testNewsDataAPI() {
  console.log('🔍 Testing NewsData.io API directly');
  console.log('===================================');
  console.log(`🔑 API Key: ${API_KEY.substring(0, 10)}...`);
  console.log(`🌐 Base URL: ${BASE_URL}`);
  console.log(`🕐 Started: ${new Date().toISOString()}`);
  
  const testCases = [
    {
      name: 'Basic Latest News',
      params: {
        apikey: API_KEY,
        language: 'en',
        size: '5'
      }
    },
    {
      name: 'Breaking News with Priority',
      params: {
        apikey: API_KEY,
        language: 'en',
        size: '5',
        prioritydomain: 'top'
      }
    },
    {
      name: 'Category News (Business)',
      params: {
        apikey: API_KEY,
        language: 'en',
        size: '5',
        category: 'business'
      }
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n🧪 Testing: ${testCase.name}`);
    console.log('----------------------------');
    
    try {
      const params = new URLSearchParams(testCase.params);
      const url = `${BASE_URL}/news?${params}`;
      
      console.log(`📡 URL: ${url.replace(API_KEY, 'API_KEY_HIDDEN')}`);
      
      const startTime = Date.now();
      const response = await makeRequest(url);
      const duration = Date.now() - startTime;
      
      console.log(`⏱️  Duration: ${duration}ms`);
      console.log(`📊 Status: ${response.status}`);
      
      if (response.status === 200) {
        const data = JSON.parse(response.data);
        console.log(`✅ SUCCESS`);
        console.log(`📰 Total Results: ${data.totalResults || 0}`);
        console.log(`📄 Articles Returned: ${data.results ? data.results.length : 0}`);
        console.log(`🔄 Status: ${data.status}`);
        
        if (data.results && data.results.length > 0) {
          const firstArticle = data.results[0];
          console.log(`📝 First Article: "${firstArticle.title.substring(0, 50)}..."`);
          console.log(`🔗 Source: ${firstArticle.source_id}`);
          console.log(`📅 Published: ${firstArticle.pubDate}`);
        }
      } else {
        console.log(`❌ FAILED`);
        console.log(`🔥 Response: ${response.data.substring(0, 500)}`);
      }
      
    } catch (error) {
      console.log(`❌ ERROR: ${error.message}`);
    }
  }
  
  console.log(`\n🎯 Test completed: ${new Date().toISOString()}`);
}

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          data: data,
          headers: res.headers
        });
      });
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

testNewsDataAPI().catch(console.error);