#!/usr/bin/env node

/**
 * Add Sample Articles Script
 */

require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function addSampleArticles() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  console.log('📰 Adding sample articles...');
  
  const client = new Client({
    connectionString,
    ssl: connectionString.includes('sslmode=require') ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('✅ Database connected successfully!');
    
    const sampleArticles = [
      {
        id: 'business-' + Date.now(),
        title: 'Global Markets Rally as Tech Stocks Surge',
        description: 'Major stock indices reached new highs as technology companies reported strong quarterly earnings.',
        content: 'Global financial markets experienced significant gains today as major technology companies reported better-than-expected quarterly earnings. The surge was led by artificial intelligence and cloud computing companies, with investors showing renewed confidence in the tech sector. Market analysts predict continued growth as digital transformation accelerates across industries.',
        url: 'https://example.com/business-' + Date.now(),
        image_url: 'https://example.com/business-image.jpg',
        published_at: new Date(),
        source: 'BusinessDaily',
        source_url: 'https://businessdaily.com',
        author: 'Sarah Johnson',
        category: 'business',
        language: 'en',
        country: 'us'
      },
      {
        id: 'science-' + Date.now(),
        title: 'Breakthrough in Quantum Computing Achieved',
        description: 'Scientists announce major advancement in quantum error correction, bringing practical quantum computers closer to reality.',
        content: 'Researchers at leading universities have achieved a significant breakthrough in quantum error correction, a critical step toward building practical quantum computers. The new method reduces quantum decoherence by 90%, potentially enabling quantum computers to solve complex problems in cryptography, drug discovery, and climate modeling. This advancement could revolutionize computing within the next decade.',
        url: 'https://example.com/science-' + Date.now(),
        image_url: 'https://example.com/science-image.jpg',
        published_at: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        source: 'ScienceToday',
        source_url: 'https://sciencetoday.com',
        author: 'Dr. Michael Chen',
        category: 'science',
        language: 'en',
        country: 'us'
      },
      {
        id: 'general-' + Date.now(),
        title: 'New Environmental Initiative Launched Globally',
        description: 'International coalition announces ambitious plan to reduce carbon emissions by 50% within the next decade.',
        content: 'A coalition of 50 countries has announced an ambitious environmental initiative aimed at reducing global carbon emissions by 50% within the next decade. The plan includes massive investments in renewable energy, reforestation projects, and sustainable transportation systems. Environmental experts praise the initiative as a crucial step toward addressing climate change, though some question whether the timeline is realistic.',
        url: 'https://example.com/general-' + Date.now(),
        image_url: 'https://example.com/general-image.jpg',
        published_at: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
        source: 'GlobalNews',
        source_url: 'https://globalnews.com',
        author: 'Emma Rodriguez',
        category: 'general',
        language: 'en',
        country: 'us'
      }
    ];

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

    for (const article of sampleArticles) {
      try {
        await client.query(sql, [
          article.id,
          article.title,
          article.description,
          article.content,
          article.url,
          article.image_url,
          article.published_at,
          article.source,
          article.source_url,
          article.author,
          article.category,
          article.language,
          article.country
        ]);
        console.log(`✅ Added: "${article.title}" (${article.category})`);
      } catch (error) {
        console.error(`❌ Failed to add article: ${article.title}`, error.message);
      }
    }
    
    // Check final count
    const result = await client.query('SELECT COUNT(*) as count FROM articles');
    console.log(`🎉 Total articles in database: ${result.rows[0].count}`);
    
    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to add sample articles:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  addSampleArticles();
}