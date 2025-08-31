#!/usr/bin/env node

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function setupEnhancedDatabaseCompatible() {
  console.log('🚀 Setting up Enhanced SmartKhabar Database (Compatible)');
  console.log('====================================================');
  
  // Load environment variables
  require('dotenv').config({ path: '.env.local' });
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Read the compatible SQL schema file
    const schemaPath = path.join(__dirname, 'setup-enhanced-database-compatible.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Execute the schema
    console.log('📝 Executing enhanced database schema...');
    await client.query(schema);
    console.log('✅ Enhanced database schema created successfully');

    // Verify tables were created
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    console.log('\n📊 All tables in database:');
    const newTables = [];
    tablesResult.rows.forEach(row => {
      const isNew = ['user_analytics', 'news_engagement', 'system_metrics', 'performance_metrics', 
                     'user_sessions', 'user_bookmarks', 'reading_history', 'preference_history',
                     'realtime_subscriptions', 'notifications', 'article_cache'].includes(row.table_name);
      console.log(`   ${isNew ? '🆕' : '📋'} ${row.table_name}`);
      if (isNew) newTables.push(row.table_name);
    });

    console.log(`\n✅ Created ${newTables.length} new tables for enhanced features`);

    // Check indexes
    const indexesResult = await client.query(`
      SELECT indexname, tablename 
      FROM pg_indexes 
      WHERE schemaname = 'public'
      AND indexname LIKE 'idx_%'
      ORDER BY tablename, indexname
    `);

    console.log('\n🔍 Enhanced indexes created:');
    indexesResult.rows.forEach(row => {
      console.log(`   - ${row.indexname} on ${row.tablename}`);
    });

    // Insert sample data for testing
    console.log('\n📝 Inserting sample data...');
    
    // Check if test user already exists
    const existingUser = await client.query(`
      SELECT id, email, name FROM users WHERE email = $1
    `, ['test@smartkhabar.com']);

    let userId;
    if (existingUser.rows.length > 0) {
      userId = existingUser.rows[0].id;
      console.log(`✅ Using existing test user: ${existingUser.rows[0].email} (ID: ${userId})`);
      
      // Update user with enhanced subscription data
      await client.query(`
        UPDATE users SET 
          subscription = $1,
          is_active = true,
          email_verified = true
        WHERE id = $2
      `, [
        JSON.stringify({
          plan: 'free',
          status: 'active',
          features: ['basic_news', 'personalization', 'mobile_app']
        }),
        userId
      ]);
    } else {
      // Create a test user with compatible ID format
      const testUserResult = await client.query(`
        INSERT INTO users (id, email, password_hash, name, preferences, subscription, is_active, email_verified)
        VALUES ($1, $2, $3, $4, $5, $6, true, true)
        RETURNING id, email, name
      `, [
        `user_${Date.now()}`, // Use string ID format compatible with existing schema
        'test@smartkhabar.com',
        '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/VJWZp/k/K', // password: 'test123'
        'Test User Enhanced',
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

      userId = testUserResult.rows[0].id;
      console.log(`✅ Created test user: ${testUserResult.rows[0].email} (ID: ${userId})`);
    }

    // Insert sample analytics data
    const sessionId = `session_${Date.now()}`;

    await client.query(`
      INSERT INTO user_analytics (user_id, session_id, event, properties)
      VALUES 
        ($1, $2, 'user_registration', '{"method": "email"}'),
        ($1, $2, 'page_view', '{"page": "/", "referrer": "direct"}'),
        ($1, $2, 'article_view', '{"article_id": "test-article-1", "category": "technology"}')
      ON CONFLICT DO NOTHING
    `, [userId, sessionId]);

    // Insert sample news engagement
    await client.query(`
      INSERT INTO news_engagement (article_id, user_id, action, source, category)
      VALUES 
        ('test-article-1', $1, 'view', 'newsdata', 'technology'),
        ('test-article-2', $1, 'click', 'newsdata', 'business'),
        ('test-article-3', $1, 'share', 'newsdata', 'science')
      ON CONFLICT DO NOTHING
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
      ON CONFLICT (article_id) DO NOTHING
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

    // Test enhanced user data
    const enhancedUser = await client.query(`
      SELECT id, email, name, subscription, is_active, email_verified
      FROM users WHERE id = $1
    `, [userId]);
    
    if (enhancedUser.rows.length > 0) {
      const user = enhancedUser.rows[0];
      console.log(`   - Enhanced user data: ${user.name} (${user.subscription.plan} plan)`);
    }

    console.log('\n🎉 Enhanced database setup completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('   1. Test the enhanced authentication system');
    console.log('   2. Verify real-time features are working');
    console.log('   3. Check analytics dashboard functionality');
    console.log('   4. Test mobile-responsive components');
    console.log('\n🔐 Test user credentials:');
    console.log('   Email: test@smartkhabar.com');
    console.log('   Password: test123');
    console.log(`   User ID: ${userId}`);

  } catch (error) {
    console.error('❌ Error setting up enhanced database:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run the setup
if (require.main === module) {
  setupEnhancedDatabaseCompatible().catch(console.error);
}

module.exports = { setupEnhancedDatabaseCompatible };