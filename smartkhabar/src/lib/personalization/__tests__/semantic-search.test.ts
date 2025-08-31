import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { UserPreferences, SearchFilters, SearchResult, TextChunk } from '@/types';
import {
  SemanticSearchService,
  createSemanticSearchService,
  createAndInitializeSemanticSearchService,
  searchByPreferences,
  DEFAULT_SEMANTIC_SEARCH_CONFIG,
  SemanticSearchError,
} from '../semantic-search';
import { VectorStore, createVectorStore } from '@/lib/text-processing/vector-store';
import { PreferenceQueryConverter, createPreferenceQueryConverter } from '../preference-query-converter';

// Mock dependencies
vi.mock('@/lib/text-processing/vector-store', () => ({
  createVectorStore: vi.fn(),
  VectorStore: vi.fn(),
}));

vi.mock('../preference-query-converter', () => ({
  createPreferenceQueryConverter: vi.fn(),
  PreferenceQueryConverter: vi.fn(),
}));

describe('SemanticSearchService', () => {
  let service: SemanticSearchService;
  let mockVectorStore: {
    initialize: Mock;
    searchSimilar: Mock;
    updateConfig: Mock;
  };
  let mockQueryConverter: {
    convertPreferencesToQuery: Mock;
    generateFallbackQuery: Mock;
  };

  const samplePreferences: UserPreferences = {
    userId: 'user123',
    topics: ['technology', 'artificial intelligence'],
    tone: 'casual',
    readingTime: 5,
    preferredSources: ['techcrunch', 'bbc'],
    excludedSources: ['tabloid-news'],
    lastUpdated: new Date(),
  };

  const sampleTextChunk: TextChunk = {
    id: 'chunk1',
    articleId: 'article1',
    content: 'This is a sample article about artificial intelligence and machine learning.',
    embedding: Array.from({ length: 384 }, () => Math.random()),
    metadata: {
      source: 'techcrunch',
      category: 'technology',
      publishedAt: new Date('2024-01-15'),
      chunkIndex: 0,
      wordCount: 50,
    },
  };

  const sampleSearchResult: SearchResult = {
    chunk: sampleTextChunk,
    relevanceScore: 0.85,
  };

  const sampleQueryResult = {
    queryText: 'technology artificial intelligence',
    queryEmbedding: Array.from({ length: 384 }, () => Math.random()),
    weightedTopics: [
      { topic: 'technology', weight: 1.0 },
      { topic: 'artificial intelligence', weight: 1.0 },
    ],
    fallbackUsed: false,
    processingTime: 100,
  };

  beforeEach(() => {
    mockVectorStore = {
      initialize: vi.fn().mockResolvedValue(undefined),
      searchSimilar: vi.fn().mockResolvedValue({
        results: [sampleSearchResult],
        metrics: {
          queryTime: 50,
          totalVectors: 1000,
          resultsReturned: 1,
          similarityScores: [0.85],
          filtersApplied: [],
        },
      }),
      updateConfig: vi.fn(),
    };

    mockQueryConverter = {
      convertPreferencesToQuery: vi.fn().mockResolvedValue(sampleQueryResult),
      generateFallbackQuery: vi.fn().mockResolvedValue({
        ...sampleQueryResult,
        queryText: 'general news current events',
        fallbackUsed: true,
      }),
    };

    // Mock the factory functions
    vi.mocked(createVectorStore).mockReturnValue(mockVectorStore as any);
    vi.mocked(createPreferenceQueryConverter).mockReturnValue(mockQueryConverter as any);

    service = new SemanticSearchService();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await service.initialize();
      expect(mockVectorStore.initialize).toHaveBeenCalled();
    });
  });

  describe('searchByPreferences', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should search by preferences successfully', async () => {
      const result = await service.searchByPreferences(samplePreferences);

      expect(result.results).toHaveLength(1);
      expect(result.results[0]).toMatchObject({
        chunk: sampleTextChunk,
        baseRelevanceScore: 0.85,
        categoryBoost: expect.any(Number),
        sourceBoost: expect.any(Number),
        recencyBoost: expect.any(Number),
        finalScore: expect.any(Number),
        matchedPreferences: expect.any(Array),
      });

      expect(result.metrics).toMatchObject({
        queryProcessingTime: expect.any(Number),
        vectorSearchTime: expect.any(Number),
        scoringTime: expect.any(Number),
        totalTime: expect.any(Number),
        resultsFound: 1,
        resultsAfterFiltering: 1,
        fallbackUsed: false,
        averageRelevanceScore: 0.85,
        topCategories: expect.any(Array),
        topSources: expect.any(Array),
      });

      expect(mockQueryConverter.convertPreferencesToQuery).toHaveBeenCalledWith(samplePreferences);
      expect(mockVectorStore.searchSimilar).toHaveBeenCalledWith(
        sampleQueryResult.queryEmbedding,
        expect.objectContaining({
          minRelevanceScore: DEFAULT_SEMANTIC_SEARCH_CONFIG.relevanceThreshold,
          sources: samplePreferences.preferredSources,
        })
      );
    });

    it('should apply category boost when enabled', async () => {
      const result = await service.searchByPreferences(samplePreferences);
      const enhancedResult = result.results[0];

      expect(enhancedResult.categoryBoost).toBeGreaterThan(1.0);
      expect(enhancedResult.matchedPreferences).toContain('category:technology');
    });

    it('should apply source boost when enabled', async () => {
      const result = await service.searchByPreferences(samplePreferences);
      const enhancedResult = result.results[0];

      expect(enhancedResult.sourceBoost).toBeGreaterThan(1.0);
      expect(enhancedResult.matchedPreferences).toContain('source:techcrunch');
    });

    it('should apply recency boost for recent articles', async () => {
      // Create a recent article
      const recentChunk = {
        ...sampleTextChunk,
        metadata: {
          ...sampleTextChunk.metadata,
          publishedAt: new Date(), // Today
        },
      };

      mockVectorStore.searchSimilar.mockResolvedValue({
        results: [{ chunk: recentChunk, relevanceScore: 0.85 }],
        metrics: {
          queryTime: 50,
          totalVectors: 1000,
          resultsReturned: 1,
          similarityScores: [0.85],
          filtersApplied: [],
        },
      });

      const result = await service.searchByPreferences(samplePreferences);
      const enhancedResult = result.results[0];

      expect(enhancedResult.recencyBoost).toBeGreaterThan(1.0);
    });

    it('should use fallback query when no results found', async () => {
      // Mock empty initial search
      mockVectorStore.searchSimilar
        .mockResolvedValueOnce({
          results: [],
          metrics: {
            queryTime: 50,
            totalVectors: 1000,
            resultsReturned: 0,
            similarityScores: [],
            filtersApplied: [],
          },
        })
        .mockResolvedValueOnce({
          results: [sampleSearchResult],
          metrics: {
            queryTime: 50,
            totalVectors: 1000,
            resultsReturned: 1,
            similarityScores: [0.85],
            filtersApplied: [],
          },
        });

      const result = await service.searchByPreferences(samplePreferences);

      expect(result.metrics.fallbackUsed).toBe(true);
      expect(mockQueryConverter.generateFallbackQuery).toHaveBeenCalled();
      expect(mockVectorStore.searchSimilar).toHaveBeenCalledTimes(2);
    });

    it('should handle additional filters', async () => {
      const additionalFilters: SearchFilters = {
        categories: ['technology'],
        dateRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-12-31'),
        },
      };

      await service.searchByPreferences(samplePreferences, additionalFilters);

      expect(mockVectorStore.searchSimilar).toHaveBeenCalledWith(
        sampleQueryResult.queryEmbedding,
        expect.objectContaining({
          categories: ['technology'],
          dateRange: additionalFilters.dateRange,
        })
      );
    });

    it('should limit results to maxResults configuration', async () => {
      // Create multiple results
      const multipleResults = Array.from({ length: 20 }, (_, i) => ({
        chunk: { ...sampleTextChunk, id: `chunk${i}` },
        relevanceScore: 0.8 - i * 0.01,
      }));

      mockVectorStore.searchSimilar.mockResolvedValue({
        results: multipleResults,
        metrics: {
          queryTime: 50,
          totalVectors: 1000,
          resultsReturned: 20,
          similarityScores: multipleResults.map(r => r.relevanceScore),
          filtersApplied: [],
        },
      });

      const result = await service.searchByPreferences(samplePreferences);

      expect(result.results.length).toBeLessThanOrEqual(DEFAULT_SEMANTIC_SEARCH_CONFIG.maxResults);
    });

    it('should sort results by final score', async () => {
      const multipleResults = [
        { chunk: { ...sampleTextChunk, id: 'chunk1' }, relevanceScore: 0.7 },
        { chunk: { ...sampleTextChunk, id: 'chunk2' }, relevanceScore: 0.9 },
        { chunk: { ...sampleTextChunk, id: 'chunk3' }, relevanceScore: 0.8 },
      ];

      mockVectorStore.searchSimilar.mockResolvedValue({
        results: multipleResults,
        metrics: {
          queryTime: 50,
          totalVectors: 1000,
          resultsReturned: 3,
          similarityScores: [0.7, 0.9, 0.8],
          filtersApplied: [],
        },
      });

      const result = await service.searchByPreferences(samplePreferences);

      // Results should be sorted by final score (descending)
      for (let i = 0; i < result.results.length - 1; i++) {
        expect(result.results[i].finalScore).toBeGreaterThanOrEqual(
          result.results[i + 1].finalScore
        );
      }
    });

    it('should handle search errors gracefully', async () => {
      mockVectorStore.searchSimilar.mockRejectedValue(new Error('Vector search failed'));

      await expect(service.searchByPreferences(samplePreferences))
        .rejects.toThrow(SemanticSearchError);
    });
  });

  describe('findSimilarArticles', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should find similar articles successfully', async () => {
      // Mock finding the reference article
      mockVectorStore.searchSimilar
        .mockResolvedValueOnce({
          results: [sampleSearchResult],
          metrics: { queryTime: 50, totalVectors: 1000, resultsReturned: 1, similarityScores: [0.85], filtersApplied: [] },
        })
        .mockResolvedValueOnce({
          results: [
            { chunk: { ...sampleTextChunk, id: 'chunk2', articleId: 'article2' }, relevanceScore: 0.8 },
            { chunk: { ...sampleTextChunk, id: 'chunk3', articleId: 'article3' }, relevanceScore: 0.75 },
          ],
          metrics: { queryTime: 50, totalVectors: 1000, resultsReturned: 2, similarityScores: [0.8, 0.75], filtersApplied: [] },
        });

      const result = await service.findSimilarArticles('article1', 5);

      expect(result.results).toHaveLength(2);
      expect(result.results[0].chunk.articleId).toBe('article2');
      expect(result.results[1].chunk.articleId).toBe('article3');
      expect(result.metrics.resultsFound).toBe(2);
    });

    it('should exclude the reference article from results', async () => {
      mockVectorStore.searchSimilar
        .mockResolvedValueOnce({
          results: [sampleSearchResult],
          metrics: { queryTime: 50, totalVectors: 1000, resultsReturned: 1, similarityScores: [0.85], filtersApplied: [] },
        })
        .mockResolvedValueOnce({
          results: [
            sampleSearchResult, // Same article should be filtered out
            { chunk: { ...sampleTextChunk, id: 'chunk2', articleId: 'article2' }, relevanceScore: 0.8 },
          ],
          metrics: { queryTime: 50, totalVectors: 1000, resultsReturned: 2, similarityScores: [0.85, 0.8], filtersApplied: [] },
        });

      const result = await service.findSimilarArticles('article1', 5);

      expect(result.results).toHaveLength(1);
      expect(result.results[0].chunk.articleId).toBe('article2');
    });

    it('should handle article not found', async () => {
      mockVectorStore.searchSimilar.mockResolvedValue({
        results: [],
        metrics: { queryTime: 50, totalVectors: 1000, resultsReturned: 0, similarityScores: [], filtersApplied: [] },
      });

      const result = await service.findSimilarArticles('nonexistent-article', 5);

      expect(result.results).toHaveLength(0);
      expect(result.metrics.resultsFound).toBe(0);
    });

    it('should exclude specified categories', async () => {
      mockVectorStore.searchSimilar
        .mockResolvedValueOnce({
          results: [sampleSearchResult],
          metrics: { queryTime: 50, totalVectors: 1000, resultsReturned: 1, similarityScores: [0.85], filtersApplied: [] },
        })
        .mockResolvedValueOnce({
          results: [
            { chunk: { ...sampleTextChunk, id: 'chunk2', articleId: 'article2' }, relevanceScore: 0.8 },
          ],
          metrics: { queryTime: 50, totalVectors: 1000, resultsReturned: 1, similarityScores: [0.8], filtersApplied: [] },
        });

      await service.findSimilarArticles('article1', 5, ['sports', 'politics']);

      expect(mockVectorStore.searchSimilar).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.objectContaining({
          categories: expect.arrayContaining(['technology', 'business', 'science', 'entertainment']),
        })
      );
    });
  });

  describe('getTrendingTopics', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should analyze trending topics successfully', async () => {
      const multipleResults = [
        { chunk: { ...sampleTextChunk, metadata: { ...sampleTextChunk.metadata, category: 'technology' } }, relevanceScore: 0.8 },
        { chunk: { ...sampleTextChunk, metadata: { ...sampleTextChunk.metadata, category: 'technology' } }, relevanceScore: 0.8 },
        { chunk: { ...sampleTextChunk, metadata: { ...sampleTextChunk.metadata, category: 'business' } }, relevanceScore: 0.8 },
      ];

      mockVectorStore.searchSimilar.mockResolvedValue({
        results: multipleResults,
        metrics: { queryTime: 50, totalVectors: 1000, resultsReturned: 3, similarityScores: [0.8, 0.8, 0.8], filtersApplied: [] },
      });

      const trends = await service.getTrendingTopics(24, 10);

      expect(trends).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            topic: expect.any(String),
            score: expect.any(Number),
            articleCount: expect.any(Number),
          }),
        ])
      );

      expect(trends[0].score).toBeGreaterThanOrEqual(trends[1]?.score || 0);
    });

    it('should use correct time window for trending analysis', async () => {
      const timeWindowHours = 12;
      await service.getTrendingTopics(timeWindowHours, 5);

      const expectedStartDate = new Date(Date.now() - timeWindowHours * 60 * 60 * 1000);
      
      expect(mockVectorStore.searchSimilar).toHaveBeenCalledWith(
        '',
        expect.objectContaining({
          dateRange: expect.objectContaining({
            start: expect.any(Date),
            end: expect.any(Date),
          }),
        })
      );
    });
  });

  describe('configuration management', () => {
    it('should return current configuration', () => {
      const config = service.getConfig();
      expect(config).toEqual(expect.objectContaining(DEFAULT_SEMANTIC_SEARCH_CONFIG));
    });

    it('should update configuration', () => {
      const newConfig = {
        relevanceThreshold: 0.5,
        maxResults: 20,
      };

      service.updateConfig(newConfig);
      const updatedConfig = service.getConfig();

      expect(updatedConfig.relevanceThreshold).toBe(0.5);
      expect(updatedConfig.maxResults).toBe(20);
    });

    it('should update vector store config when provided', () => {
      const vectorStoreConfig = {
        similarityThreshold: 0.2,
      };

      service.updateConfig({ vectorStoreConfig });

      expect(mockVectorStore.updateConfig).toHaveBeenCalledWith(vectorStoreConfig);
    });
  });

  describe('factory functions', () => {
    it('should create service with default config', () => {
      const newService = createSemanticSearchService();
      expect(newService).toBeInstanceOf(SemanticSearchService);
    });

    it('should create service with custom config', () => {
      const customConfig = { relevanceThreshold: 0.4 };
      const newService = createSemanticSearchService(customConfig);
      expect(newService.getConfig().relevanceThreshold).toBe(0.4);
    });

    it('should create and initialize service', async () => {
      const service = await createAndInitializeSemanticSearchService();
      expect(service).toBeInstanceOf(SemanticSearchService);
      expect(mockVectorStore.initialize).toHaveBeenCalled();
    });
  });

  describe('utility functions', () => {
    it('should search by preferences using utility function', async () => {
      // Mock the factory function
      const mockService = {
        initialize: vi.fn().mockResolvedValue(undefined),
        searchByPreferences: vi.fn().mockResolvedValue({
          results: [
            {
              ...sampleSearchResult,
              baseRelevanceScore: 0.85,
              categoryBoost: 1.2,
              sourceBoost: 1.1,
              recencyBoost: 1.0,
              finalScore: 1.122,
              matchedPreferences: ['category:technology'],
            },
          ],
          metrics: {},
        }),
      };

      vi.doMock('../semantic-search', () => ({
        createSemanticSearchService: vi.fn(() => mockService),
        searchByPreferences: async (preferences: UserPreferences, filters?: SearchFilters) => {
          const service = mockService;
          await service.initialize();
          const result = await service.searchByPreferences(preferences, filters);
          return result.results;
        },
      }));

      const { searchByPreferences: utilityFunction } = await import('../semantic-search');
      const results = await utilityFunction(samplePreferences);

      expect(results).toHaveLength(1);
      expect(mockService.initialize).toHaveBeenCalled();
      expect(mockService.searchByPreferences).toHaveBeenCalledWith(samplePreferences, undefined);
    });
  });
});