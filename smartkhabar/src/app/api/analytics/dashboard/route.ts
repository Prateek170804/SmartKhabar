import { NextRequest, NextResponse } from 'next/server';
import { analytics } from '@/lib/analytics/comprehensive-analytics';
import { enhancedAuthService } from '@/lib/auth/enhanced-auth-service';
import { getLogger } from '@/lib/monitoring/production-logger';

const logger = getLogger();

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Check authentication
    const user = await enhancedAuthService.extractUserFromRequest(request);
    
    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    // Check if user has analytics access (admin or premium)
    const hasAnalyticsAccess = user.subscription.plan === 'premium' || 
                              user.subscription.plan === 'enterprise' ||
                              user.subscription.features.includes('analytics');

    if (!hasAnalyticsAccess) {
      return NextResponse.json({
        success: false,
        error: 'Analytics access requires premium subscription'
      }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7');
    const type = searchParams.get('type') || 'overview';

    let dashboardData;

    switch (type) {
      case 'overview':
        const [systemHealth, newsAnalytics, userEngagement] = await Promise.all([
          analytics.getSystemHealthMetrics(),
          analytics.getNewsAnalytics(days),
          analytics.getUserEngagementStats(user.id, days)
        ]);

        dashboardData = {
          systemHealth,
          newsAnalytics,
          userEngagement,
          summary: {
            totalUsers: systemHealth.activeUsers,
            totalArticles: newsAnalytics.topArticles.length,
            engagementRate: systemHealth.newsEngagementRate,
            avgResponseTime: systemHealth.apiResponseTimes.reduce((sum, api) => 
              sum + api.avgResponseTime, 0) / systemHealth.apiResponseTimes.length || 0
          }
        };
        break;

      case 'performance':
        dashboardData = await analytics.getSystemHealthMetrics();
        break;

      case 'news':
        dashboardData = await analytics.getNewsAnalytics(days);
        break;

      case 'user':
        dashboardData = await analytics.getUserEngagementStats(user.id, days);
        break;

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid dashboard type'
        }, { status: 400 });
    }

    // Track API usage
    await analytics.trackAPIPerformance({
      endpoint: '/api/analytics/dashboard',
      method: 'GET',
      responseTime: Date.now() - startTime,
      statusCode: 200,
      userAgent: request.headers.get('user-agent') || undefined,
      userId: user.id
    });

    return NextResponse.json({
      success: true,
      type,
      days,
      data: dashboardData,
      generatedAt: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('Analytics dashboard error', error);

    await analytics.trackAPIPerformance({
      endpoint: '/api/analytics/dashboard',
      method: 'GET',
      responseTime: Date.now() - startTime,
      statusCode: 500,
      userAgent: request.headers.get('user-agent') || undefined
    });

    return NextResponse.json({
      success: false,
      error: 'Failed to load analytics dashboard'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const user = await enhancedAuthService.extractUserFromRequest(request);
    
    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'track_event':
        await analytics.trackUserEvent({
          userId: user.id,
          sessionId: data.sessionId || 'unknown',
          event: data.event,
          properties: data.properties || {},
          userAgent: request.headers.get('user-agent') || undefined,
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
        });
        break;

      case 'track_article_engagement':
        await analytics.trackNewsEngagement({
          articleId: data.articleId,
          userId: user.id,
          action: data.action,
          duration: data.duration,
          scrollDepth: data.scrollDepth,
          source: data.source,
          category: data.category
        });
        break;

      case 'track_page_view':
        await analytics.trackPageView(
          user.id,
          data.sessionId || 'unknown',
          data.page,
          data.properties || {}
        );
        break;

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 });
    }

    await analytics.trackAPIPerformance({
      endpoint: '/api/analytics/dashboard',
      method: 'POST',
      responseTime: Date.now() - startTime,
      statusCode: 200,
      userAgent: request.headers.get('user-agent') || undefined,
      userId: user.id
    });

    return NextResponse.json({
      success: true,
      message: 'Event tracked successfully'
    });

  } catch (error: any) {
    logger.error('Analytics tracking error', error);

    await analytics.trackAPIPerformance({
      endpoint: '/api/analytics/dashboard',
      method: 'POST',
      responseTime: Date.now() - startTime,
      statusCode: 500,
      userAgent: request.headers.get('user-agent') || undefined
    });

    return NextResponse.json({
      success: false,
      error: 'Failed to track event'
    }, { status: 500 });
  }
}