-- Enhanced SmartKhabar Database Schema (Compatible with existing structure)
-- This script creates additional tables for enhanced features while preserving existing structure

-- First, let's update the existing users table to add missing columns
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS verification_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP,
ADD COLUMN IF NOT EXISTS subscription JSONB DEFAULT '{"plan": "free", "status": "active", "features": []}';

-- Update existing users to have proper subscription data
UPDATE users 
SET subscription = jsonb_build_object(
  'plan', COALESCE(subscription_plan, 'free'),
  'status', 'active',
  'features', CASE 
    WHEN subscription_plan = 'premium' THEN '["basic_news", "personalization", "analytics", "mobile_app"]'::jsonb
    WHEN subscription_plan = 'enterprise' THEN '["basic_news", "personalization", "analytics", "mobile_app", "api_access", "priority_support"]'::jsonb
    ELSE '["basic_news", "personalization", "mobile_app"]'::jsonb
  END,
  'expiresAt', subscription_expires_at
)
WHERE subscription IS NULL;

-- User analytics events (using VARCHAR for user_id to match existing users table)
CREATE TABLE IF NOT EXISTS user_analytics (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(255) NOT NULL,
    event VARCHAR(100) NOT NULL,
    properties JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_agent TEXT,
    ip_address INET,
    referrer TEXT,
    is_new_user BOOLEAN DEFAULT false
);

-- News engagement tracking
CREATE TABLE IF NOT EXISTS news_engagement (
    id SERIAL PRIMARY KEY,
    article_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL, -- view, click, share, bookmark, like, comment
    duration INTEGER, -- in seconds
    scroll_depth FLOAT, -- percentage 0-100
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    source VARCHAR(100) NOT NULL,
    category VARCHAR(100) NOT NULL,
    device_type VARCHAR(50),
    referrer TEXT
);

-- System metrics for monitoring
CREATE TABLE IF NOT EXISTS system_metrics (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metric VARCHAR(100) NOT NULL,
    value FLOAT NOT NULL,
    tags JSONB DEFAULT '{}'
);

-- API performance metrics
CREATE TABLE IF NOT EXISTS performance_metrics (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    response_time INTEGER NOT NULL, -- in milliseconds
    status_code INTEGER NOT NULL,
    user_agent TEXT,
    user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
    request_size INTEGER,
    response_size INTEGER
);

-- User sessions for better tracking
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    device_info JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true
);

-- Saved articles/bookmarks
CREATE TABLE IF NOT EXISTS user_bookmarks (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
    article_id VARCHAR(255) NOT NULL,
    article_data JSONB NOT NULL, -- Store article snapshot
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    tags TEXT[],
    notes TEXT,
    UNIQUE(user_id, article_id)
);

-- User reading history
CREATE TABLE IF NOT EXISTS reading_history (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
    article_id VARCHAR(255) NOT NULL,
    article_data JSONB NOT NULL,
    read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reading_time INTEGER, -- in seconds
    completion_percentage FLOAT DEFAULT 0,
    source VARCHAR(100),
    category VARCHAR(100)
);

-- User preferences history for ML
CREATE TABLE IF NOT EXISTS preference_history (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
    preference_type VARCHAR(100) NOT NULL, -- topic, source, tone, etc.
    old_value JSONB,
    new_value JSONB,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reason VARCHAR(255) -- manual, auto-learned, etc.
);

-- Real-time subscriptions
CREATE TABLE IF NOT EXISTS realtime_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
    connection_id VARCHAR(255) NOT NULL,
    subscription_type VARCHAR(100) NOT NULL, -- category, source, keyword, user
    filters JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- Notification preferences and history
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL, -- breaking, digest, personalized
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    clicked_at TIMESTAMP WITH TIME ZONE,
    delivery_method VARCHAR(50), -- email, push, in-app
    status VARCHAR(50) DEFAULT 'pending' -- pending, sent, delivered, failed
);

