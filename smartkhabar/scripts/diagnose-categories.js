#!/usr/bin/env node

/**
 * Diagnostic script to check what categories are actually being returned
 */

const fetch = require('node-fetch');

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

async function diagnoseCategories() {
  console.log('🔍 Diagnosing Category Issues');
  console.log('=' .repeat(50));
  
  try {
    console.log('\n📰 Testing Free News Endpoint...');
    const response = await fetch(`${BASE_URL}/api/news/free?limit=20`);
    const data = await response.json();
    
    if (response.ok && data.success && data.articles) {
      console.log(`✅ Success: ${data.articles.length} articles found`);
      
      // Analyze what categories are actually being returned
      console.log('\n🏷️ Category Analysis:');
      const categoryCount = {};
      const allCategories = [];
      
      data.articles.forEach(article => {
        const category = article.category || 'undefined';
        allCategories.push(category);
        categoryCount[category] = (categoryCount[category] || 0) + 1;
      });
      
      console.log(`📊 Total articles: ${data.articles.length}`);
      console.log(`📊 Unique categories: ${Object.keys(categoryCount).length}`);
      console.log(`📊 Category distribution:`);
      
      Object.entries(categoryCount)
        .sort(([,a], [,b]) => b - a)
        .forEach(([category, count]) => {
          const percentage = ((count / data.articles.length) * 100).toFixed(1);
          console.log(`   ${category}: ${count} articles (${percentage}%)`);
        });
      
      // Show sample articles from each category
      console.log('\n📝 Sample Articles by Category:');
      const uniqueCategories = [...new Set(allCategories)];
      
      uniqueCategories.forEach(category => {
        const categoryArticles = data.articles.filter(a => (a.category || 'undefined') === category);
        if (categoryArticles.length > 0) {
          console.log(`\n   📂 ${category.toUpperCase()}:`);
          categoryArticles.slice(0, 2).forEach((article, i) => {
            const title = article.title || article.headline || 'No title';
            console.log(`      ${i + 1}. ${title.substring(0, 60)}${title.length > 60 ? '...' : ''}`);
          });
        }
      });
      
      // Check what we expected vs what we got
      console.log('\n🎯 Expected vs Actual Categories:');
      const expectedCategories = [
        'general', 'technology', 'business', 'science', 
        'health', 'sports', 'entertainment', 'politics', 
        'world', 'environment'
      ];
      
      const actualCategories = uniqueCategories.filter(cat => cat !== 'undefined');
      
      console.log(`Expected (${expectedCategories.length}): ${expectedCategories.join(', ')}`);
      console.log(`Actual (${actualCategories.length}): ${actualCategories.join(', ')}`);
      
      const missing = expectedCategories.filter(cat => !actualCategories.includes(cat));
      const unexpected = actualCategories.filter(cat => !expectedCategories.includes(cat));
      
      if (missing.length > 0) {
        console.log(`❌ Missing categories (${missing.length}): ${missing.join(', ')}`);
      }
      
      if (unexpected.length > 0) {
        console.log(`⚠️ Unexpected categories (${unexpected.length}): ${unexpected.join(', ')}`);
      }
      
      // Check API metadata
      if (data.metadata) {
        console.log('\n📋 API Metadata:');
        console.log(`   Source: ${data.source || 'unknown'}`);
        console.log(`   Cached: ${data.metadata.cached || false}`);
        console.log(`   Timestamp: ${data.metadata.timestamp || 'unknown'}`);
      }
      
      if (data.apiUsage) {
        console.log('\n📊 API Usage:');
        Object.entries(data.apiUsage).forEach(([api, count]) => {
          console.log(`   ${api}: ${count} articles`);
        });
      }
      
      return {
        success: true,
        totalArticles: data.articles.length,
        actualCategories,
        expectedCategories,
        missing,
        unexpected,
        categoryDistribution: categoryCount
      };
      
    } else {
      console.log(`❌ Failed to get articles`);
      console.log(`   Status: ${response.status}`);
      console.log(`   Error: ${data.error || 'Unknown error'}`);
      return { success: false, error: data.error };
    }
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function checkNewsDataCategories() {
  console.log('\n🔍 Checking NewsData API Category Support...');
  
  // NewsData.io supported categories
  const newsdataCategories = [
    'business', 'entertainment', 'environment', 'food', 'health',
    'politics', 'science', 'sports', 'technology', 'top', 'world'
  ];
  
  console.log(`📋 NewsData.io supported categories (${newsdataCategories.length}):`);
  console.log(`   ${newsdataCategories.join(', ')}`);
  
  return newsdataCategories;
}

async function runDiagnosis() {
  console.log('🚀 Running Category Diagnosis');
  console.log('Make sure the server is running: npm run dev');
  console.log('=' .repeat(60));
  
  const newsDataCategories = await checkNewsDataCategories();
  const result = await diagnoseCategories();
  
  console.log('\n' + '=' .repeat(60));
  console.log('📊 DIAGNOSIS SUMMARY');
  console.log('=' .repeat(60));
  
  if (result.success) {
    console.log(`✅ Articles Retrieved: ${result.totalArticles}`);
    console.log(`✅ Categories Found: ${result.actualCategories.length}`);
    
    if (result.missing.length > 0) {
      console.log(`\n❌ MISSING CATEGORIES (${result.missing.length}):`);
      console.log(`   ${result.missing.join(', ')}`);
      
      console.log('\n🔧 POSSIBLE REASONS:');
      result.missing.forEach(category => {
        if (!newsDataCategories.includes(category)) {
          console.log(`   - "${category}" not supported by NewsData.io API`);
        } else {
          console.log(`   - "${category}" supported but no articles available`);
        }
      });
    }
    
    if (result.unexpected.length > 0) {
      console.log(`\n⚠️ UNEXPECTED CATEGORIES (${result.unexpected.length}):`);
      console.log(`   ${result.unexpected.join(', ')}`);
      console.log('   These might be from GNews fallback or different API responses');
    }
    
    console.log('\n💡 RECOMMENDATIONS:');
    if (result.missing.includes('general')) {
      console.log('   - "general" category might be mapped to "top" in NewsData.io');
    }
    if (result.missing.includes('environment')) {
      console.log('   - "environment" is supported by NewsData.io, check API key/limits');
    }
    if (result.missing.length > result.actualCategories.length) {
      console.log('   - Consider using GNews fallback for missing categories');
      console.log('   - Check API rate limits and quotas');
    }
    
  } else {
    console.log('❌ Diagnosis failed - check server connection');
  }
  
  return result.success;
}

if (require.main === module) {
  runDiagnosis().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { runDiagnosis };