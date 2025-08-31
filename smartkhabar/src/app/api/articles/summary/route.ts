import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { SummarizationService } from '@/lib/summarization/summarization-service';
import { 
  SummaryResponse, 
  Summary,
  NewsArticle
} from '@/types';
import crypto from 'crypto';
import { 
  SmartKhabarError,
  ErrorCode,
  ErrorSeverity,
  SummarizationError
} from '@/lib/error-handling';
import { withErrorHandling, withCircuitBreaker } from '@/lib/error-handling/middleware';
import { GracefulDegradation } from '@/lib/error-handling/fallbacks';

// Request body schema for POST request
const SummaryRequestBodySchema = z.object({
  articles: z.array(z.object({
    id: z.string().min(1, 'Article ID is required'),
    headline: z.string().min(1, 'Headline is required'),
    content: z.string().min(1, 'Content is required'),
    source: z.string().min(1, 'Source is required'),
    category: z.string().min(1, 'Category is required'),
    publishedAt: z.string().datetime().transform(str => new Date(str)),
    url: z.string().url('Invalid URL format'),
    tags: z.array(z.string()).default([]),
  })).min(1, 'At least one article is required'),
  tone: z.enum(['formal', 'casual', 'fun']).default('casual'),
  maxReadingTime: z.number().int().min(1, 'Reading time must be at least 1 minute').max(15, 'Reading time cannot exceed 15 minutes').default(5),
  userId: z.string().min(1, 'User ID is required'),
  enableCaching: z.boolean().default(true),
});

// Cache for storing summaries (in production, use Redis)
const summaryCache = new Map<string, { summary: Summary; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Generate cache key for summary request
 */
function generateCacheKey(articles: NewsArticle[], tone: string, maxReadingTime: number): string {
  const articleIds = articles.map(a => a.id).sort().join(',');
  const content = `${articleIds}-${tone}-${maxReadingTime}`;
  return crypto.createHash('md5').update(content).digest('hex');
}

/**
 * Check if cached summary is still valid
 */
function isCacheValid(timestamp: number): boolean {
  return Date.now() - timestamp < CACHE_TTL;
}

/**
 * Clean expired cache entries
 */
function cleanExpiredCache(): void {
  const now = Date.now();
  for (const [key, value] of summaryCache.entries()) {
    if (now - value.timestamp >= CACHE_TTL) {
      summaryCache.delete(key);
    }
  }
}

/**
 * POST /api/articles/summary
 * Generates AI summary for provided articles
 */
export const POST = withErrorHandling(async (request: NextRequest, context) => {
  // Parse and validate request body
  const body = await request.json();
  const validatedData = SummaryRequestBodySchema.parse(body);
  
  const { articles, tone, maxReadingTime, userId, enableCaching } = validatedData;

  // Generate cache key
  const cacheKey = generateCacheKey(articles, tone, maxReadingTime);
  
  // Check cache if enabled
  if (enableCaching && summaryCache.has(cacheKey)) {
    const cached = summaryCache.get(cacheKey)!;
    if (isCacheValid(cached.timestamp)) {
      console.log(`Cache hit for summary request: ${cacheKey}`);
      const response: SummaryResponse = {
        success: true,
        data: cached.summary
      };
      return NextResponse.json(response, {
        headers: {
          'x-request-id': context.requestId,
          'x-cache-status': 'hit',
        },
      });
    } else {
      // Remove expired cache entry
      summaryCache.delete(cacheKey);
    }
  }

  // Generate summary with circuit breaker and graceful degradation
  let summary: Summary;
  
  try {
    // Initialize summarization service
    const summarizationService = new SummarizationService();
    
    // Generate summary with circuit breaker
    summary = await withCircuitBreaker('summarization')(async () => {
      try {
        return await summarizationService.generateSummary({
          articles,
          tone,
          maxReadingTime,
          userId
        });
      } catch (error) {
        throw new SummarizationError(
          'Failed to generate AI summary',
          { 
            userId, 
            articleCount: articles.length, 
            tone, 
            maxReadingTime,
            originalError: error instanceof Error ? error.message : 'Unknown error'
          }
        );
      }
    });
  } catch (summaryError) {
    // Use graceful degradation
    const fallbackData = await GracefulDegradation.handleSummaryGeneration(
      articles,
      tone,
      maxReadingTime,
      summaryError as Error
    );
    
    if (fallbackData.data && typeof fallbackData.data === 'object' && 'summary' in fallbackData.data) {
      summary = (fallbackData.data as any).summary;
    } else {
      throw summaryError;
    }
  }

  // Cache the result if enabled
  if (enableCaching) {
    summaryCache.set(cacheKey, {
      summary,
      timestamp: Date.now()
    });
    
    // Clean expired cache entries periodically
    if (Math.random() < 0.1) { // 10% chance to clean cache
      cleanExpiredCache();
    }
  }

  console.log(`Generated summary for ${articles.length} articles, tone: ${tone}, reading time: ${maxReadingTime}min`);
  
  const response: SummaryResponse = {
    success: true,
    data: summary
  };
  
  return NextResponse.json(response, {
    headers: {
      'x-request-id': context.requestId,
      'x-cache-status': 'miss',
    },
  });
}, {
  enableFallbacks: true,
  enableCircuitBreaker: true,
  enableRetry: true,
  maxRetries: 2,
});

/**
 * GET /api/articles/summary
 * Returns cache statistics and available options
 */
export async function GET() {
  try {
    // Clean expired cache entries
    cleanExpiredCache();
    
    const stats = {
      cacheSize: summaryCache.size,
      cacheTTL: CACHE_TTL,
      availableTones: ['formal', 'casual', 'fun'],
      readingTimeRange: { min: 1, max: 15 },
      maxArticlesPerRequest: 10
    };
    
    return NextResponse.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    console.error('Error getting summary API info:', error);
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get API information'
      }
    }, { status: 500 });
  }
}