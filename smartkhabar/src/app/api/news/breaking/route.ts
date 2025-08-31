import { NextRequest, NextResponse } from 'next/server';
import { NewsDataClient } from '@/lib/news-collection/newsdata-client';
import { config } from '@/lib/config';
import { getCache, CacheKeys } from '@/lib/cache';
import { getLogger } from '@/lib/monitoring/production-logger';

/**
 * GET /api/news/breaking
 * Returns breaking news with real-time updates
 */
export async function GET(request: NextRequest) {
  const logger = getLogger();
  const cache = getCache();
  const requestId = `breaking_${Date.now()}`;
  
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '15');
    const severity = searchParams.get('severity') || 'all'; // high, medium, low, all
    
    logger.info('Fetching breaking news', { limit, severity }, requestId);

    // Very short cache for breaking news (1 minute)
    const cacheKey = CacheKeys.newsCollection('breaking', severity);
    const cachedNews = cache.get(cacheKey) as any[];
    
    if (cachedNews && Array.isArray(cachedNews) && cachedNews.length >= limit) {
      logger.info('Returning cached breaking news', { count: cachedNews.length }, requestId);
      return NextResponse.json({
        success: true,
        articles: cachedNews.slice(0, limit),
        source: 'cached',
        breaking: true,
        metadata: {
          severity,
          count: Math.min(cachedNews.length, limit),
          timestamp: new Date().toISOString(),
          cached: true
        }
      });
    }

    const newsDataClient = new NewsDataClient(config.newsdata.apiKey);
    
    try {
      // Get breaking news with high priority sources (timeframe removed for free tier)
      const response = await newsDataClient.getLatestNews({
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
        videoUrl: article.video_url,
        breaking: true,
        severity: 'medium' // Simplified severity
      }));

      // Sort by recency (simplified)
      articles.sort((a, b) => {
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      });

      // Cache for 1 minute only
      cache.set(cacheKey, articles, 60 * 1000);

      logger.info('Returning fresh breaking news', { 
        count: articles.length,
        totalResults: response.totalResults
      }, requestId);

      return NextResponse.json({
        success: true,
        articles: articles.slice(0, limit),
        source: 'newsdata',
        breaking: true,
        metadata: {
          severity,
          count: Math.min(articles.length, limit),
          totalResults: response.totalResults,
          timestamp: new Date().toISOString(),
          cached: false,
          nextPage: response.nextPage
        }
      });

    } catch (newsDataError) {
      logger.error('NewsData.io breaking news failed', newsDataError as Error, {}, requestId);
      throw newsDataError;
    }

  } catch (error) {
    logger.error('Breaking news fetch failed', error as Error, {}, requestId);
    
    return NextResponse.json({
      success: false,
      articles: [],
      error: 'Breaking news service temporarily unavailable',
      fallback: {
        type: 'empty_state',
        data: [],
        message: 'Unable to load breaking news. Please refresh the page.'
      },
      metadata: {
        timestamp: new Date().toISOString()
      }
    }, { status: 503 });
  }
}

// Helper function to calculate news severity
function calculateSeverity(article: any): 'high' | 'medium' | 'low' {
    const title = article.title.toLowerCase();
    const content = (article.content || article.description).toLowerCase();
    
    // High severity keywords
    const highSeverityKeywords = [
      'breaking', 'urgent', 'alert', 'emergency', 'crisis', 'disaster',
      'attack', 'explosion', 'earthquake', 'tsunami', 'hurricane',
      'pandemic', 'outbreak', 'war', 'conflict', 'terror'
    ];
    
    // Medium severity keywords
    const mediumSeverityKeywords = [
      'major', 'significant', 'important', 'critical', 'serious',
      'announcement', 'decision', 'ruling', 'verdict', 'launch'
    ];
    
    const text = `${title} ${content}`;
    
    if (highSeverityKeywords.some(keyword => text.includes(keyword))) {
      return 'high';
    }
    
    if (mediumSeverityKeywords.some(keyword => text.includes(keyword))) {
      return 'medium';
    }
    
    return 'low';
  }