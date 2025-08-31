import { NextRequest, NextResponse } from 'next/server';
import { getFreeNewsCollector } from '@/lib/news-collection/free-news-collector';
import { getCache, CacheKeys } from '@/lib/cache';
import { getLogger } from '@/lib/monitoring/production-logger';
import { withErrorHandling } from '@/lib/error-handling';

/**
 * GET /api/news/free
 * Returns news using free APIs (GNews + Hugging Face + Puppeteer)
 */
export async function GET(request: NextRequest) {
  try {
    const logger = getLogger();
    const cache = getCache();
    const requestId = `free_news_${Date.now()}`;
    
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || 'technology';
    const limit = parseInt(searchParams.get('limit') || '10');
    const enableScraping = searchParams.get('scraping') === 'true';
    const enableSummary = searchParams.get('summary') === 'true';

    logger.info('Fetching free news', { category, limit, enableScraping, enableSummary }, requestId);

    // Check cache first
    const cacheKey = CacheKeys.newsCollection('free', category);
    const cachedNews = cache.get(cacheKey) as any[];
    
    if (cachedNews && Array.isArray(cachedNews) && cachedNews.length >= limit) {
      logger.info('Returning cached free news', { count: cachedNews.length }, requestId);
      return NextResponse.json({
        success: true,
        articles: cachedNews.slice(0, limit),
        source: 'cache',
        metadata: {
          category,
          count: Math.min(cachedNews.length, limit),
          timestamp: new Date().toISOString(),
          cached: true
        }
      });
    }

    try {
      // Determine categories to fetch for diversity
      let categoriesToFetch = [category];
      
      // Map categories to NewsData.io supported categories and get diverse content
      const categoryMapping: Record<string, string> = {
        'general': 'top',
        'technology': 'technology',
        'business': 'business',
        'science': 'science',
        'health': 'health',
        'sports': 'sports',
        'entertainment': 'entertainment',
        'politics': 'politics',
        'world': 'world',
        'environment': 'environment'
      };
      
      const mappedCategory = categoryMapping[category] || category;
      
      // If requesting general/top or technology, get diverse categories
      if (category === 'general' || category === 'technology' || mappedCategory === 'top') {
        categoriesToFetch = [
          'top', 'technology', 'business', 'science', 
          'health', 'sports', 'world', 'politics'
        ];
      } else {
        categoriesToFetch = [mappedCategory];
      }
      
      // Collect fresh news using free APIs with diverse categories
      const collector = getFreeNewsCollector({
        maxArticles: limit * 2, // Get more to have options
        enableScraping,
        enableSummarization: enableSummary,
        categories: categoriesToFetch,
        sources: ['gnews']
      });

      const result = await collector.collectNews();
      
      if (result.articles.length === 0) {
        return NextResponse.json({
          success: true,
          articles: [],
          message: 'No articles found',
          metadata: {
            category,
            count: 0,
            timestamp: new Date().toISOString(),
            apiUsage: result.apiUsage
          }
        });
      }

      // Take only the requested number
      const articles = result.articles.slice(0, limit);

      // Cache the results for 15 minutes
      cache.set(cacheKey, result.articles, 15 * 60 * 1000);

      logger.info('Returning fresh free news', { 
        count: articles.length,
        apiUsage: result.apiUsage,
        errors: result.errors.length
      }, requestId);

      return NextResponse.json({
        success: true,
        articles,
        source: 'fresh',
        apiUsage: result.apiUsage,
        errors: result.errors,
        metadata: {
          category,
          count: articles.length,
          timestamp: new Date().toISOString(),
          cached: false
        }
      });

    } catch (error) {
      logger.error('Failed to fetch free news', error as Error, { category }, requestId);
      
      return NextResponse.json({
        success: false,
        articles: [],
        error: 'Failed to fetch news',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
        metadata: {
          category,
          count: 0,
          timestamp: new Date().toISOString()
        }
      }, { status: 500 });
    }
  } catch (error) {
    const logger = getLogger();
    logger.error('Unexpected error in GET news', error as Error, {}, `free_news_${Date.now()}`);
    
    return NextResponse.json({
      success: false,
      articles: [],
      error: 'Internal server error'
    }, { status: 500 });
  }
}