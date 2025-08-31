/**
 * India News API Endpoint
 * Provides India-specific news with regional and category filtering
 */

import { NextRequest, NextResponse } from 'next/server';
import { collectIndiaNews, getIndiaBreakingNews, getIndiaTrendingTopics, INDIA_NEWS_CONFIG } from '@/lib/news-collection/india-news-collector';
import { getLogger } from '@/lib/monitoring/production-logger';
import { withRetry } from '@/lib/error-handling';
import { getCache, CacheKeys } from '@/lib/cache';

const logger = getLogger();
const cache = getCache();

export async function GET(request: NextRequest) {
  const requestId = `india_news_${Date.now()}`;
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const page = parseInt(searchParams.get('page') || '1');
    const enableScraping = searchParams.get('enableScraping') === 'true';
    const enableSummary = searchParams.get('enableSummary') === 'true';

    logger.info('India news request received', {
      limit,
      page,
      enableScraping,
      enableSummary
    }, requestId);

    // Check cache first (include page in cache key)
    const cacheKey = CacheKeys.newsCollection('india', `general_all_all_${limit}_page_${page}`);
    const cachedResult = cache.get(cacheKey) as any;
    
    if (cachedResult) {
      logger.info('Returning cached India news', {
        count: cachedResult.articles?.length || 0
      }, requestId);
      
      return NextResponse.json({
        success: true,
        data: cachedResult,
        cached: true,
        timestamp: new Date().toISOString(),
        requestId
      });
    }

    // Collect general India news with pagination
    const collectionConfig = {
      maxArticles: limit * page, // Collect more articles to support pagination
      enableScraping,
      enableSummarization: enableSummary,
      categories: INDIA_NEWS_CONFIG.categories,
      regions: INDIA_NEWS_CONFIG.regions
    };

    const collectionResult = await withRetry(
      () => collectIndiaNews(collectionConfig),
      3,
      2000
    );

    // Implement pagination by slicing the results
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const articles = collectionResult.articles.slice(startIndex, endIndex);

    const result = {
      articles,
      totalCollected: articles.length,
      originalTotal: collectionResult.totalCollected,
      errors: collectionResult.errors,
      apiUsage: collectionResult.apiUsage
    };

    // Cache the result
    const cacheTime = 15 * 60 * 1000; // 15 minutes
    cache.set(cacheKey, result, cacheTime);

    const duration = Date.now() - startTime;
    
    logger.info('India news request completed', {
      articlesReturned: result.articles?.length || 0,
      duration,
      cached: false
    }, requestId);

    return NextResponse.json({
      success: true,
      data: result,
      cached: false,
      timestamp: new Date().toISOString(),
      requestId,
      performance: {
        duration,
        cacheHit: false
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('India news request failed', error as Error, {
      duration,
      url: request.url
    }, requestId);

    return NextResponse.json({
      success: false,
      error: {
        message: 'Failed to fetch India news',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
        code: 'INDIA_NEWS_ERROR'
      },
      timestamp: new Date().toISOString(),
      requestId,
      performance: {
        duration,
        cacheHit: false
      }
    }, { status: 500 });
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}