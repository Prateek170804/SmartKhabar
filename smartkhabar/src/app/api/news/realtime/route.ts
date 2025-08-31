import { NextRequest, NextResponse } from 'next/server';
import { NewsDataClient } from '@/lib/news-collection/newsdata-client';
import { config } from '@/lib/config';
import { getCache, CacheKeys } from '@/lib/cache';
import { getLogger } from '@/lib/monitoring/production-logger';

/**
 * GET /api/news/realtime
 * Returns real-time breaking news using NewsData.io
 */
export async function GET(request: NextRequest) {
  const logger = getLogger();
  const cache = getCache();
  const requestId = `realtime_${Date.now()}`;
  
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const category = searchParams.get('category');
    
    logger.info('Fetching real-time news', { limit, category }, requestId);

    // Check cache first (very short cache for real-time)
    const cacheKey = CacheKeys.newsCollection('realtime', category || 'all');
    const cachedNews = cache.get(cacheKey) as any[];
    
    if (cachedNews && Array.isArray(cachedNews) && cachedNews.length >= limit) {
      logger.info('Returning cached real-time news', { count: cachedNews.length }, requestId);
      return NextResponse.json({
        success: true,
        articles: cachedNews.slice(0, limit),
        source: 'newsdata_cached',
        realTime: true,
        metadata: {
          category: category || 'all',
          count: Math.min(cachedNews.length, limit),
          timestamp: new Date().toISOString(),
          cached: true
        }
      });
    }

    const newsDataClient = new NewsDataClient(config.newsdata.apiKey);
    
    try {
      // Get real-time news (simplified)
      const response = await newsDataClient.getLatestNews({
        ...(category && { category }),
        language: 'en',
        size: limit,
        full_content: true,
        image: true,
        prioritydomain: 'top'
      });
      
      const articles = response.results.map(article => ({
        id: article.article_id,
        headline: article.title,
        content: article.content || article.description,
        source: article.source_id,
        category: article.category?.[0] || 'breaking',
        publishedAt: new Date(article.pubDate),
        url: article.link,
        tags: article.keywords || [],
        sentiment: article.sentiment,
        priority: article.source_priority || 0,
        imageUrl: article.image_url,
        videoUrl: article.video_url
      }));

      // Cache for 2 minutes only (real-time needs fresh data)
      cache.set(cacheKey, articles, 2 * 60 * 1000);

      logger.info('Returning fresh real-time news', { 
        count: articles.length,
        totalResults: response.totalResults
      }, requestId);

      return NextResponse.json({
        success: true,
        articles,
        source: 'newsdata_fresh',
        realTime: true,
        metadata: {
          category: category || 'all',
          count: articles.length,
          totalResults: response.totalResults,
          timestamp: new Date().toISOString(),
          cached: false,
          nextPage: response.nextPage
        }
      });

    } catch (newsDataError) {
      logger.error('NewsData.io real-time fetch failed', newsDataError as Error, { category }, requestId);
      
      return NextResponse.json({
        success: false,
        articles: [],
        error: 'Real-time news service temporarily unavailable',
        fallback: {
          type: 'empty_state',
          data: [],
          message: 'Unable to load real-time news. Please try again in a moment.'
        },
        metadata: {
          category: category || 'all',
          count: 0,
          timestamp: new Date().toISOString()
        }
      }, { status: 503 });
    }

  } catch (error) {
    logger.error('Unexpected error in real-time news', error as Error, {}, requestId);
    
    return NextResponse.json({
      success: false,
      articles: [],
      error: 'Internal server error',
      metadata: {
        timestamp: new Date().toISOString()
      }
    }, { status: 500 });
  }
}

/**
 * POST /api/news/realtime
 * Subscribe to real-time news updates (for future WebSocket implementation)
 */
export async function POST(request: NextRequest) {
  const logger = getLogger();
  const requestId = `realtime_subscribe_${Date.now()}`;
  
  try {
    const body = await request.json();
    const { categories, preferences, userId } = body;
    
    logger.info('Real-time subscription request', { categories, userId }, requestId);
    
    // For now, return subscription confirmation
    // In the future, this would set up WebSocket connections
    return NextResponse.json({
      success: true,
      subscribed: true,
      message: 'Real-time news subscription activated',
      subscription: {
        userId,
        categories: categories || ['general'],
        preferences: preferences || {},
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Real-time subscription error', error as Error, {}, requestId);
    
    return NextResponse.json({
      success: false,
      subscribed: false,
      error: 'Failed to set up real-time subscription'
    }, { status: 500 });
  }
}