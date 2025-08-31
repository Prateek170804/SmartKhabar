#!/usr/bin/env node

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function setupEnhancedDatabase() {
  console.log('🚀 Setting up Enhanced SmartKhabar Database');
  console.log('==========================================');
  
  // Load environment variables
  require('dotenv').config({ path: '.env.local' });
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Read the SQL schema file
    const schemaPath = path.join(__dirname, 'setup-enhanced-database.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Execute the schema
    console.log('📝 Executing database schema...');
    await client.query(schema);
    console.log('✅ Database schema created successfully');

    // Verify tables were created
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    console.log('\n📊 Created tables:');
    tablesResult.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });

    // Check indexes
    const indexesResult = await client.query(`
      SELECT indexname, tablename 
      FROM pg_indexes 
      WHERE schemaname = 'public'
      AND indexname LIKE 'idx_%'
      ORDER BY tablename, indexname
    `);

    console.log('\n🔍 Created indexes:');
    indexesResult.rows.forEach(row => {
      console.log(`   - ${row.indexname} on ${row.tablename}`);
    });

    // Insert sample data for testing
    console.log('\n📝 Inserting sample data...');
    
    // Create a test user
    const testUser = await client.query(`
      INSERT INTO users (email, password_hash, name, preferences, subscription)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (email) DO UPDATE SET
        name = EXCLUDED.name,
        preferences = EXCLUDED.preferences,
        subscription = EXCLUDED.subscription
      RETURNING id, email, name
    `, [
      'test@smartkhabar.com',
      '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/VJWZp/k/K', // password: 'test123'
      'Test User',
      JSON.stringify({
        topics: ['technology', 'business', 'science'],
        sources: ['bbc-news', 'techcrunch'],
        tone: 'casual',
        readingTime: 5,
        language: 'en',
        timezone: 'UTC',
        notifications: {
          email: true,
          push: false,
          breaking: true,
          digest: true,
          frequency: 'daily'
        },
        layout: {
          theme: 'light',
          density: 'comfortable',
          cardStyle: 'detailed',
          showImages: true,
          showSummaries: true
        }
      }),
      JSON.stringify({
        plan: 'free',
        status: 'active',
        features: ['basic_news', 'personalization', 'mobile_app']
      })
    ]);

    console.log(`✅ Created test user: ${testUser.rows[0].email} (ID: ${testUser.rows[0].id})`);

    // Insert sample analytics data
    const userId = testUser.rows[0].id;
    const sessionId = `session_${Date.now()}`;

    await client.query(`
      INSERT INTO user_analytics (user_id, session_id, event, properties)
      VALUES 
        ($1, $2, 'user_registration', '{"method": "email"}'),
        ($1, $2, 'page_view', '{"page": "/", "referrer": "direct"}'),
        ($1, $2, 'article_view', '{"article_id": "test-article-1", "category": "technology"}')
    `, [userId, sessionId]);

    // Insert sample news engagement
    await client.query(`
      INSERT INTO news_engagement (article_id, user_id, action, source, category)
      VALUES 
        ('test-article-1', $1, 'view', 'newsdata', 'technology'),
        ('test-article-2', $1, 'click', 'newsdata', 'business'),
        ('test-article-3', $1, 'share', 'newsdata', 'science')
    `, [userId]);

    // Insert sample system metrics
    await client.query(`
      INSERT INTO system_metrics (metric, value, tags)
      VALUES 
        ('cpu_usage', 45.2, '{"server": "web-1"}'),
        ('memory_usage', 67.8, '{"server": "web-1"}'),
        ('active_connections', 23, '{"type": "websocket"}')
    `);

    // Insert sample article cache
    await client.query(`
      INSERT INTO article_cache (article_id, title, content, source, category, published_at, url)
      VALUES 
        ('test-article-1', 'Sample Technology Article', 'This is a sample technology article for testing purposes.', 'newsdata', 'technology', NOW() - INTERVAL '2 hours', 'https://example.com/tech-article'),
        ('test-article-2', 'Sample Business Article', 'This is a sample business article for testing purposes.', 'newsdata', 'business', NOW() - INTERVAL '1 hour', 'https://example.com/business-article'),
        ('test-article-3', 'Sample Science Article', 'This is a sample science article for testing purposes.', 'newsdata', 'science', NOW() - INTERVAL '30 minutes', 'https://example.com/science-article')
    `);

    console.log('✅ Sample data inserted successfully');

    // Refresh materialized view
    console.log('\n🔄 Refreshing analytics summary...');
    await client.query('SELECT refresh_analytics_summary()');
    console.log('✅ Analytics summary refreshed');

    // Test queries
    console.log('\n🧪 Running test queries...');
    
    const userCount = await client.query('SELECT COUNT(*) as count FROM users');
    console.log(`   - Total users: ${userCount.rows[0].count}`);
    
    const analyticsCount = await client.query('SELECT COUNT(*) as count FROM user_analytics');
    console.log(`   - Analytics events: ${analyticsCount.rows[0].count}`);
    
    const engagementCount = await client.query('SELECT COUNT(*) as count FROM news_engagement');
    console.log(`   - Engagement events: ${engagementCount.rows[0].count}`);
    
    const metricsCount = await client.query('SELECT COUNT(*) as count FROM system_metrics');
    console.log(`   - System metrics: ${metricsCount.rows[0].count}`);

    // Test analytics summary view
    const summaryResult = await client.query('SELECT * FROM analytics_summary LIMIT 5');
    console.log(`   - Analytics summary rows: ${summaryResult.rows.length}`);

    console.log('\n🎉 Enhanced database setup completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('   1. Update your application to use the new enhanced features');
    console.log('   2. Test the authentication system with the sample user');
    console.log('   3. Verify real-time features are working');
    console.log('   4. Check analytics dashboard functionality');
    console.log('\n🔐 Test user credentials:');
    console.log('   Email: test@smartkhabar.com');
    console.log('   Password: test123');

  } catch (error) {
    console.error('❌ Error setting up database:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run the setup
if (require.main === module) {
  setupEnhancedDatabase().catch(console.error);
}

module.exports = { setupEnhancedDatabase };