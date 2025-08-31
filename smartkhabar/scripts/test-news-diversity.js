#!/usr/bin/env node

/**
 * Test script to check news diversity across different sectors
 */

const fetch = require('node-fetch');

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

// Comprehensive list of news categories to test
const NEWS_CATEGORIES = [
  'general',
  'technology', 
  'business',
  'science',
  'health',
  'sports',
  'entertainment',
  'politics',
  'world',
  'finance',
  'environment',
  'education',
  'lifestyle',
  'travel',
  'food',
  'automotive',
  'real-estate',
  'crime'
];

async function testCategoryDiversity(category, limit = 5) {
  try {
    console.log(`\n🧪 Testing ${category.toUpperCase()} news...`);
    
    const response = await fetch(`${BASE_URL}/api/news/free?category=${category}&limit=${limit}`);
    const data = await response.json();
    
    if (response.ok && data.success && data.articles) {
      console.log(`✅ ${category}: ${data.articles.length} articles found`);
      
      // Show sample titles
      if (data.articles.length > 0) {
        console.log(`   📝 Sample titles:`);
        data.articles.slice(0, 2).forEach((article, index) => {
          const title = article.title || article.headline || 'No title';
          console.log(`      ${index + 1}. ${title.substring(0, 80)}${title.length > 80 ? '...' : ''}`);
        });
        
        // Check category distribution
        const categories = data.articles.map(a => a.category).filter(Boolean);
        const uniqueCategories = [...new Set(categories)];
        console.log(`   🏷️ Categories found: ${uniqueCategories.join(', ')}`);
      }
      
      return {
        category,
        success: true,
        count: data.articles.length,
        articles: data.articles,
        categories: [...new Set(data.articles.map(a => a.category).filter(Boolean))]
      };
    } else {
      console.log(`❌ ${category}: Failed - ${data.error || 'Unknown error'}`);
      return {
        category,
        success: false,
        count: 0,
        error: data.error || 'Unknown error'
      };
    }
  } catch (error) {
    console.log(`❌ ${category}: Error - ${error.message}`);
    return {
      category,
      success: false,
      count: 0,
      error: error.message
    };
  }
}

async function testCurrentEndpoints() {
  console.log('📰 Testing Current News Endpoints for Diversity');
  console.log('=' .repeat(60));
  
  const endpoints = [
    { url: '/api/news/free?limit=10', name: 'Free News (Default)' },
    { url: '/api/news/free?category=technology&limit=10', name: 'Technology News' },
    { url: '/api/news/free?category=business&limit=10', name: 'Business News' },
    { url: '/api/news/free?category=science&limit=10', name: 'Science News' },
    { url: '/api/news/free?category=health&limit=10', name: 'Health News' },
    { url: '/api/news/free?category=sports&limit=10', name: 'Sports News' },
    { url: '/api/news/breaking-simple?limit=10', name: 'Breaking News' },
    { url: '/api/news/realtime-simple?limit=10', name: 'Real-time News' }
  ];
  
  const results = [];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`\n🧪 Testing ${endpoint.name}...`);
      const response = await fetch(`${BASE_URL}${endpoint.url}`);
      const data = await response.json();
      
      if (response.ok && data.success && data.articles) {
        console.log(`✅ ${endpoint.name}: ${data.articles.length} articles`);
        
        // Analyze category diversity
        const categories = data.articles.map(a => a.category).filter(Boolean);
        const uniqueCategories = [...new Set(categories)];
        const categoryCount = {};
        categories.forEach(cat => {
          categoryCount[cat] = (categoryCount[cat] || 0) + 1;
        });
        
        console.log(`   🏷️ Categories (${uniqueCategories.length}): ${uniqueCategories.join(', ')}`);
        console.log(`   📊 Distribution: ${JSON.stringify(categoryCount)}`);
        
        results.push({
          endpoint: endpoint.name,
          success: true,
          count: data.articles.length,
          categories: uniqueCategories,
          distribution: categoryCount
        });
      } else {
        console.log(`❌ ${endpoint.name}: Failed`);
        results.push({
          endpoint: endpoint.name,
          success: false,
          error: data.error || 'Unknown error'
        });
      }
    } catch (error) {
      console.log(`❌ ${endpoint.name}: Error - ${error.message}`);
      results.push({
        endpoint: endpoint.name,
        success: false,
        error: error.message
      });
    }
  }
  
  return results;
}

