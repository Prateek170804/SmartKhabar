#!/usr/bin/env node

/**
 * Database Content Check Script
 */

require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function checkDatabaseContent() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  console.log('🔍 Checking database content...');
  
  const client = new Client({
    connectionString,
    ssl: connectionString.includes('sslmode=require') ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('✅ Database connected successfully!');
    
    // Check articles table
    const articlesResult = await client.query('SELECT COUNT(*) as count FROM articles');
    console.log(`📰 Articles in database: ${articlesResult.rows[0].count}`);
    
    if (articlesResult.rows[0].count > 0) {
      const sampleArticles = await client.query('SELECT id, title, source, category, published_at FROM articles LIMIT 3');
      console.log('📋 Sample articles:');
      sampleArticles.rows.forEach((article, index) => {
        console.log(`   ${index + 1}. ${article.title} (${article.source})`);
      });
    }
    
    // Check user_preferences table
    const preferencesResult = await client.query('SELECT COUNT(*) as count FROM user_preferences');
    console.log(`👤 User preferences in database: ${preferencesResult.rows[0].count}`);
    
    // Check user_interactions table
    const interactionsResult = await client.query('SELECT COUNT(*) as count FROM user_interactions');
    console.log(`🔄 User interactions in database: ${interactionsResult.rows[0].count}`);
    
    // Check collection_status table
    const statusResult = await client.query('SELECT COUNT(*) as count FROM collection_status');
    console.log(`📊 Collection status records: ${statusResult.rows[0].count}`);
    
    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Check failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  checkDatabaseContent();
}