-- Article cache for better performance (enhance existing articles table functionality)
CREATE TABLE IF NOT EXISTS article_cache (
    id SERIAL PRIMARY KEY,
    article_id VARCHAR(255) UNIQUE NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    summary TEXT,
    source VARCHAR(100),
    category VARCHAR(100),
    published_at TIMESTAMP WITH TIME ZONE,
    image_url TEXT,
    url TEXT,
    tags TEXT[],
    sentiment VARCHAR(50),
    priority INTEGER DEFAULT 0,
    cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '24 hours',
    view_count INTEGER DEFAULT 0,
    engagement_score FLOAT DEFAULT 0
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_analytics_user_id ON user_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_user_analytics_timestamp ON user_analytics(timestamp);
CREATE INDEX IF NOT EXISTS idx_user_analytics_event ON user_analytics(event);

CREATE INDEX IF NOT EXISTS idx_news_engagement_article_id ON news_engagement(article_id);
CREATE INDEX IF NOT EXISTS idx_news_engagement_user_id ON news_engagement(user_id);
CREATE INDEX IF NOT EXISTS idx_news_engagement_timestamp ON news_engagement(timestamp);
CREATE INDEX IF NOT EXISTS idx_news_engagement_action ON news_engagement(action);

CREATE INDEX IF NOT EXISTS idx_system_metrics_timestamp ON system_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_system_metrics_metric ON system_metrics(metric);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp ON performance_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_endpoint ON performance_metrics(endpoint);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON user_sessions(session_id);

CREATE INDEX IF NOT EXISTS idx_user_bookmarks_user_id ON user_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_reading_history_user_id ON reading_history(user_id);

CREATE INDEX IF NOT EXISTS idx_article_cache_article_id ON article_cache(article_id);
CREATE INDEX IF NOT EXISTS idx_article_cache_category ON article_cache(category);
CREATE INDEX IF NOT EXISTS idx_article_cache_expires_at ON article_cache(expires_at);

-- Create GIN indexes for JSONB columns
CREATE INDEX IF NOT EXISTS idx_users_preferences ON users USING GIN(preferences);
CREATE INDEX IF NOT EXISTS idx_users_subscription ON users USING GIN(subscription);
CREATE INDEX IF NOT EXISTS idx_user_analytics_properties ON user_analytics USING GIN(properties);
CREATE INDEX IF NOT EXISTS idx_system_metrics_tags ON system_metrics USING GIN(tags);

-- Create function for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for automatic timestamp updates (only if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_users_updated_at') THEN
        CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END
$$;

-- Create function to clean up old data
CREATE OR REPLACE FUNCTION cleanup_old_analytics_data()
RETURNS void AS $$
BEGIN
    -- Delete analytics data older than 90 days
    DELETE FROM user_analytics WHERE timestamp < NOW() - INTERVAL '90 days';
    DELETE FROM news_engagement WHERE timestamp < NOW() - INTERVAL '90 days';
    DELETE FROM system_metrics WHERE timestamp < NOW() - INTERVAL '30 days';
    DELETE FROM performance_metrics WHERE timestamp < NOW() - INTERVAL '30 days';
    
    -- Delete expired article cache
    DELETE FROM article_cache WHERE expires_at < NOW();
    
    -- Delete inactive sessions
    DELETE FROM user_sessions WHERE last_activity < NOW() - INTERVAL '30 days';
    
    -- Delete old notifications
    DELETE FROM notifications WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Insert default system metrics
INSERT INTO system_metrics (metric, value, tags) VALUES
('system_startup', 1, '{"version": "2.0.0", "environment": "enhanced"}'),
('database_enhanced', 1, '{"schema_version": "2.0.0", "compatible": true}')
ON CONFLICT DO NOTHING;

-- Create materialized view for analytics dashboard
DROP MATERIALIZED VIEW IF EXISTS analytics_summary;
CREATE MATERIALIZED VIEW analytics_summary AS
SELECT 
    DATE(timestamp) as date,
    COUNT(DISTINCT user_id) as daily_active_users,
    COUNT(*) as total_events,
    COUNT(DISTINCT session_id) as total_sessions,
    COUNT(CASE WHEN event = 'page_view' THEN 1 END) as page_views
FROM user_analytics 
WHERE timestamp >= NOW() - INTERVAL '30 days'
GROUP BY DATE(timestamp)
ORDER BY date DESC;

-- Create index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_summary_date ON analytics_summary(date);

-- Refresh materialized view function
CREATE OR REPLACE FUNCTION refresh_analytics_summary()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY analytics_summary;
EXCEPTION
    WHEN OTHERS THEN
        REFRESH MATERIALIZED VIEW analytics_summary;
END;
$$ LANGUAGE plpgsql;

COMMIT;