async function runDiversityAnalysis() {
  console.log('🌍 SmartKhabar News Diversity Analysis');
  console.log('=' .repeat(70));
  
  // Test current endpoints
  const currentResults = await testCurrentEndpoints();
  
  // Test individual categories (first 8 to avoid rate limits)
  console.log('\n🎯 Testing Individual Categories');
  console.log('=' .repeat(50));
  
  const categoryResults = [];
  for (const category of NEWS_CATEGORIES.slice(0, 8)) {
    const result = await testCategoryDiversity(category, 3);
    categoryResults.push(result);
    
    // Add delay to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Analysis Summary
  console.log('\n' + '=' .repeat(70));
  console.log('📊 DIVERSITY ANALYSIS SUMMARY');
  console.log('=' .repeat(70));
  
  const successfulEndpoints = currentResults.filter(r => r.success);
  const totalCategories = new Set();
  const categoryDistribution = {};
  
  successfulEndpoints.forEach(result => {
    if (result.categories) {
      result.categories.forEach(cat => {
        totalCategories.add(cat);
        categoryDistribution[cat] = (categoryDistribution[cat] || 0) + 1;
      });
    }
  });
  
  console.log(`🎯 Current Status:`);
  console.log(`   📰 Working Endpoints: ${successfulEndpoints.length}/${currentResults.length}`);
  console.log(`   🏷️ Unique Categories Found: ${totalCategories.size}`);
  console.log(`   📊 Categories: ${[...totalCategories].join(', ')}`);
  
  console.log(`\n📈 Category Distribution:`);
  Object.entries(categoryDistribution)
    .sort(([,a], [,b]) => b - a)
    .forEach(([category, count]) => {
      console.log(`   ${category}: ${count} endpoints`);
    });
  
  // Recommendations
  console.log(`\n💡 RECOMMENDATIONS:`);
  
  if (totalCategories.size < 6) {
    console.log(`   ⚠️ LIMITED DIVERSITY: Only ${totalCategories.size} categories found`);
    console.log(`   🔧 Recommendation: Expand default categories in news collector`);
  } else {
    console.log(`   ✅ GOOD DIVERSITY: ${totalCategories.size} categories found`);
  }
  
  const techHeavy = categoryDistribution['technology'] > categoryDistribution['general'];
  if (techHeavy) {
    console.log(`   ⚠️ TECH-HEAVY: Technology news dominates the feed`);
    console.log(`   🔧 Recommendation: Balance categories in main page preferences`);
  }
  
  console.log(`\n🚀 ENHANCEMENT SUGGESTIONS:`);
  console.log(`   1. Add more categories to DEFAULT_COLLECTION_CONFIG`);
  console.log(`   2. Update main page to request diverse categories`);
  console.log(`   3. Implement category rotation for better diversity`);
  console.log(`   4. Add user preference for category weights`);
  
  const missingCategories = NEWS_CATEGORIES.filter(cat => !totalCategories.has(cat));
  if (missingCategories.length > 0) {
    console.log(`\n🔍 MISSING CATEGORIES (${missingCategories.length}):`);
    console.log(`   ${missingCategories.slice(0, 10).join(', ')}${missingCategories.length > 10 ? '...' : ''}`);
  }
  
  return {
    totalCategories: totalCategories.size,
    workingEndpoints: successfulEndpoints.length,
    categoryDistribution,
    recommendations: {
      expandCategories: totalCategories.size < 6,
      balanceCategories: techHeavy,
      missingCategories: missingCategories.length
    }
  };
}

if (require.main === module) {
  runDiversityAnalysis().then(results => {
    console.log(`\n🎉 Analysis complete! Found ${results.totalCategories} categories across ${results.workingEndpoints} endpoints.`);
    process.exit(0);
  }).catch(error => {
    console.error('Analysis failed:', error);
    process.exit(1);
  });
}

module.exports = { runDiversityAnalysis };