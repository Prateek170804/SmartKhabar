#!/usr/bin/env node

/**
 * Database Initialization Script
 * Creates necessary tables in Neon PostgreSQL database
 */

require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function initializeDatabase() {
  console.log('🔧 Initializing Neon Database...\n');
  
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const client = new Client({
    connectionString
  });

  try {
    await client.connect();
    console.log('✅ Connected to Neon database');

    // Create tables
    const tables = [
      {
        name: 'articles',
        sql: `CREATE TABLE IF NOT EXISTS articles (
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
        )`
      },
      {
        name: 'user_preferences',
        sql: `CREATE TABLE IF NOT EXISTS user_preferences (
          user_id VARCHAR(255) PRIMARY KEY,
          topics TEXT[],
          tone VARCHAR(50) DEFAULT 'casual',
          reading_time INTEGER DEFAULT 5,
          preferred_sources TEXT[],
          excluded_sources TEXT[],
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
      },
      {
        name: 'user_interactions',
        sql: `CREATE TABLE IF NOT EXISTS user_interactions (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR(255),
          article_id VARCHAR(255),
          interaction_type VARCHAR(50),
          interaction_data JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
      },
      {
        name: 'collection_status',
        sql: `CREATE TABLE IF NOT EXISTS collection_status (
          id SERIAL PRIMARY KEY,
          source VARCHAR(100),
          status VARCHAR(50),
          articles_collected INTEGER DEFAULT 0,
          errors TEXT[],
          started_at TIMESTAMP,
          completed_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
      }
    ];

    for (const table of tables) {
      try {
        await client.query(table.sql);
        console.log(`✅ Table '${table.name}' created/verified`);
      } catch (error) {
        console.error(`❌ Failed to create table '${table.name}':`, error.message);
      }
    }

    // Test insert and select
    try {
      const testResult = await client.query('SELECT COUNT(*) as count FROM articles');
      console.log(`✅ Database test successful - Articles table has ${testResult.rows[0].count} records`);
    } catch (error) {
      console.error('❌ Database test failed:', error.message);
    }

    console.log('\n🎉 Database initialization completed!');

  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  initializeDatabase().catch(console.error);
}

module.exports = { initializeDatabase };