/**
 * Fallback mechanisms for service failures
 * Provides graceful degradation when services are unavailable
 */

import { 
  NewsArticle, 
  Summary, 
  UserPreferences, 
  TextChunk,
  FallbackData 
} from '@/types';
import { SmartKhabarError, ErrorCode, ErrorSeverity } from './index';

/**
 * Fallback for news collection service
 */
export class NewsCollectionFallback {
  private static readonly FALLBACK_ARTICLES: NewsArticle[] = [
    {
      id: 'fallback-1',
      headline: 'Technology News Update',
      content: 'Stay informed with the latest technology developments. Our news collection service is temporarily unavailable, but we are working to restore full functionality.',
      source: 'SmartKhabar',
      category: 'technology',
      publishedAt: new Date(),
      url: '#',
      tags: ['technology', 'update'],
    },
    {
      id: 'fallback-2',
      headline: 'General News Summary',
      content: 'Important news updates from around the world. We apologize for the temporary service interruption and appreciate your patience.',
      source: 'SmartKhabar',
      category: 'general',
      publishedAt: new Date(),
      url: '#',
      tags: ['general', 'news'],
    },
  ];

  static getFallbackArticles(category?: string): NewsArticle[] {
    if (category) {
      return this.FALLBACK_ARTICLES.filter(article => 
        article.category === category || article.tags.includes(category)
      );
    }
    return this.FALLBACK_ARTICLES;
  }

  static createFallbackData(category?: string): FallbackData {
    return {
      type: 'default_feed',
      data: {
        articles: this.getFallbackArticles(category),
        message: 'News collection service is temporarily unavailable. Showing cached content.',
      },
      message: 'Using cached content due to service unavailability',
    };
  }
}

/**
 * Fallback for summarization service
 */
export class SummarizationFallback {
  static generateFallbackSummary(
    articles: NewsArticle[], 
    tone: string = 'casual',
    maxReadingTime: number = 5
  ): Summary {
    const fallbackContent = this.createFallbackContent(articles, tone);
    const keyPoints = this.extractKeyPoints(articles);
    
    return {
      id: `fallback-${Date.now()}`,
      content: fallbackContent,
      keyPoints,
      sourceArticles: articles.map(a => a.id),
      estimatedReadingTime: Math.min(maxReadingTime, 3),
      tone,
    };
  }

  private static createFallbackContent(articles: NewsArticle[], tone: string): string {
    const tonePrefix = this.getTonePrefix(tone);
    const articleCount = articles.length;
    const sources = [...new Set(articles.map(a => a.source))];
    
    if (articleCount === 1) {
      const article = articles[0];
      // Create a better summary using the article content
      const summary = this.createIntelligentSummary(article, tone, 5); // Default 5 min reading time
      return `${tonePrefix}${summary}`;
    }
    
    // Multiple articles - create consolidated summary
    const primaryArticle = articles[0];
    const summary = this.createIntelligentSummary(primaryArticle, tone, 5);
    
    if (articles.length > 1) {
      const additionalSources = articles.slice(1).map(a => a.source).join(', ');
      return `${tonePrefix}${summary} Additional coverage from ${additionalSources} provides further insights into this developing story.`;
    }
    
    return `${tonePrefix}${summary}`;
  }

  private static getTonePrefix(tone: string): string {
    switch (tone) {
      case 'formal':
        return 'We present the following news summary: ';
      case 'fun':
        return 'Hey there! Here\'s what\'s happening in the news: ';
      case 'casual':
      default:
        return 'Here\'s your news update: ';
    }
  }

  private static extractKeyPoints(articles: NewsArticle[]): string[] {
    return articles.slice(0, 3).map(article => {
      const sentences = article.content.split('.').filter(s => s.trim().length > 20);
      return sentences[0]?.trim() + '.' || article.headline;
    });
  }

  private static truncateContent(content: string, maxLength: number): string {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength).trim() + '...';
  }

  private static createIntelligentSummary(article: any, tone: string, maxReadingTime: number): string {
    // Extract key sentences from the article content
    const sentences = article.content.split(/[.!?]+/).filter((s: string) => s.trim().length > 20);
    const keySentences = sentences.slice(0, Math.min(3, Math.ceil(maxReadingTime / 2)));
    
    // Create a more natural summary
    const summary = keySentences.join('. ').trim();
    
    // Add context about the source and topic
    const contextualSummary = `Here's the latest from ${article.source}: ${article.headline}. ${summary}. This development highlights significant progress in ${article.category} and could have broader implications for the industry.`;
    
    return this.truncateContent(contextualSummary, 400);
  }

  static createFallbackData(
    articles: NewsArticle[], 
    tone: string = 'casual',
    maxReadingTime: number = 5
  ): FallbackData {
    return {
      type: 'excerpt',
      data: {
        summary: this.generateFallbackSummary(articles, tone, maxReadingTime),
        message: 'AI summarization is temporarily unavailable. Showing simplified summary.',
      },
      message: 'Using fallback summarization due to service unavailability',
    };
  }
}

/**
 * Fallback for personalization service
 */
export class PersonalizationFallback {
  static getDefaultPreferences(userId: string): UserPreferences {
    return {
      userId,
      topics: ['general', 'technology', 'business'],
      tone: 'casual',
      readingTime: 5,
      preferredSources: [],
      excludedSources: [],
      lastUpdated: new Date(),
    };
  }

