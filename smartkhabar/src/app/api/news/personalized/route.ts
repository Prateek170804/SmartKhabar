import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { userPreferencesService } from '@/lib/database';

import { SummarizationService } from '@/lib/summarization/summarization-service';
import { PersonalizedFeedResponse, Summary, UserPreferences } from '@/types';
import { SmartKhabarError, ErrorCode, ErrorSeverity } from '@/lib/error-handling';
import { withErrorHandling, withCircuitBreaker } from '@/lib/error-handling/middleware';
import { GracefulDegradation } from '@/lib/error-handling/fallbacks';

// Query parameters schema
const PersonalizedFeedQuerySchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  categories: z.string().optional().transform(val => val ? val.split(',') : undefined),
  sources: z.string().optional().transform(val => val ? val.split(',') : undefined),
  minRelevanceScore: z.coerce.number().min(0).max(1).optional(),
});

type PersonalizedFeedQuery = z.infer<typeof PersonalizedFeedQuerySchema>;

// Cache for storing recent summaries
const summaryCache = new Map<string, { summary: Summary; timestamp: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export const GET = withErrorHandling(async (request: NextRequest, context) => {
  // Parse and validate query parameters
  const url = new URL(request.url);
  const queryParams = Object.fromEntries(url.searchParams.entries());
  
  const validatedQuery = PersonalizedFeedQuerySchema.parse(queryParams);
  const { userId, page, limit, categories, sources, minRelevanceScore } = validatedQuery;

  // Get user preferences with circuit breaker
  let userPreferences: UserPreferences;
  try {
    userPreferences = await withCircuitBreaker('user-preferences')(async () => {
      try {
        const prefs = await userPreferencesService.getOrCreateUserPreferences(userId);
        if (!prefs) {
          throw new Error('No preferences returned');
        }
        return prefs;
      } catch (error) {
        throw new SmartKhabarError(
          ErrorCode.DATABASE_ERROR,
          'Failed to load user preferences',
          ErrorSeverity.HIGH,
          { userId, originalError: error instanceof Error ? error.message : 'Unknown error' }
        );
      }
    });
  } catch (error) {
    console.error(`Fallback triggered for user preferences: ${userId}`, error);
    userPreferences = {
      userId,
      topics: ['general'],
      tone: 'casual', // Changed from 'neutral' to 'casual'
      readingTime: 5,
      preferredSources: [],
      excludedSources: [],
      lastUpdated: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  // Get articles from database using simple SQL queries (fallback approach)
  const { getNeonClient } = await import('@/lib/database/neon-client');
  const neonClient = getNeonClient();
  
  // Build SQL query based on preferences
  let sql = `
    SELECT id, title, description, content, url, image_url, 
           published_at, source, source_url, author, category, language, country
    FROM articles 
    WHERE 1=1
  `;
  const params: any[] = [];
  let paramIndex = 1;

  // Filter by categories (user preferences or query params)
  const targetCategories = categories || userPreferences.topics;
  if (targetCategories && targetCategories.length > 0) {
    sql += ` AND category = ANY($${paramIndex})`;
    params.push(targetCategories);
    paramIndex++;
  }

  // Filter by sources (user preferences or query params)
  const targetSources = sources || userPreferences.preferredSources;
  if (targetSources && targetSources.length > 0) {
    sql += ` AND source = ANY($${paramIndex})`;
    params.push(targetSources);
    paramIndex++;
  }

  // Exclude unwanted sources
  if (userPreferences.excludedSources && userPreferences.excludedSources.length > 0) {
    sql += ` AND source != ALL($${paramIndex})`;
    params.push(userPreferences.excludedSources);
    paramIndex++;
  }

  // Order by published date (most recent first)
  sql += ` ORDER BY published_at DESC`;

  // Apply pagination
  const offset = (page - 1) * limit;
  sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  let articles: any[] = [];
  try {
    const result = await neonClient.query(sql, params);
    articles = result.rows;
  } catch (dbError) {
    console.error('Database query failed:', dbError);
    // Fallback to getting any articles
    try {
      const fallbackResult = await neonClient.query(
        'SELECT * FROM articles ORDER BY published_at DESC LIMIT $1 OFFSET $2',
        [limit, offset]
      );
      articles = fallbackResult.rows;
    } catch (fallbackError) {
      console.error('Fallback query also failed:', fallbackError);
      articles = [];
    }
  }

  // Convert articles to summaries
  const summarizationService = new SummarizationService();
  const summaries: Summary[] = [];

  for (const article of articles) {
    const mockArticle = {
      id: article.id,
      headline: article.title,
      content: article.content || article.description || '',
      source: article.source,
      category: article.category,
      publishedAt: article.published_at,
      url: article.url,
      tags: [],
    };

    // Check cache
    const cacheKey = `${article.id}-${userPreferences.tone}-${userPreferences.readingTime}`;
    const cachedSummary = summaryCache.get(cacheKey);
    
    if (cachedSummary && Date.now() - cachedSummary.timestamp < CACHE_TTL) {
      summaries.push(cachedSummary.summary);
      continue;
    }

    try {
      const summary = await withCircuitBreaker('summarization')(async () => {
        return await summarizationService.generateSummary({
          articles: [mockArticle],
          tone: userPreferences.tone,
          maxReadingTime: userPreferences.readingTime,
          userId,
        });
      });

      summaryCache.set(cacheKey, {
        summary,
        timestamp: Date.now(),
      });

      summaries.push(summary);
    } catch (summaryError) {
      const fallbackData = await GracefulDegradation.handleSummaryGeneration(
        [mockArticle],
        userPreferences.tone,
        userPreferences.readingTime,
        summaryError as Error
      );
      
      if (fallbackData.data && typeof fallbackData.data === 'object' && 'summary' in fallbackData.data) {
        summaries.push((fallbackData.data as any).summary);
      }
    }
  }

  cleanupCache();

  const response: PersonalizedFeedResponse = {
    success: true,
    data: {
      summaries,
      lastUpdated: new Date(),
      userPreferences,
    },
  };

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': 'public, max-age=300',
      'x-request-id': context.requestId,
    },
  });
}, {
  enableFallbacks: true,
  enableCircuitBreaker: true,
  enableRetry: true,
  maxRetries: 2,
});

function cleanupCache() {
  const now = Date.now();
  for (const [key, value] of summaryCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      summaryCache.delete(key);
    }
  }
}