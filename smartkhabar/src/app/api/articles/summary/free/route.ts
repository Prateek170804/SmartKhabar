import { NextRequest, NextResponse } from 'next/server';
import { getHuggingFaceClient } from '@/lib/llm/huggingface-client';
import { getCache, CacheKeys } from '@/lib/cache';
import { getLogger } from '@/lib/monitoring/production-logger';
import { withErrorHandling } from '@/lib/error-handling';

/**
 * POST /api/articles/summary/free
 * Generate article summary using Hugging Face (free)
 */
export async function POST(request: NextRequest) {
  try {
    const logger = getLogger();
    const cache = getCache();
    const requestId = `summary_${Date.now()}`;
    
    try {
      const body = await request.json();
      const { 
        content, 
        tone = 'casual', 
        maxLength = 150,
        articleId = `article_${Date.now()}`
      } = body;

      if (!content || content.length < 50) {
        return NextResponse.json({
          success: false,
          error: 'Content is required and must be at least 50 characters'
        }, { status: 400 });
      }

      logger.info('Generating free summary', { 
        articleId, 
        tone, 
        maxLength, 
        contentLength: content.length 
      }, requestId);

      // Check cache first
      const cacheKey = CacheKeys.articleSummary(articleId, tone, maxLength);
      const cachedSummary = cache.get(cacheKey);
      
      if (cachedSummary) {
        logger.info('Returning cached summary', { articleId }, requestId);
        return NextResponse.json({
          success: true,
          summary: cachedSummary,
          source: 'cache',
          metadata: {
            articleId,
            tone,
            maxLength,
            timestamp: new Date().toISOString(),
            cached: true
          }
        });
      }

      // Generate summary using Hugging Face
      const hf = getHuggingFaceClient();
      const summary = await hf.generateArticleSummary(content, tone as any, maxLength);

      if (!summary) {
        return NextResponse.json({
          success: false,
          error: 'Failed to generate summary'
        }, { status: 500 });
      }

      // Cache the summary for 1 hour
      cache.set(cacheKey, summary, 60 * 60 * 1000);

      logger.info('Generated fresh summary', { 
        articleId, 
        summaryLength: summary.length 
      }, requestId);

      return NextResponse.json({
        success: true,
        summary,
        source: 'fresh',
        metadata: {
          articleId,
          tone,
          maxLength,
          summaryLength: summary.length,
          timestamp: new Date().toISOString(),
          cached: false
        }
      });

    } catch (error) {
      logger.error('Failed to generate summary', error as Error, {}, requestId);
      
      return NextResponse.json({
        success: false,
        error: 'Failed to generate summary',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      }, { status: 500 });
    }
  } catch (error) {
    const logger = getLogger();
    logger.error('Unexpected error in POST summary', error as Error, {}, `summary_${Date.now()}`);
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

/**
 * GET /api/articles/summary/free
 * Test endpoint for summary generation
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const testContent = searchParams.get('test') === 'true';
    
    if (!testContent) {
      return NextResponse.json({
        success: true,
        message: 'Free summary API is ready',
        usage: 'POST with { content, tone?, maxLength?, articleId? }',
        example: {
          content: 'Your article content here...',
          tone: 'casual',
          maxLength: 150,
          articleId: 'optional-id'
        }
      });
    }

    // Test with sample content
    const logger = getLogger();
    const cache = getCache();
    const requestId = `summary_test_${Date.now()}`;
    
    const testArticle = {
      content: 'Artificial intelligence is rapidly transforming various industries, from healthcare to finance. Machine learning algorithms are becoming more sophisticated, enabling computers to perform tasks that previously required human intelligence.',
      tone: 'casual',
      maxLength: 100,
      articleId: 'test-article'
    };

    try {
      const hf = getHuggingFaceClient();
      const summary = await hf.generateArticleSummary(testArticle.content, testArticle.tone as any, testArticle.maxLength);

      return NextResponse.json({
        success: true,
        summary,
        source: 'test',
        metadata: {
          articleId: testArticle.articleId,
          tone: testArticle.tone,
          maxLength: testArticle.maxLength,
          timestamp: new Date().toISOString(),
          cached: false
        }
      });
    } catch (error) {
      logger.error('Test summary generation failed', error as Error, {}, requestId);
      
      return NextResponse.json({
        success: false,
        error: 'Test summary generation failed',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}