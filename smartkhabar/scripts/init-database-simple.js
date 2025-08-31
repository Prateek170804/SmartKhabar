#!/usr/bin/env node

/**
 * Simple Database Initialization Script
 */

require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function initializeDatabase() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  console.log('🔧 Initializing database tables...');
  
  const client = new Client({
    connectionString,
    ssl: connectionString.includes('sslmode=require') ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('✅ Database connected successfully!');
    
    // Create tables
    const tables = [
      // Articles table
      `CREATE TABLE IF NOT EXISTS articles (
        id VARCHAR(255) PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        content TEXT,
        url TEXT UNIQUE NOT NULL,
        image_url TEXT,
        published_at TIMESTAMP,
        source VARCHAR(255),
        source_url TEXT,
        author VARCHAR(255),
        category VARCHAR(100),
        language VARCHAR(10) DEFAULT 'en',
        country VARCHAR(10) DEFAULT 'us',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // User preferences table
      `CREATE TABLE IF NOT EXISTS user_preferences (
        user_id VARCHAR(255) PRIMARY KEY,
        topics TEXT[],
        tone VARCHAR(50) DEFAULT 'casual',
        reading_time INTEGER DEFAULT 5,
        preferred_sources TEXT[],
        excluded_sources TEXT[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // User interactions table
      `CREATE TABLE IF NOT EXISTS user_interactions (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255),
        article_id VARCHAR(255),
        interaction_type VARCHAR(50),
        interaction_data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // Collection status table
      `CREATE TABLE IF NOT EXISTS collection_status (
        id SERIAL PRIMARY KEY,
        source VARCHAR(100),
        status VARCHAR(50),
        articles_collected INTEGER DEFAULT 0,
        errors TEXT[],
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    for (const [index, table] of tables.entries()) {
      try {
        await client.query(table);
        console.log(`✅ Table ${index + 1}/${tables.length} created/verified successfully`);
      } catch (error) {
        console.error(`❌ Failed to create table ${index + 1}:`, error.message);
      }
    }
    
    console.log('🎉 Database initialization completed!');
    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  initializeDatabase();
}