/**
 * Tests for fallback mechanisms
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  NewsCollectionFallback,
  SummarizationFallback,
  PersonalizationFallback,
  SearchFallback,
  DatabaseFallback,
  GracefulDegradation,
} from '../fallbacks';
import { NewsArticle, UserPreferences } from '@/types';

describe('NewsCollectionFallback', () => {
  it('should return fallback articles', () => {
    const articles = NewsCollectionFallback.getFallbackArticles();
    
    expect(articles).toHaveLength(2);
    expect(articles[0].source).toBe('SmartKhabar');
    expect(articles[0].category).toBe('technology');
    expect(articles[1].category).toBe('general');
  });

  it('should filter articles by category', () => {
    const techArticles = NewsCollectionFallback.getFallbackArticles('technology');
    
    expect(techArticles).toHaveLength(1);
    expect(techArticles[0].category).toBe('technology');
  });

  it('should create fallback data', () => {
    const fallbackData = NewsCollectionFallback.createFallbackData('technology');
    
    expect(fallbackData.type).toBe('default_feed');
    expect(fallbackData.message).toContain('cached content');
    expect((fallbackData.data as any).articles).toHaveLength(1);
  });
});

describe('SummarizationFallback', () => {
  const mockArticles: NewsArticle[] = [
    {
      id: 'article-1',
      headline: 'Test Article 1',
      content: 'This is the content of the first test article. It contains important information about technology.',
      source: 'TechNews',
      category: 'technology',
      publishedAt: new Date(),
      url: 'https://example.com/article1',
      tags: ['tech', 'news'],
    },
    {
      id: 'article-2',
      headline: 'Test Article 2',
      content: 'This is the content of the second test article. It discusses business trends.',
      source: 'BusinessDaily',
      category: 'business',
      publishedAt: new Date(),
      url: 'https://example.com/article2',
      tags: ['business', 'trends'],
    },
  ];

  it('should generate fallback summary for single article', () => {
    const summary = SummarizationFallback.generateFallbackSummary([mockArticles[0]], 'casual', 5);
    
    expect(summary.id).toContain('fallback-');
    expect(summary.content).toContain('TechNews');
    expect(summary.content).toContain('Test Article 1');
    expect(summary.tone).toBe('casual');
    expect(summary.estimatedReadingTime).toBeLessThanOrEqual(5);
    expect(summary.sourceArticles).toEqual(['article-1']);
    expect(summary.keyPoints).toHaveLength(1);
  });

  it('should generate fallback summary for multiple articles', () => {
    const summary = SummarizationFallback.generateFallbackSummary(mockArticles, 'formal', 3);
    
    expect(summary.content).toContain('2 news articles');
    expect(summary.content).toContain('TechNews, BusinessDaily');
    expect(summary.content).toContain('Test Article 1; Test Article 2');
    expect(summary.tone).toBe('formal');
    expect(summary.estimatedReadingTime).toBe(3);
    expect(summary.sourceArticles).toEqual(['article-1', 'article-2']);
  });

  it('should adapt tone correctly', () => {
    const casualSummary = SummarizationFallback.generateFallbackSummary([mockArticles[0]], 'casual');
    const formalSummary = SummarizationFallback.generateFallbackSummary([mockArticles[0]], 'formal');
    const funSummary = SummarizationFallback.generateFallbackSummary([mockArticles[0]], 'fun');
    
    expect(casualSummary.content).toContain('Here\'s your news update:');
    expect(formalSummary.content).toContain('We present the following news summary:');
    expect(funSummary.content).toContain('Hey there!');
  });

  it('should create fallback data', () => {
    const fallbackData = SummarizationFallback.createFallbackData(mockArticles, 'casual', 5);
    
    expect(fallbackData.type).toBe('excerpt');
    expect(fallbackData.message).toContain('fallback summarization');
    expect((fallbackData.data as any).summary).toBeDefined();
    expect((fallbackData.data as any).message).toContain('temporarily unavailable');
  });
});

describe('PersonalizationFallback', () => {
  it('should create default preferences', () => {
    const preferences = PersonalizationFallback.getDefaultPreferences('user-123');
    
    expect(preferences.userId).toBe('user-123');
    expect(preferences.topics).toEqual(['general', 'technology', 'business']);
    expect(preferences.tone).toBe('casual');
    expect(preferences.readingTime).toBe(5);
    expect(preferences.preferredSources).toEqual([]);
    expect(preferences.excludedSources).toEqual([]);
    expect(preferences.lastUpdated).toBeInstanceOf(Date);
  });

  it('should get fallback content based on preferences', () => {
    const preferences = { topics: ['technology'] };
    const content = PersonalizationFallback.getFallbackContent(preferences);
    
    expect(content).toHaveLength(1);
    expect(content[0].category).toBe('technology');
  });

  it('should create fallback data', () => {
    const fallbackData = PersonalizationFallback.createFallbackData('user-123', { topics: ['tech'] });
    
    expect(fallbackData.type).toBe('default_feed');
    expect(fallbackData.message).toContain('default preferences');
    expect((fallbackData.data as any).preferences.userId).toBe('user-123');
  });
});

describe('SearchFallback', () => {
  it('should create empty search result', () => {
    const result = SearchFallback.createEmptySearchResult();
    
    expect(result.results).toEqual([]);
    expect(result.totalResults).toBe(0);
  });

  it('should create fallback search result', () => {
    const result = SearchFallback.createFallbackSearchResult('technology news');
    
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.totalResults).toBe(result.results.length);
    expect(result.results[0].relevanceScore).toBe(0.5);
    expect(result.results[0].chunk).toBeDefined();
  });

  it('should create fallback data', () => {
    const fallbackData = SearchFallback.createFallbackData('technology');
    
    expect(fallbackData.type).toBe('default_feed');
    expect(fallbackData.message).toContain('fallback search');
    expect((fallbackData.data as any).searchResult).toBeDefined();
  });
});

describe('DatabaseFallback', () => {
  beforeEach(() => {
    // Clear all cache before each test
    DatabaseFallback.clearAllCache();
  });

  it('should cache and retrieve data', () => {
    const testData = { id: 1, name: 'test' };
    
    DatabaseFallback.cacheData('test-key', testData);
    const retrieved = DatabaseFallback.getCachedData('test-key');
    
    expect(retrieved).toEqual(testData);
  });

  it('should return null for non-existent key', () => {
    const retrieved = DatabaseFallback.getCachedData('non-existent');
    
    expect(retrieved).toBeNull();
  });

  it('should create fallback data with cached content', () => {
    const testData = { id: 1, name: 'cached' };
    DatabaseFallback.cacheData('test-key', testData);
    
    const fallbackData = DatabaseFallback.createFallbackData('test-key', { id: 2, name: 'default' });
    
    expect(fallbackData.type).toBe('cached_content');
    expect(fallbackData.data).toEqual(testData);
    expect(fallbackData.message).toContain('cached data');
  });

  it('should create fallback data with default content when no cache', () => {
    const defaultData = { id: 2, name: 'default' };
    const fallbackData = DatabaseFallback.createFallbackData('missing-key', defaultData);
    
    expect(fallbackData.type).toBe('cached_content');
    expect(fallbackData.data).toEqual(defaultData);
    expect(fallbackData.message).toContain('default data');
  });
});

describe('GracefulDegradation', () => {
  beforeEach(() => {
    DatabaseFallback.clearAllCache();
  });

  it('should handle news feed generation with cached content', async () => {
    const cachedFeed = { summaries: [], lastUpdated: new Date() };
    DatabaseFallback.cacheData('feed-user-123', cachedFeed);
    
    const fallback = await GracefulDegradation.handleNewsFeedGeneration('user-123');
    
    expect(fallback.type).toBe('cached_content');
    expect(fallback.data).toEqual(cachedFeed);
    expect(fallback.message).toContain('cached personalized feed');
  });

  it('should handle news feed generation with preferences', async () => {
    const preferences: UserPreferences = {
      userId: 'user-456', // Use different user ID to avoid cache conflicts
      topics: ['technology'],
      tone: 'casual',
      readingTime: 5,
      preferredSources: [],
      excludedSources: [],
      lastUpdated: new Date(),
    };
    
    const fallback = await GracefulDegradation.handleNewsFeedGeneration('user-456', preferences);
    
    expect(fallback.type).toBe('default_feed');
    expect((fallback.data as any).preferences.userId).toBe('user-456');
  });

  it('should handle news feed generation without preferences', async () => {
    const fallback = await GracefulDegradation.handleNewsFeedGeneration('user-789');
    
    expect(fallback.type).toBe('default_feed');
    expect((fallback.data as any).articles).toBeDefined();
  });

  it('should handle summary generation with cached content', async () => {
    const mockArticles: NewsArticle[] = [{
      id: 'article-1',
      headline: 'Test',
      content: 'Content',
      source: 'Test Source',
      category: 'test',
      publishedAt: new Date(),
      url: 'https://example.com',
      tags: [],
    }];
    
    const cachedSummary = { id: 'cached', content: 'Cached summary' };
    const cacheKey = `summary-article-1-casual-5`;
    DatabaseFallback.cacheData(cacheKey, cachedSummary);
    
    const fallback = await GracefulDegradation.handleSummaryGeneration(mockArticles, 'casual', 5);
    
    expect(fallback.type).toBe('cached_content');
    expect(fallback.data).toEqual(cachedSummary);
  });

  it('should handle summary generation with fallback summary', async () => {
    const mockArticles: NewsArticle[] = [{
      id: 'article-2', // Use different article ID to avoid cache conflicts
      headline: 'Test Article',
      content: 'This is test content for the article.',
      source: 'Test Source',
      category: 'test',
      publishedAt: new Date(),
      url: 'https://example.com',
      tags: [],
    }];
    
    const fallback = await GracefulDegradation.handleSummaryGeneration(mockArticles, 'casual', 5);
    
    expect(fallback.type).toBe('excerpt');
    expect((fallback.data as any).summary).toBeDefined();
    expect((fallback.data as any).message).toContain('temporarily unavailable');
  });
});