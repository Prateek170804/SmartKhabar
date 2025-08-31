import { NextRequest, NextResponse } from 'next/server';
import { getFreeNewsCollector } from '@/lib/news-collection/free-news-collector';
import { getNeonClient } from '@/lib/database/neon-client';
import { getLogger } from '@/lib/monitoring/production-logger';

// This endpoint will be called by Vercel cron jobs
export async function GET(request: NextRequest) {
  const logger = getLogger();
  const requestId = `cron_${Date.now()}`;
  
  try {
    // Verify the request is from Vercel cron (optional security check)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    logger.info('Starting scheduled free news collection', {}, requestId);
    
    // Create enhanced free news collector with NewsData.io
    const collector = getFreeNewsCollector({
      maxArticles: 60, // Increased due to better API
      enableScraping: true, // Enable scraping for better content
      enableSummarization: false, // Disable to save API calls in cron
      categories: ['technology', 'business', 'science', 'general'],
      sources: ['newsdata', 'gnews'], // NewsData.io primary, GNews fallback
      useRealTime: true // Enable real-time collection
    });

    // Execute collection
    const result = await collector.collectNews();
    
    // Save articles to Neon database if available
    if (result.articles.length > 0) {
      try {
        const neonClient = getNeonClient();
        await neonClient.initializeTables(); // Ensure tables exist
        await neonClient.saveArticles(result.articles);
        logger.info('Articles saved to Neon database', {
          count: result.articles.length
        }, requestId);
      } catch (dbError) {
        logger.error('Failed to save articles to database', dbError as Error, {}, requestId);
        // Continue execution even if database save fails - this is expected in serverless
      }
    }
    
    logger.info('Scheduled free news collection completed:', {
      totalArticles: result.totalCollected,
      apiUsage: result.apiUsage,
      errors: result.errors.length,
    }, requestId);

    return NextResponse.json({
      success: true,
      data: {
        totalArticles: result.totalCollected,
        apiUsage: result.apiUsage,
        errors: result.errors,
        sources: ['newsdata', 'gnews', 'puppeteer'],
        timestamp: new Date().toISOString()
      },
    });

  } catch (error) {
    console.error('Scheduled news collection failed:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'COLLECTION_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}

// Prevent caching of this endpoint
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';