import { getNeonClient } from '@/lib/database/neon-client';
import { getLogger } from '@/lib/monitoring/production-logger';

const logger = getLogger();

export interface UserAnalytics {
  userId: string;
  sessionId: string;
  event: string;
  properties: Record<string, any>;
  timestamp: Date;
  userAgent?: string;
  ipAddress?: string;
  referrer?: string;
}

export interface SystemMetrics {
  timestamp: Date;
  metric: string;
  value: number;
  tags: Record<string, string>;
}

export interface NewsEngagement {
  articleId: string;
  userId?: string;
  action: 'view' | 'click' | 'share' | 'bookmark' | 'like' | 'comment';
  duration?: number;
  scrollDepth?: number;
  timestamp: Date;
  source: string;
  category: string;
}

export interface PerformanceMetrics {
  timestamp: Date;
  endpoint: string;
  method: string;
  responseTime: number;
  statusCode: number;
  userAgent?: string;
  userId?: string;
}

export class ComprehensiveAnalytics {
  private batchSize = 100;
  private flushInterval = 30000; // 30 seconds
  private eventQueue: UserAnalytics[] = [];
  private metricsQueue: SystemMetrics[] = [];
  private engagementQueue: NewsEngagement[] = [];
  private performanceQueue: PerformanceMetrics[] = [];
  private flushTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.startBatchProcessor();
  }

  // User Analytics
  async trackUserEvent(event: Omit<UserAnalytics, 'timestamp'>): Promise<void> {
    const analyticsEvent: UserAnalytics = {
      ...event,
      timestamp: new Date()
    };

    this.eventQueue.push(analyticsEvent);
    
    if (this.eventQueue.length >= this.batchSize) {
      await this.flushEvents();
    }
  }

  async trackPageView(userId: string, sessionId: string, page: string, properties: Record<string, any> = {}): Promise<void> {
    await this.trackUserEvent({
      userId,
      sessionId,
      event: 'page_view',
      properties: {
        page,
        ...properties
      }
    });
  }

  async trackUserRegistration(userId: string, sessionId: string, method: string): Promise<void> {
    await this.trackUserEvent({
      userId,
      sessionId,
      event: 'user_registration',
      properties: {
        method,
        timestamp: new Date().toISOString()
      }
    });
  }

  async trackUserLogin(userId: string, sessionId: string, method: string): Promise<void> {
    await this.trackUserEvent({
      userId,
      sessionId,
      event: 'user_login',
      properties: {
        method,
        timestamp: new Date().toISOString()
      }
    });
  }

  // News Engagement Analytics
  async trackNewsEngagement(engagement: Omit<NewsEngagement, 'timestamp'>): Promise<void> {
    const engagementEvent: NewsEngagement = {
      ...engagement,
      timestamp: new Date()
    };

    this.engagementQueue.push(engagementEvent);
    
    if (this.engagementQueue.length >= this.batchSize) {
      await this.flushEngagement();
    }
  }

  async trackArticleView(articleId: string, userId: string | undefined, source: string, category: string, duration?: number): Promise<void> {
    await this.trackNewsEngagement({
      articleId,
      userId,
      action: 'view',
      duration,
      source,
      category
    });
  }

  async trackArticleClick(articleId: string, userId: string | undefined, source: string, category: string): Promise<void> {
    await this.trackNewsEngagement({
      articleId,
      userId,
      action: 'click',
      source,
      category
    });
  }

  async trackArticleShare(articleId: string, userId: string | undefined, source: string, category: string, platform: string): Promise<void> {
    await this.trackNewsEngagement({
      articleId,
      userId,
      action: 'share',
      source,
      category
    });

    // Also track as user event
    if (userId) {
      await this.trackUserEvent({
        userId,
        sessionId: 'unknown',
        event: 'article_shared',
        properties: {
          articleId,
          platform,
          source,
          category
        }
      });
    }
  }

  // System Metrics
  async trackSystemMetric(metric: string, value: number, tags: Record<string, string> = {}): Promise<void> {
    const systemMetric: SystemMetrics = {
      timestamp: new Date(),
      metric,
      value,
      tags
    };

    this.metricsQueue.push(systemMetric);
    
    if (this.metricsQueue.length >= this.batchSize) {
      await this.flushMetrics();
    }
  }

  async trackAPIPerformance(performance: Omit<PerformanceMetrics, 'timestamp'>): Promise<void> {
    const performanceMetric: PerformanceMetrics = {
      ...performance,
      timestamp: new Date()
    };

    this.performanceQueue.push(performanceMetric);
    
    if (this.performanceQueue.length >= this.batchSize) {
      await this.flushPerformance();
    }
  }

  // Real-time Analytics Queries
  async getUserEngagementStats(userId: string, days: number = 30): Promise<{
    totalEvents: number;
    articlesViewed: number;
    articlesShared: number;
    averageSessionDuration: number;
    topCategories: Array<{ category: string; count: number }>;
    dailyActivity: Array<{ date: string; events: number }>;
  }> {
    const client = await getNeonClient();
    
    try {
      const [totalEvents, articlesViewed, articlesShared, topCategories, dailyActivity] = await Promise.all([
        // Total events
        client.query(`
          SELECT COUNT(*) as count
          FROM user_analytics 
          WHERE user_id = $1 AND timestamp >= NOW() - INTERVAL '${days} days'
        `, [userId]),
        
        // Articles viewed
        client.query(`
          SELECT COUNT(*) as count
          FROM news_engagement 
          WHERE user_id = $1 AND action = 'view' AND timestamp >= NOW() - INTERVAL '${days} days'
        `, [userId]),
        
        // Articles shared
        client.query(`
          SELECT COUNT(*) as count
          FROM news_engagement 
          WHERE user_id = $1 AND action = 'share' AND timestamp >= NOW() - INTERVAL '${days} days'
        `, [userId]),
        
        // Top categories
        client.query(`
          SELECT category, COUNT(*) as count
          FROM news_engagement 
          WHERE user_id = $1 AND timestamp >= NOW() - INTERVAL '${days} days'
          GROUP BY category
          ORDER BY count DESC
          LIMIT 10
        `, [userId]),
        
        // Daily activity
        client.query(`
          SELECT DATE(timestamp) as date, COUNT(*) as events
          FROM user_analytics 
          WHERE user_id = $1 AND timestamp >= NOW() - INTERVAL '${days} days'
          GROUP BY DATE(timestamp)
          ORDER BY date DESC
        `, [userId])
      ]);

      return {
        totalEvents: parseInt(totalEvents.rows[0]?.count || '0'),
        articlesViewed: parseInt(articlesViewed.rows[0]?.count || '0'),
        articlesShared: parseInt(articlesShared.rows[0]?.count || '0'),
        averageSessionDuration: 0, // Calculate from session data
        topCategories: topCategories.rows,
        dailyActivity: dailyActivity.rows
      };
    } finally {
      // Neon client doesn't need manual release
    }
  }

  async getSystemHealthMetrics(): Promise<{
    apiResponseTimes: Array<{ endpoint: string; avgResponseTime: number; requestCount: number }>;
    errorRates: Array<{ endpoint: string; errorRate: number; totalRequests: number }>;
    activeUsers: number;
    newsEngagementRate: number;
    systemLoad: Array<{ metric: string; value: number; timestamp: string }>;
  }> {
    const client = await getNeonClient();
    
    try {
      const [apiPerformance, errorRates, activeUsers, engagementRate, systemLoad] = await Promise.all([
        // API Response Times
        client.query(`
          SELECT 
            endpoint,
            AVG(response_time) as avg_response_time,
            COUNT(*) as request_count
          FROM performance_metrics 
          WHERE timestamp >= NOW() - INTERVAL '1 hour'
          GROUP BY endpoint
          ORDER BY avg_response_time DESC
        `),
        
        // Error Rates
        client.query(`
          SELECT 
            endpoint,
            (COUNT(CASE WHEN status_code >= 400 THEN 1 END) * 100.0 / COUNT(*)) as error_rate,
            COUNT(*) as total_requests
          FROM performance_metrics 
          WHERE timestamp >= NOW() - INTERVAL '1 hour'
          GROUP BY endpoint
          HAVING COUNT(*) > 10
          ORDER BY error_rate DESC
        `),
        
        // Active Users (last 24 hours)
        client.query(`
          SELECT COUNT(DISTINCT user_id) as count
          FROM user_analytics 
          WHERE timestamp >= NOW() - INTERVAL '24 hours'
        `),
        
        // News Engagement Rate
        client.query(`
          SELECT 
            (COUNT(CASE WHEN action IN ('click', 'share', 'bookmark') THEN 1 END) * 100.0 / 
             COUNT(CASE WHEN action = 'view' THEN 1 END)) as engagement_rate
          FROM news_engagement 
          WHERE timestamp >= NOW() - INTERVAL '24 hours'
        `),
        
        // System Load Metrics
        client.query(`
          SELECT metric, value, timestamp
          FROM system_metrics 
          WHERE timestamp >= NOW() - INTERVAL '1 hour'
          AND metric IN ('cpu_usage', 'memory_usage', 'active_connections')
          ORDER BY timestamp DESC
          LIMIT 100
        `)
      ]);

      return {
        apiResponseTimes: apiPerformance.rows,
        errorRates: errorRates.rows,
        activeUsers: parseInt(activeUsers.rows[0]?.count || '0'),
        newsEngagementRate: parseFloat(engagementRate.rows[0]?.engagement_rate || '0'),
        systemLoad: systemLoad.rows
      };
    } finally {
      // Neon client doesn't need manual release
    }
  }

  async getNewsAnalytics(days: number = 7): Promise<{
    topArticles: Array<{ articleId: string; title: string; views: number; engagement: number }>;
    categoryPerformance: Array<{ category: string; views: number; engagement: number }>;
    sourcePerformance: Array<{ source: string; views: number; engagement: number }>;
    hourlyTraffic: Array<{ hour: number; views: number }>;
    userRetention: Array<{ date: string; newUsers: number; returningUsers: number }>;
  }> {
    const client = await getNeonClient();
    
    try {
      const [topArticles, categoryPerformance, sourcePerformance, hourlyTraffic, userRetention] = await Promise.all([
        // Top Articles
        client.query(`
          SELECT 
            article_id,
            COUNT(CASE WHEN action = 'view' THEN 1 END) as views,
            COUNT(CASE WHEN action IN ('click', 'share', 'bookmark') THEN 1 END) as engagement
          FROM news_engagement 
          WHERE timestamp >= NOW() - INTERVAL '${days} days'
          GROUP BY article_id
          ORDER BY views DESC
          LIMIT 20
        `),
        
        // Category Performance
        client.query(`
          SELECT 
            category,
            COUNT(CASE WHEN action = 'view' THEN 1 END) as views,
            COUNT(CASE WHEN action IN ('click', 'share', 'bookmark') THEN 1 END) as engagement
          FROM news_engagement 
          WHERE timestamp >= NOW() - INTERVAL '${days} days'
          GROUP BY category
          ORDER BY views DESC
        `),
        
        // Source Performance
        client.query(`
          SELECT 
            source,
            COUNT(CASE WHEN action = 'view' THEN 1 END) as views,
            COUNT(CASE WHEN action IN ('click', 'share', 'bookmark') THEN 1 END) as engagement
          FROM news_engagement 
          WHERE timestamp >= NOW() - INTERVAL '${days} days'
          GROUP BY source
          ORDER BY views DESC
          LIMIT 15
        `),
        
        // Hourly Traffic
        client.query(`
          SELECT 
            EXTRACT(HOUR FROM timestamp) as hour,
            COUNT(CASE WHEN action = 'view' THEN 1 END) as views
          FROM news_engagement 
          WHERE timestamp >= NOW() - INTERVAL '24 hours'
          GROUP BY EXTRACT(HOUR FROM timestamp)
          ORDER BY hour
        `),
        
        // User Retention
        client.query(`
          SELECT 
            DATE(timestamp) as date,
            COUNT(DISTINCT CASE WHEN is_new_user THEN user_id END) as new_users,
            COUNT(DISTINCT CASE WHEN NOT is_new_user THEN user_id END) as returning_users
          FROM user_analytics 
          WHERE timestamp >= NOW() - INTERVAL '${days} days'
          AND event = 'page_view'
          GROUP BY DATE(timestamp)
          ORDER BY date DESC
        `)
      ]);

      return {
        topArticles: topArticles.rows,
        categoryPerformance: categoryPerformance.rows,
        sourcePerformance: sourcePerformance.rows,
        hourlyTraffic: hourlyTraffic.rows,
        userRetention: userRetention.rows
      };
    } finally {
      // Neon client doesn't need manual release
    }
  }

  // Batch Processing
  private startBatchProcessor(): void {
    this.flushTimer = setInterval(async () => {
      await this.flushAll();
    }, this.flushInterval);
  }

  private async flushAll(): Promise<void> {
    await Promise.all([
      this.flushEvents(),
      this.flushMetrics(),
      this.flushEngagement(),
      this.flushPerformance()
    ]);
  }

  private async flushEvents(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const events = this.eventQueue.splice(0, this.batchSize);
    const client = await getNeonClient();
    
    try {
      const values = events.map((event, index) => {
        const baseIndex = index * 7;
        return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7})`;
      }).join(', ');

      const params = events.flatMap(event => [
        event.userId,
        event.sessionId,
        event.event,
        JSON.stringify(event.properties),
        event.timestamp,
        event.userAgent || null,
        event.ipAddress || null
      ]);

      await client.query(`
        INSERT INTO user_analytics (user_id, session_id, event, properties, timestamp, user_agent, ip_address)
        VALUES ${values}
      `, params);

      logger.info('Flushed user analytics events', { count: events.length });
    } catch (error) {
      logger.error('Error flushing user analytics events', error as Error);
      // Re-add events to queue for retry
      this.eventQueue.unshift(...events);
    } finally {
      // Neon client doesn't need manual release
    }
  }

  private async flushMetrics(): Promise<void> {
    if (this.metricsQueue.length === 0) return;

    const metrics = this.metricsQueue.splice(0, this.batchSize);
    const client = await getNeonClient();
    
    try {
      const values = metrics.map((metric, index) => {
        const baseIndex = index * 4;
        return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4})`;
      }).join(', ');

      const params = metrics.flatMap(metric => [
        metric.timestamp,
        metric.metric,
        metric.value,
        JSON.stringify(metric.tags)
      ]);

      await client.query(`
        INSERT INTO system_metrics (timestamp, metric, value, tags)
        VALUES ${values}
      `, params);

      logger.info('Flushed system metrics', { count: metrics.length });
    } catch (error) {
      logger.error('Error flushing system metrics', error as Error);
      this.metricsQueue.unshift(...metrics);
    } finally {
      // Neon client doesn't need manual release
    }
  }

  private async flushEngagement(): Promise<void> {
    if (this.engagementQueue.length === 0) return;

    const engagements = this.engagementQueue.splice(0, this.batchSize);
    const client = await getNeonClient();
    
    try {
      const values = engagements.map((engagement, index) => {
        const baseIndex = index * 8;
        return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7}, $${baseIndex + 8})`;
      }).join(', ');

      const params = engagements.flatMap(engagement => [
        engagement.articleId,
        engagement.userId || null,
        engagement.action,
        engagement.duration || null,
        engagement.scrollDepth || null,
        engagement.timestamp,
        engagement.source,
        engagement.category
      ]);

      await client.query(`
        INSERT INTO news_engagement (article_id, user_id, action, duration, scroll_depth, timestamp, source, category)
        VALUES ${values}
      `, params);

      logger.info('Flushed news engagement events', { count: engagements.length });
    } catch (error) {
      logger.error('Error flushing news engagement events', error as Error);
      this.engagementQueue.unshift(...engagements);
    } finally {
      // Neon client doesn't need manual release
    }
  }

  private async flushPerformance(): Promise<void> {
    if (this.performanceQueue.length === 0) return;

    const performances = this.performanceQueue.splice(0, this.batchSize);
    const client = await getNeonClient();
    
    try {
      const values = performances.map((perf, index) => {
        const baseIndex = index * 7;
        return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7})`;
      }).join(', ');

      const params = performances.flatMap(perf => [
        perf.timestamp,
        perf.endpoint,
        perf.method,
        perf.responseTime,
        perf.statusCode,
        perf.userAgent || null,
        perf.userId || null
      ]);

      await client.query(`
        INSERT INTO performance_metrics (timestamp, endpoint, method, response_time, status_code, user_agent, user_id)
        VALUES ${values}
      `, params);

      logger.info('Flushed performance metrics', { count: performances.length });
    } catch (error) {
      logger.error('Error flushing performance metrics', error as Error);
      this.performanceQueue.unshift(...performances);
    } finally {
      // Neon client doesn't need manual release
    }
  }

  // Cleanup
  shutdown(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    
    // Flush remaining events
    this.flushAll().catch(error => {
      logger.error('Error during analytics shutdown flush', error as Error);
    });
  }
}

export const analytics = new ComprehensiveAnalytics();