  static getFallbackContent(preferences?: Partial<UserPreferences>): NewsArticle[] {
    const topics = preferences?.topics || ['general'];
    return NewsCollectionFallback.getFallbackArticles(topics[0]);
  }

  static createFallbackData(userId: string, preferences?: Partial<UserPreferences>): FallbackData {
    return {
      type: 'default_feed',
      data: {
        articles: this.getFallbackContent(preferences),
        preferences: this.getDefaultPreferences(userId),
        message: 'Personalization service is temporarily unavailable. Showing general content.',
      },
      message: 'Using default preferences due to service unavailability',
    };
  }
}

/**
 * Fallback for search service
 */
export class SearchFallback {
  static createEmptySearchResult(): { results: any[]; totalResults: number } {
    return {
      results: [],
      totalResults: 0,
    };
  }

  static createFallbackSearchResult(query: string): { results: any[]; totalResults: number } {
    // Return some basic results based on query keywords
    const fallbackChunks = this.generateFallbackChunks(query);
    
    return {
      results: fallbackChunks.map(chunk => ({
        chunk,
        relevanceScore: 0.5, // Moderate relevance for fallback
      })),
      totalResults: fallbackChunks.length,
    };
  }

  private static generateFallbackChunks(query: string): TextChunk[] {
    const keywords = query.toLowerCase().split(' ').filter(word => word.length > 2);
    const fallbackArticles = NewsCollectionFallback.getFallbackArticles();
    
    return fallbackArticles.map((article, index) => ({
      id: `fallback-chunk-${index}`,
      articleId: article.id,
      content: article.content.substring(0, 500),
      embedding: new Array(384).fill(0), // Empty embedding vector
      metadata: {
        source: article.source,
        category: article.category,
        publishedAt: article.publishedAt,
        chunkIndex: 0,
        wordCount: article.content.split(' ').length,
      },
    }));
  }

  static createFallbackData(query: string): FallbackData {
    return {
      type: 'default_feed',
      data: {
        searchResult: this.createFallbackSearchResult(query),
        message: 'Search service is temporarily unavailable. Showing general results.',
      },
      message: 'Using fallback search due to service unavailability',
    };
  }
}

/**
 * Fallback for database operations
 */
export class DatabaseFallback {
  private static readonly CACHE = new Map<string, any>();
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  static cacheData(key: string, data: any): void {
    this.CACHE.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  static getCachedData<T>(key: string): T | null {
    const cached = this.CACHE.get(key);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > this.CACHE_TTL) {
      this.CACHE.delete(key);
      return null;
    }
    
    return cached.data;
  }

  static createFallbackData<T>(key: string, defaultData: T): FallbackData {
    const cachedData = this.getCachedData<T>(key);
    
    return {
      type: 'cached_content',
      data: cachedData || defaultData,
      message: cachedData 
        ? 'Database is temporarily unavailable. Showing cached data.'
        : 'Database is temporarily unavailable. Showing default data.',
    };
  }

  static clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, value] of this.CACHE.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.CACHE.delete(key);
      }
    }
  }

  static clearAllCache(): void {
    this.CACHE.clear();
  }
}

/**
 * Graceful degradation strategies
 */
export class GracefulDegradation {
  /**
   * Handle news feed generation with multiple fallback levels
   */
  static async handleNewsFeedGeneration(
    userId: string,
    preferences?: UserPreferences,
    originalError?: Error
  ): Promise<FallbackData> {
    try {
      // Level 1: Try to get cached personalized content
      const cachedFeed = DatabaseFallback.getCachedData(`feed-${userId}`);
      if (cachedFeed) {
        return {
          type: 'cached_content',
          data: cachedFeed,
          message: 'Showing your cached personalized feed.',
        };
      }

      // Level 2: Generate content based on preferences
      if (preferences) {
        return PersonalizationFallback.createFallbackData(userId, preferences);
      }

      // Level 3: Show general content
      return NewsCollectionFallback.createFallbackData();
      
    } catch (fallbackError) {
      // Level 4: Empty state with helpful message
      return {
        type: 'empty_state',
        data: {
          message: 'We are experiencing technical difficulties. Please try again in a few minutes.',
          suggestions: [
            'Check your internet connection',
            'Refresh the page',
            'Try again later',
          ],
        },
        message: 'All fallback mechanisms failed',
      };
    }
  }

  /**
   * Handle summary generation with fallbacks
   */
  static async handleSummaryGeneration(
    articles: NewsArticle[],
    tone: string,
    maxReadingTime: number,
    originalError?: Error
  ): Promise<FallbackData> {
    try {
      // Level 1: Try cached summary
      const cacheKey = `summary-${articles.map(a => a.id).join('-')}-${tone}-${maxReadingTime}`;
      const cachedSummary = DatabaseFallback.getCachedData(cacheKey);
      if (cachedSummary) {
        return {
          type: 'cached_content',
          data: cachedSummary,
          message: 'Showing cached summary.',
        };
      }

      // Level 2: Generate fallback summary
      return SummarizationFallback.createFallbackData(articles, tone, maxReadingTime);
      
    } catch (fallbackError) {
      // Level 3: Show article excerpts
      return {
        type: 'excerpt',
        data: {
          articles: articles.map(article => ({
            ...article,
            content: article.content.substring(0, 300) + '...',
          })),
          message: 'Unable to generate summary. Showing article excerpts.',
        },
        message: 'Summary generation failed, showing excerpts',
      };
    }
  }
}