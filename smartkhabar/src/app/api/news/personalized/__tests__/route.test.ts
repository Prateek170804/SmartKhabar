import { NextRequest, NextResponse } from 'next/server';
import { userPreferencesService } from '@/lib/database';
import { createSemanticSearchService } from '@/lib/personalization/semantic-search';
import { SummarizationService } from '@/lib/summarization/summarization-service';
import { UserPreferences, Summary } from '@/types';

interface SearchOptions {
  page?: number;
  limit?: number;
  categories?: string[];
  sources?: string[];
  minRelevanceScore?: number;
}

interface ResponseData {
  success: boolean;
  data?: {
    summaries: Summary[];
    lastUpdated: string;
    userPreferences: UserPreferences;
  };
  error?: {
    code: string;
    message: string;
  };
  fallback?: {
    type: string;
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '10', 10);
    const categories = url.searchParams.get('categories')?.split(',') || undefined;
    const sources = url.searchParams.get('sources')?.split(',') || undefined;
    const minRelevanceScore = parseFloat(url.searchParams.get('minRelevanceScore') || '0');

    // Validate query parameters
    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'User ID is required' },
        },
        { status: 400 }
      );
    }
    if (page < 1) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Page must be greater than 0' },
        },
        { status: 400 }
      );
    }
    if (limit > 50) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Limit exceeds maximum of 50' },
        },
        { status: 400 }
      );
    }

    // Fetch user preferences with fallback
    let preferences: UserPreferences;
    try {
      preferences = await userPreferencesService.getOrCreateUserPreferences(userId);
    } catch (error) {
      console.error(`Failed to fetch preferences for user ${userId}:`, error);
      preferences = {
        userId,
        topics: ['general'],
        tone: 'neutral',
        readingTime: 5,
        preferredSources: [],
        excludedSources: [],
        lastUpdated: new Date(),
      };
      console.warn(`Using default preferences for user ${userId}`);
    }

    // Initialize semantic search
    const searchService = await createSemanticSearchService();
    await searchService.initialize();

    // Apply custom filters
    const searchOptions: SearchOptions = {
      page,
      limit,
      categories: categories || preferences.topics,
      sources: sources || preferences.preferredSources,
      minRelevanceScore,
    };

    // Perform search
    const searchResult = await searchService.searchByPreferences(preferences, searchOptions);

    // Group chunks by articleId
    const articlesMap = new Map<string, any[]>();
    for (const result of searchResult.results) {
      const articleId = result.chunk.articleId;
      if (!articlesMap.has(articleId)) {
        articlesMap.set(articleId, []);
      }
      articlesMap.get(articleId)!.push(result.chunk);
    }

    // Generate summaries
    const summarizationService = new SummarizationService();
    const summaries: Summary[] = [];
    for (const [articleId, chunks] of articlesMap) {
      try {
        const article = {
          id: articleId,
          content: chunks.map((chunk) => chunk.content).join(' '),
          metadata: chunks[0].metadata,
        };
        const summary = await summarizationService.generateSummary({ articles: [article] }, preferences);
        summaries.push(summary);
      } catch (error) {
        console.warn(`Failed to generate summary for article ${articleId}:`, error);
        const fallbackSummary = summarizationService.getFallbackSummary({ articles: chunks }, preferences);
        summaries.push(fallbackSummary);
      }
    }

    // Paginate results
    const startIndex = (page - 1) * limit;
    const paginatedSummaries = summaries.slice(startIndex, startIndex + limit);

    const response: ResponseData = {
      success: true,
      data: {
        summaries: paginatedSummaries,
        lastUpdated: new Date().toISOString(),
        userPreferences: preferences,
      },
    };

    return NextResponse.json(response, {
      status: 200,
      headers: { 'Cache-Control': 'private, max-age=300, s-maxage=600, stale-while-revalidate=1800' },
    });
  } catch (error: unknown) {
    console.error('Personalized News API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: errorMessage },
        fallback: { type: 'default_feed' },
      },
      { status: 500 }
    );
  }
}