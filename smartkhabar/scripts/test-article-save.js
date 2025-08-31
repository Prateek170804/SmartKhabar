#!/usr/bin/env node

/**
 * Test Article Save Script
 */

require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function testArticleSave() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  console.log('🧪 Testing article save...');
  
  const client = new Client({
    connectionString,
    ssl: connectionString.includes('sslmode=require') ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('✅ Database connected successfully!');
    
    // Create a test article
    const testArticle = {
      id: 'test-article-' + Date.now(),
      title: 'Test Article: AI Revolution in 2025',
      description: 'A comprehensive look at how AI is transforming industries in 2025.',
      content: 'Artificial Intelligence continues to revolutionize various sectors including healthcare, finance, and technology. This article explores the latest developments and their impact on society.',
      url: 'https://example.com/test-article-' + Date.now(),
      image_url: 'https://example.com/image.jpg',
      published_at: new Date(),
      source: 'TechNews',
      source_url: 'https://technews.com',
      author: 'John Doe',
      category: 'technology',
      language: 'en',
      country: 'us'
    };

    const sql = `
      INSERT INTO articles (
        id, title, description, content, url, image_url, 
        published_at, source, source_url, author, category, language, country
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (url) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        content = EXCLUDED.content,
        updated_at = CURRENT_TIMESTAMP
    `;

    await client.query(sql, [
      testArticle.id,
      testArticle.title,
      testArticle.description,
      testArticle.content,
      testArticle.url,
      testArticle.image_url,
      testArticle.published_at,
      testArticle.source,
      testArticle.source_url,
      testArticle.author,
      testArticle.category,
      testArticle.language,
      testArticle.country
    ]);

    console.log('✅ Test article saved successfully!');
    
    // Check if it was saved
    const result = await client.query('SELECT COUNT(*) as count FROM articles');
    console.log(`📰 Total articles in database: ${result.rows[0].count}`);
    
    // Show the saved article
    const articleResult = await client.query('SELECT id, title, source, category FROM articles WHERE id = $1', [testArticle.id]);
    if (articleResult.rows.length > 0) {
      const article = articleResult.rows[0];
      console.log(`📋 Saved article: "${article.title}" from ${article.source} (${article.category})`);
    }
    
    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  testArticleSave();
}