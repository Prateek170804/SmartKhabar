#!/usr/bin/env node

/**
 * Neon Database Setup Script
 * Creates all necessary tables for SmartKhabar
 */

const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const createTablesSQL = `
-- Users table for storing user preferences
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  topics TEXT[] DEFAULT '{}',
  tone VARCHAR(20) DEFAULT 'casual' CHECK (tone IN ('formal', 'casual', 'fun')),
  reading_time INTEGER DEFAULT 5 CHECK (reading_time > 0),
  preferred_sources TEXT[] DEFAULT '{}',
  excluded_sources TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Articles table for storing collected news
CREATE TABLE IF NOT EXISTS articles (
  id VARCHAR(255) PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  url TEXT UNIQUE NOT NULL,
  image_url TEXT,
  published_at TIMESTAMP WITH TIME ZONE,
  source VARCHAR(255),
  source_url TEXT,
  author VARCHAR(255),
  category VARCHAR(100),
  language VARCHAR(10) DEFAULT 'en',
  country VARCHAR(10) DEFAULT 'us',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Article embeddings for semantic search
CREATE TABLE IF NOT EXISTS article_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id VARCHAR(255) REFERENCES articles(id) ON DELETE CASCADE,
  embedding VECTOR(384), -- Adjust dimension based on your embedding model
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(article_id)
);

-- User interactions for learning preferences
CREATE TABLE IF NOT EXISTS user_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  article_id VARCHAR(255) REFERENCES articles(id) ON DELETE CASCADE,
  interaction_type VARCHAR(50) NOT NULL CHECK (interaction_type IN ('view', 'like', 'dislike', 'share', 'save')),
  interaction_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Article summaries cache
CREATE TABLE IF NOT EXISTS article_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id VARCHAR(255) REFERENCES articles(id) ON DELETE CASCADE,
  tone VARCHAR(20) NOT NULL CHECK (tone IN ('formal', 'casual', 'fun')),
  reading_time INTEGER NOT NULL CHECK (reading_time > 0),
  summary TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(article_id, tone, reading_time)
);

-- News collection status
CREATE TABLE IF NOT EXISTS collection_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source VARCHAR(255) NOT NULL,
  last_collection TIMESTAMP WITH TIME ZONE,
  articles_collected INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'idle' CHECK (status IN ('idle', 'running', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(source)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);
CREATE INDEX IF NOT EXISTS idx_articles_source ON articles(source);
CREATE INDEX IF NOT EXISTS idx_user_interactions_user_id ON user_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_article_id ON user_interactions(article_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_type ON user_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_article_summaries_article_id ON article_summaries(article_id);
CREATE INDEX IF NOT EXISTS idx_collection_status_source ON collection_status(source);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_articles_updated_at ON articles;
CREATE TRIGGER update_articles_updated_at BEFORE UPDATE ON articles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_article_summaries_updated_at ON article_summaries;
CREATE TRIGGER update_article_summaries_updated_at BEFORE UPDATE ON article_summaries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_collection_status_updated_at ON collection_status;
CREATE TRIGGER update_collection_status_updated_at BEFORE UPDATE ON collection_status FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
`;

async function setupDatabase() {
  console.log('🚀 Setting up Neon database for SmartKhabar...\n');

  try {
    // Test connection
    console.log('📡 Connecting to Neon database...');
    await client.connect();
    console.log('✅ Connected successfully!\n');

    // Get database info
    const versionResult = await client.query('SELECT version()');
    console.log('📊 Database info:');
    console.log(`   ${versionResult.rows[0].version.split(' ').slice(0, 2).join(' ')}\n`);

    // Create tables
    console.log('🏗️  Creating tables and indexes...');
    await client.query(createTablesSQL);
    console.log('✅ All tables created successfully!\n');

    // Verify tables
    console.log('🔍 Verifying table creation...');
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);

    console.log('📋 Created tables:');
    tablesResult.rows.forEach(row => {
      console.log(`   ✓ ${row.table_name}`);
    });

    console.log('\n🎉 Database setup completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Run: npm run dev');
    console.log('   2. Visit: http://localhost:3000');
    console.log('   3. Test: http://localhost:3000/api/health');

  } catch (error) {
    console.error('\n❌ Database setup failed:');
    console.error(`   Error: ${error.message}`);
    
    if (error.message.includes('password authentication failed')) {
      console.error('\n💡 Troubleshooting:');
      console.error('   - Check your DATABASE_URL in .env.local');
      console.error('   - Make sure you copied the full connection string from Neon');
      console.error('   - Verify your username and password are correct');
    }
    
    if (error.message.includes('does not exist')) {
      console.error('\n💡 Troubleshooting:');
      console.error('   - Make sure your Neon project is created');
      console.error('   - Check the database name in your connection string');
      console.error('   - Visit https://console.neon.tech to verify your project');
    }

    process.exit(1);
  } finally {
    await client.end();
  }
}

// Check if DATABASE_URL is set
if (!process.env.DATABASE_URL || process.env.DATABASE_URL === 'your_neon_connection_string_here') {
  console.error('❌ DATABASE_URL not configured!');
  console.error('\n📋 Please follow these steps:');
  console.error('   1. Go to https://neon.tech');
  console.error('   2. Create a new project');
  console.error('   3. Copy your connection string');
  console.error('   4. Add it to .env.local as DATABASE_URL=your_connection_string');
  console.error('\n📖 See NEON_SETUP_INSTRUCTIONS.md for detailed guide');
  process.exit(1);
}

if (require.main === module) {
  setupDatabase();
}

module.exports = { setupDatabase };