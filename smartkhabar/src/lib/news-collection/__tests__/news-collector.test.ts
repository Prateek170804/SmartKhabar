import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NewsCollector } from '../news-collector';
import { NewsAPIClient } from '../newsapi-client';
import { NewsArticle } from '@/types';

// Mock the NewsAPI client
vi.mock('../newsapi-client', () => ({
  NewsAPIClient: vi.fn(),
  createNewsAPIClient: vi.fn(),
}));

describe('NewsCollector', () => {
  let collector: NewsCollector;
  let mockNewsApiClient: any;

  const mockArticle1: NewsArticle = {
    id: 'article-1',
    headline: 'Test Article 1',
    content: 'This is test content for article 1. It contains enough text to be considered valid content for processing and testing purposes. The content should be long enough to pass validation checks and demonstrate proper functionality.',
    source: 'cnn',
    category: 'general',
    publishedAt: new Date('2024-01-15T10:00:00Z'),
    url: 'https://example.com/article1',
    tags: ['news', 'general'],
  };

  const mockArticle2: NewsArticle = {
    id: 'article-2',
    headline: 'Test Article 2',
    content: 'This is test content for article 2. It also contains sufficient text content for processing and validation. The article should have enough content to pass all quality checks and filtering mechanisms.',
    source: 'bbc-news',
    category: 'general',
    publishedAt: new Date('2024-01-15T11:00:00Z'),
    url: 'https://example.com/article2',
    tags: ['news', 'breaking'],
  };

  const mockArticle3: NewsArticle = {
    id: 'article-3',
    headline: 'Tech Article',
    content: 'This is technology-related content with artificial intelligence and machine learning topics. The article discusses the latest developments in AI technology and how machine learning is transforming various industries.',
    source: 'techcrunch',
    category: 'technology',
    publishedAt: new Date('2024-01-15T12:00:00Z'),
    url: 'https://example.com/article3',
    tags: ['technology', 'ai', 'machine learning'],
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock NewsAPI client methods
    mockNewsApiClient = {
      fetchFromSource: vi.fn(),
      fetchTopHeadlines: vi.fn(),
      getAvailableSources: vi.fn(),
    };

    // Mock the factory function
    const { createNewsAPIClient } = await import('../newsapi-client');
    vi.mocked(createNewsAPIClient).mockReturnValue(mockNewsApiClient);

    collector = new NewsCollector();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('collectFromAPI', () => {
    it('should collect articles from default sources successfully', async () => {
      mockNewsApiClient.fetchFromSource
        .mockResolvedValueOnce([mockArticle1])
        .mockResolvedValueOnce([mockArticle2])
        .mockResolvedValueOnce([mockArticle3]);

      const result = await collector.collectFromAPI();

      expect(mockNewsApiClient.fetchFromSource).toHaveBeenCalledTimes(3);
      expect(result.articles).toHaveLength(3);
      expect(result.errors).toHaveLength(0);
      expect(result.metadata.totalArticles).toBe(3);
      expect(result.metadata.sourcesProcessed).toBe(3);
      expect(result.metadata.sourcesWithErrors).toBe(0);
      expect(result.metadata.collectionTime).toBeGreaterThanOrEqual(0);

      // Should be sorted by publication date (newest first)
      expect(result.articles[0].id).toBe('article-3');
      expect(result.articles[1].id).toBe('article-2');
      expect(result.articles[2].id).toBe('article-1');
    });

    it('should handle custom sources and options', async () => {
      const customSources = ['cnn', 'bbc-news'];
      const timeRange = {
        from: new Date('2024-01-01T00:00:00Z'),
        to: new Date('2024-01-31T23:59:59Z'),
      };

      mockNewsApiClient.fetchFromSource
        .mockResolvedValueOnce([mockArticle1])
        .mockResolvedValueOnce([mockArticle2]);

      const result = await collector.collectFromAPI({
        sources: customSources,
        articlesPerSource: 15,
        timeRange,
      });

      expect(mockNewsApiClient.fetchFromSource).toHaveBeenCalledWith('cnn', {
        pageSize: 15,
        from: '2024-01-01T00:00:00.000Z',
        to: '2024-01-31T23:59:59.000Z',
      });

      expect(mockNewsApiClient.fetchFromSource).toHaveBeenCalledWith('bbc-news', {
        pageSize: 15,
        from: '2024-01-01T00:00:00.000Z',
        to: '2024-01-31T23:59:59.000Z',
      });

      expect(result.articles).toHaveLength(2);
      expect(result.metadata.sourcesProcessed).toBe(2);
    });

    it('should include top headlines when requested', async () => {
      mockNewsApiClient.fetchTopHeadlines.mockResolvedValueOnce([mockArticle1]);
      mockNewsApiClient.fetchFromSource.mockResolvedValueOnce([mockArticle2]);

      const result = await collector.collectFromAPI({
        sources: ['cnn'],
        articlesPerSource: 10,
        includeTopHeadlines: true,
      });

      expect(mockNewsApiClient.fetchTopHeadlines).toHaveBeenCalledWith('cnn', {
        pageSize: 5, // Half of articlesPerSource
      });

      expect(mockNewsApiClient.fetchFromSource).toHaveBeenCalledWith('cnn', {
        pageSize: 9, // Remaining after headlines
      });

      expect(result.articles).toHaveLength(2);
    });

    it('should handle source failures gracefully', async () => {
      mockNewsApiClient.fetchFromSource
        .mockRejectedValueOnce(new Error('CNN API failed'))
        .mockResolvedValueOnce([mockArticle2])
        .mockResolvedValueOnce([mockArticle3]);

      const result = await collector.collectFromAPI();

      expect(result.articles).toHaveLength(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        source: 'cnn',
        error: 'CNN API failed',
      });
      expect(result.metadata.sourcesWithErrors).toBe(1);
    });

    it('should remove duplicate articles', async () => {
      const duplicateArticle = { ...mockArticle1, id: 'duplicate-1' };

      mockNewsApiClient.fetchFromSource
        .mockResolvedValueOnce([mockArticle1, duplicateArticle])
        .mockResolvedValueOnce([mockArticle2])
        .mockResolvedValueOnce([mockArticle3]);

      const result = await collector.collectFromAPI();

      // Should remove duplicate based on URL
      expect(result.articles).toHaveLength(3);
      expect(result.articles.find(a => a.id === 'article-1')).toBeDefined();
      expect(result.articles.find(a => a.id === 'duplicate-1')).toBeUndefined();
    });
  });

  describe('collectFromSource', () => {
    it('should collect articles from a specific source', async () => {
      mockNewsApiClient.fetchFromSource.mockResolvedValueOnce([mockArticle1]);

      const articles = await collector.collectFromSource('cnn', {
        articlesCount: 15,
      });

      expect(mockNewsApiClient.fetchFromSource).toHaveBeenCalledWith('cnn', {
        pageSize: 15,
      });

      expect(articles).toHaveLength(1);
      expect(articles[0]).toEqual(mockArticle1);
    });

    it('should throw error if source collection fails', async () => {
      mockNewsApiClient.fetchFromSource.mockRejectedValueOnce(new Error('Source failed'));

      await expect(collector.collectFromSource('cnn')).rejects.toThrow(
        'Failed to collect from cnn: Source failed'
      );
    });

    it('should handle time range options', async () => {
      const timeRange = {
        from: new Date('2024-01-01T00:00:00Z'),
        to: new Date('2024-01-31T23:59:59Z'),
      };

      mockNewsApiClient.fetchTopHeadlines.mockResolvedValueOnce([]);
      mockNewsApiClient.fetchFromSource.mockResolvedValueOnce([mockArticle1]);

      await collector.collectFromSource('cnn', {
        timeRange,
        includeTopHeadlines: true,
      });

      expect(mockNewsApiClient.fetchTopHeadlines).toHaveBeenCalled();
      expect(mockNewsApiClient.fetchFromSource).toHaveBeenCalledWith('cnn', {
        pageSize: expect.any(Number),
        from: '2024-01-01T00:00:00.000Z',
        to: '2024-01-31T23:59:59.000Z',
      });
    });
  });

  describe('collectFreshArticles', () => {
    it('should collect articles from the last 24 hours', async () => {
      const now = new Date('2024-01-15T12:00:00Z');
      vi.setSystemTime(now);

      mockNewsApiClient.fetchTopHeadlines.mockResolvedValue([]);
      mockNewsApiClient.fetchFromSource
        .mockResolvedValueOnce([mockArticle1])
        .mockResolvedValueOnce([mockArticle2])
        .mockResolvedValueOnce([mockArticle3]);

      const result = await collector.collectFreshArticles();

      // Should call with 24-hour time range
      const expectedFrom = new Date('2024-01-14T12:00:00Z');
      const expectedTo = now;

      expect(mockNewsApiClient.fetchFromSource).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          from: expectedFrom.toISOString(),
          to: expectedTo.toISOString(),
        })
      );

      expect(result.articles).toHaveLength(3);

      vi.useRealTimers();
    });
  });

  describe('getAvailableSources', () => {
    it('should return available sources with active status', async () => {
      const mockSources = [
        { id: 'cnn', name: 'CNN', category: 'general' },
        { id: 'bbc-news', name: 'BBC News', category: 'general' },
        { id: 'techcrunch', name: 'TechCrunch', category: 'technology' },
        { id: 'other-source', name: 'Other Source', category: 'business' },
      ];

      mockNewsApiClient.getAvailableSources.mockResolvedValueOnce(mockSources);

      const sources = await collector.getAvailableSources();

      expect(sources).toHaveLength(4);
      expect(sources[0]).toEqual({
        id: 'cnn',
        name: 'CNN',
        category: 'general',
        isActive: true,
      });
      expect(sources[3]).toEqual({
        id: 'other-source',
        name: 'Other Source',
        category: 'business',
        isActive: false,
      });
    });

    it('should return empty array if API fails', async () => {
      mockNewsApiClient.getAvailableSources.mockRejectedValueOnce(new Error('API failed'));

      const sources = await collector.getAvailableSources();

      expect(sources).toEqual([]);
    });
  });

  describe('filterArticles', () => {
    const shortArticle: NewsArticle = {
      ...mockArticle1,
      id: 'short-article',
      content: 'Too short',
    };

    const invalidArticle: NewsArticle = {
      ...mockArticle1,
      id: 'invalid-article',
      content: '[Removed] This content is not available',
    };

    it('should filter articles by minimum content length', () => {
      const articles = [mockArticle1, shortArticle, mockArticle2];

      const filtered = collector.filterArticles(articles, {
        minContentLength: 50,
      });

      expect(filtered).toHaveLength(2);
      expect(filtered.find(a => a.id === 'short-article')).toBeUndefined();
    });

    it('should filter articles by exclude patterns', () => {
      const articles = [mockArticle1, invalidArticle, mockArticle2];

      const filtered = collector.filterArticles(articles, {
        excludePatterns: [/^\[Removed\]/i],
      });

      expect(filtered).toHaveLength(2);
      expect(filtered.find(a => a.id === 'invalid-article')).toBeUndefined();
    });

    it('should filter articles by required tags', () => {
      const articles = [mockArticle1, mockArticle2, mockArticle3];

      const filtered = collector.filterArticles(articles, {
        requiredTags: ['technology'],
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('article-3');
    });

    it('should apply multiple filters', () => {
      const articles = [mockArticle1, shortArticle, invalidArticle, mockArticle3];

      const filtered = collector.filterArticles(articles, {
        minContentLength: 50,
        excludePatterns: [/^\[Removed\]/i],
        requiredTags: ['news'],
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('article-1');
    });
  });

  describe('article quality validation', () => {
    it('should identify valid articles', () => {
      const validArticle: NewsArticle = {
        ...mockArticle1,
        content: 'This is a valid article with sufficient content length and no invalid patterns. The content is long enough to pass all validation checks and quality filters that are applied during processing.',
      };

      const filtered = collector.filterArticles([validArticle]);
      expect(filtered).toHaveLength(1);
    });

    it('should reject articles with invalid patterns', () => {
      const invalidArticles: NewsArticle[] = [
        {
          ...mockArticle1,
          id: 'removed',
          content: '[Removed] This content has been removed',
        },
        {
          ...mockArticle1,
          id: 'unavailable',
          content: 'This content is not available to subscribers',
        },
        {
          ...mockArticle1,
          id: 'newsletter',
          content: 'Sign up for our newsletter to continue reading',
        },
        {
          ...mockArticle1,
          id: 'subscribe',
          content: 'Subscribe to continue reading this article',
        },
      ];

      const filtered = collector.filterArticles(invalidArticles);
      expect(filtered).toHaveLength(0);
    });
  });
});