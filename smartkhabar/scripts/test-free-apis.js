#!/usr/bin/env node

/**
 * Test script for free APIs
 * Tests GNews API and Hugging Face API
 */

require('dotenv').config({ path: '.env.local' });
const axios = require('axios');

async function testGNewsAPI() {
  console.log('🧪 Testing GNews API...');
  
  const apiKey = process.env.GNEWS_API_KEY;
  if (!apiKey || apiKey === 'your_gnews_api_key_here') {
    console.error('❌ GNews API key not configured');
    return false;
  }

  try {
    const response = await axios.get('https://gnews.io/api/v4/search', {
      params: {
        q: 'technology',
        token: apiKey,
        max: 1,
        lang: 'en'
      },
      timeout: 10000
    });

    if (response.data && response.data.articles && response.data.articles.length > 0) {
      console.log('✅ GNews API working!');
      console.log(`   Found ${response.data.totalArticles} articles`);
      console.log(`   Sample: "${response.data.articles[0].title}"`);
      return true;
    } else {
      console.log('⚠️  GNews API responded but no articles found');
      return false;
    }
  } catch (error) {
    console.error('❌ GNews API failed:', error.response?.data?.message || error.message);
    
    if (error.response?.status === 401) {
      console.error('   💡 Check your API key is correct');
    } else if (error.response?.status === 429) {
      console.error('   💡 Rate limit reached (100 requests/day)');
    }
    
    return false;
  }
}

async function testHuggingFaceAPI() {
  console.log('\n🧪 Testing Hugging Face API...');
  
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey || apiKey === 'your_huggingface_token_here') {
    console.error('❌ Hugging Face API key not configured');
    return false;
  }

  try {
    const response = await axios.post(
      'https://api-inference.huggingface.co/models/facebook/bart-large-cnn',
      {
        inputs: 'This is a test article about technology and artificial intelligence. It discusses the latest developments in machine learning and how they impact our daily lives.',
        parameters: {
          max_length: 50,
          min_length: 10
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    if (response.data && Array.isArray(response.data) && response.data[0]?.summary_text) {
      console.log('✅ Hugging Face API working!');
      console.log(`   Summary: "${response.data[0].summary_text}"`);
      return true;
    } else {
      console.log('⚠️  Hugging Face API responded but unexpected format');
      console.log('   Response:', JSON.stringify(response.data, null, 2));
      return false;
    }
  } catch (error) {
    console.error('❌ Hugging Face API failed:', error.response?.data?.error || error.message);
    
    if (error.response?.status === 401) {
      console.error('   💡 Check your API token is correct');
    } else if (error.response?.status === 503) {
      console.error('   💡 Model is loading, try again in a few seconds');
    }
    
    return false;
  }
}

async function testPuppeteerSetup() {
  console.log('\n🧪 Testing Puppeteer setup...');
  
  try {
    const puppeteer = require('puppeteer');
    console.log('✅ Puppeteer installed successfully!');
    console.log(`   Version: ${puppeteer.version || 'Unknown'}`);
    return true;
  } catch (error) {
    console.error('❌ Puppeteer not installed:', error.message);
    console.error('   💡 Run: npm install puppeteer --legacy-peer-deps');
    return false;
  }
}

async function main() {
  console.log('🚀 Testing SmartKhabar Free APIs\n');
  console.log('📋 Your API Keys:');
  console.log(`   GNews: ${process.env.GNEWS_API_KEY ? '✓ Set' : '❌ Missing'}`);
  console.log(`   Hugging Face: ${process.env.HUGGINGFACE_API_KEY ? '✓ Set' : '❌ Missing'}`);
  console.log(`   Database: ${process.env.DATABASE_URL && process.env.DATABASE_URL !== 'your_neon_connection_string_here' ? '✓ Set' : '❌ Missing'}`);
  console.log('');

  const results = {
    gnews: await testGNewsAPI(),
    huggingface: await testHuggingFaceAPI(),
    puppeteer: await testPuppeteerSetup()
  };

  console.log('\n📊 Test Results Summary:');
  console.log(`   GNews API: ${results.gnews ? '✅ Working' : '❌ Failed'}`);
  console.log(`   Hugging Face: ${results.huggingface ? '✅ Working' : '❌ Failed'}`);
  console.log(`   Puppeteer: ${results.puppeteer ? '✅ Ready' : '❌ Not Ready'}`);

  const allWorking = Object.values(results).every(result => result);
  
  if (allWorking) {
    console.log('\n🎉 All APIs are working! You can now:');
    console.log('   1. Set up your Neon database: npm run db:setup');
    console.log('   2. Start development: npm run dev');
    console.log('   3. Deploy to Vercel: npm run vercel:deploy');
  } else {
    console.log('\n⚠️  Some APIs need attention. Check the errors above.');
    console.log('\n📖 Need help?');
    console.log('   - See NEON_SETUP_INSTRUCTIONS.md for database setup');
    console.log('   - See FREE_API_SETUP.md for API configuration');
  }

  process.exit(allWorking ? 0 : 1);
}

if (require.main === module) {
  main();
}