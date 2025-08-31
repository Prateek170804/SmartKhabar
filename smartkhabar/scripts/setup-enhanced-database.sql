-- Enhanced SmartKhabar Database Schema
-- This script creates all necessary tables for the enhanced features

-- Users table with enhanced authentication and preferences
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    avatar TEXT,
    preferences JSONB DEFAULT '{}',
    subscription JSONB DEFAULT '{"plan": "free", "status": "active", "features": []}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    verification_token VARCHAR(255),
    reset_token VARCHAR(255),
    reset_token_expires TIMESTAMP WITH TIME ZONE
);

-- User analytics events
CREATE TABLE IF NOT EXISTS user_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id VARCHAR(255) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metric VARCHAR(100) NOT NULL,
    value FLOAT NOT NULL,
    tags JSONB DEFAULT '{}'
);

-- API performance metrics
CREATE TABLE IF NOT EXISTS performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    response_time INTEGER NOT NULL, -- in milliseconds
    status_code INTEGER NOT NULL,
    user_agent TEXT,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    request_size INTEGER,
    response_size INTEGER
);

-- User sessions for better tracking
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    article_id VARCHAR(255) NOT NULL,
    article_data JSONB NOT NULL, -- Store article snapshot
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    tags TEXT[],
    notes TEXT,
    UNIQUE(user_id, article_id)
);

-- User reading history
CREATE TABLE IF NOT EXISTS reading_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    preference_type VARCHAR(100) NOT NULL, -- topic, source, tone, etc.
    old_value JSONB,
    new_value JSONB,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reason VARCHAR(255) -- manual, auto-learned, etc.
);

-- Real-time subscriptions
CREATE TABLE IF NOT EXISTS realtime_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    connection_id VARCHAR(255) NOT NULL,
    subscription_type VARCHAR(100) NOT NULL, -- category, source, keyword, user
    filters JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- Notification preferences and history
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
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

-- Article cache for better performance
CREATE TABLE IF NOT EXISTS article_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
CREATE INDEX IF NOT EXISTS idx_user_analytics_properties ON user_analytics USING GIN(properties);
CREATE INDEX IF NOT EXISTS idx_system_metrics_tags ON system_metrics USING GIN(tags);

-- Create functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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

-- Create a scheduled job to run cleanup (if using pg_cron extension)
-- SELECT cron.schedule('cleanup-analytics', '0 2 * * *', 'SELECT cleanup_old_analytics_data();');

-- Insert default system metrics
INSERT INTO system_metrics (metric, value, tags) VALUES
('system_startup', 1, '{"version": "1.0.0", "environment": "production"}'),
('database_initialized', 1, '{"schema_version": "2.0.0"}')
ON CONFLICT DO NOTHING;

-- Create materialized view for analytics dashboard
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics_summary AS
SELECT 
    DATE(timestamp) as date,
    COUNT(DISTINCT user_id) as daily_active_users,
    COUNT(*) as total_events,
    COUNT(DISTINCT session_id) as total_sessions,
    AVG(CASE WHEN event = 'page_view' THEN 1 ELSE 0 END) as avg_page_views
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
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO your_app_user;

COMMIT;