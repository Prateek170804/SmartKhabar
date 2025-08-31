import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { UserPreferences } from '@/types';
import {
  PreferenceQueryConverter,
  createPreferenceQueryConverter,
  convertPreferencesToQuery,
  generateFallbackQuery,
  DEFAULT_PREFERENCE_QUERY_CONFIG,
} from '../preference-query-converter';
import { EmbeddingService } from '@/lib/text-processing/embedding-service';

// Mock the embedding service
vi.mock('@/lib/text-processing/embedding-service', () => ({
  createEmbeddingService: vi.fn(() => ({
    embeddings: {
      embedQuery: vi.fn(),
    },
  })),
  EmbeddingService: vi.fn(),
}));

describe('PreferenceQueryConverter', () => {
  let converter: PreferenceQueryConverter;
  let mockEmbeddingService: {
    embeddings: {
      embedQuery: Mock;
    };
  };

  const samplePreferences: UserPreferences = {
    userId: 'user123',
    topics: ['technology', 'artificial intelligence', 'startups'],
    tone: 'casual',
    readingTime: 5,
    preferredSources: ['techcrunch', 'bbc'],
    excludedSources: ['tabloid-news'],
    lastUpdated: new Date(),
  };

  const sampleEmbedding = Array.from({ length: 384 }, (_, i) => Math.random() - 0.5);

  beforeEach(() => {
    mockEmbeddingService = {
      embeddings: {
        embedQuery: vi.fn().mockResolvedValue(sampleEmbedding),
      },
    };

    converter = new PreferenceQueryConverter({
      ...DEFAULT_PREFERENCE_QUERY_CONFIG,
      embeddingService: mockEmbeddingService as any,
    });
  });

  describe('convertPreferencesToQuery', () => {
    it('should convert user preferences to query successfully', async () => {
      const result = await converter.convertPreferencesToQuery(samplePreferences);

      expect(result).toMatchObject({
        queryText: expect.any(String),
        queryEmbedding: sampleEmbedding,
        weightedTopics: expect.arrayContaining([
          expect.objectContaining({
            topic: expect.any(String),
            weight: expect.any(Number),
          }),
        ]),
        fallbackUsed: false,
        processingTime: expect.any(Number),
      });

      expect(mockEmbeddingService.embeddings.embedQuery).toHaveBeenCalledWith(
        expect.any(String)
      );
    });

    it('should include user topics in the query text', async () => {
      const result = await converter.convertPreferencesToQuery(samplePreferences);

      expect(result.queryText).toContain('technology');
      expect(result.queryText).toContain('artificial intelligence');
      expect(result.queryText).toContain('startups');
    });

    it('should include preferred sources in the query text', async () => {
      const result = await converter.convertPreferencesToQuery(samplePreferences);

      expect(result.queryText).toContain('techcrunch');
      expect(result.queryText).toContain('bbc');
    });

    it('should create weighted topics from user preferences', async () => {
      const result = await converter.convertPreferencesToQuery(samplePreferences);

      expect(result.weightedTopics).toHaveLength(3);
      expect(result.weightedTopics).toEqual(
        expect.arrayContaining([
          { topic: 'technology', weight: 1.0 },
          { topic: 'artificial intelligence', weight: 1.0 },
          { topic: 'startups', weight: 1.0 },
        ])
      );
    });

    it('should use fallback when user has no topics', async () => {
      const preferencesWithoutTopics: UserPreferences = {
        ...samplePreferences,
        topics: [],
      };

      const result = await converter.convertPreferencesToQuery(preferencesWithoutTopics);

      expect(result.fallbackUsed).toBe(true);
      expect(result.weightedTopics).toEqual(
        expect.arrayContaining([
          { topic: 'general news', weight: 1.0 },
          { topic: 'current events', weight: 1.0 },
          { topic: 'breaking news', weight: 1.0 },
        ])
      );
    });

    it('should limit query text length according to config', async () => {
      const converterWithShortLimit = new PreferenceQueryConverter({
        ...DEFAULT_PREFERENCE_QUERY_CONFIG,
        maxQueryLength: 50,
        embeddingService: mockEmbeddingService as any,
      });

      const result = await converterWithShortLimit.convertPreferencesToQuery(samplePreferences);

      expect(result.queryText.length).toBeLessThanOrEqual(50);
    });

    it('should handle embedding service errors gracefully', async () => {
      mockEmbeddingService.embeddings.embedQuery.mockRejectedValue(
        new Error('Embedding service error')
      );

      await expect(
        converter.convertPreferencesToQuery(samplePreferences)
      ).rejects.toThrow('Embedding service error');
    });
  });

  describe('convertBatchPreferencesToQueries', () => {
    it('should convert multiple preferences to queries', async () => {
      const preferences1: UserPreferences = {
        ...samplePreferences,
        userId: 'user1',
        topics: ['technology'],
      };

      const preferences2: UserPreferences = {
        ...samplePreferences,
        userId: 'user2',
        topics: ['sports'],
      };

      const results = await converter.convertBatchPreferencesToQueries([
        preferences1,
        preferences2,
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].queryText).toContain('technology');
      expect(results[1].queryText).toContain('sports');
      expect(mockEmbeddingService.embeddings.embedQuery).toHaveBeenCalledTimes(2);
    });

    it('should handle empty array', async () => {
      const results = await converter.convertBatchPreferencesToQueries([]);

      expect(results).toHaveLength(0);
      expect(mockEmbeddingService.embeddings.embedQuery).not.toHaveBeenCalled();
    });
  });

  describe('generateFallbackQuery', () => {
    it('should generate fallback query successfully', async () => {
      const result = await converter.generateFallbackQuery();

      expect(result).toMatchObject({
        queryText: expect.any(String),
        queryEmbedding: sampleEmbedding,
        weightedTopics: expect.arrayContaining([
          { topic: 'general news', weight: 1.0 },
          { topic: 'current events', weight: 1.0 },
          { topic: 'breaking news', weight: 1.0 },
        ]),
        fallbackUsed: true,
        processingTime: expect.any(Number),
      });

      expect(result.queryText).toContain('general news');
      expect(result.queryText).toContain('current events');
      expect(result.queryText).toContain('breaking news');
    });
  });

  describe('calculateTopicWeights', () => {
    it('should assign equal weights when no interaction history', () => {
      const topics = ['technology', 'sports', 'politics'];
      const weights = converter.calculateTopicWeights(topics);

      expect(weights).toEqual([
        { topic: 'technology', weight: 1.0 },
        { topic: 'sports', weight: 1.0 },
        { topic: 'politics', weight: 1.0 },
      ]);
    });

    it('should calculate weights based on interaction history', () => {
      const topics = ['technology', 'sports'];
      const interactionHistory = [
        { topic: 'technology', positiveInteractions: 8, totalInteractions: 10 },
        { topic: 'sports', positiveInteractions: 2, totalInteractions: 10 },
      ];

      const weights = converter.calculateTopicWeights(topics, interactionHistory);

      expect(weights[0].topic).toBe('technology');
      expect(weights[0].weight).toBeGreaterThan(weights[1].weight);
      expect(weights[1].topic).toBe('sports');
      expect(weights[0].weight).toBeCloseTo(1.62, 1); // 0.1 + (0.8 * 1.9)
      expect(weights[1].weight).toBeCloseTo(0.48, 1); // 0.1 + (0.2 * 1.9)
    });

    it('should handle topics without interaction history', () => {
      const topics = ['technology', 'new-topic'];
      const interactionHistory = [
        { topic: 'technology', positiveInteractions: 5, totalInteractions: 10 },
      ];

      const weights = converter.calculateTopicWeights(topics, interactionHistory);

      expect(weights).toEqual([
        { topic: 'technology', weight: 1.05 }, // 0.1 + (0.5 * 1.9)
        { topic: 'new-topic', weight: 1.0 },
      ]);
    });
  });

  describe('validatePreferences', () => {
    it('should validate correct preferences', () => {
      const result = converter.validatePreferences(samplePreferences);

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.sanitizedPreferences).toEqual({
        ...samplePreferences,
        topics: ['technology', 'artificial intelligence', 'startups'],
        preferredSources: ['techcrunch', 'bbc'],
        excludedSources: ['tabloid-news'],
      });
    });

    it('should handle empty topics', () => {
      const preferencesWithEmptyTopics: UserPreferences = {
        ...samplePreferences,
        topics: [],
      };

      const result = converter.validatePreferences(preferencesWithEmptyTopics);

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('No topics specified, will use fallback');
      expect(result.sanitizedPreferences.topics).toEqual([]);
    });

    it('should sanitize topics by trimming and lowercasing', () => {
      const preferencesWithMessyTopics: UserPreferences = {
        ...samplePreferences,
        topics: ['  Technology  ', 'SPORTS', '', '   '],
      };

      const result = converter.validatePreferences(preferencesWithMessyTopics);

      expect(result.sanitizedPreferences.topics).toEqual(['technology', 'sports']);
    });

    it('should handle invalid tone', () => {
      const preferencesWithInvalidTone: UserPreferences = {
        ...samplePreferences,
        tone: 'invalid' as any,
      };

      const result = converter.validatePreferences(preferencesWithInvalidTone);

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Invalid tone "invalid", using default "casual"');
      expect(result.sanitizedPreferences.tone).toBe('casual');
    });

    it('should handle invalid reading time', () => {
      const preferencesWithInvalidTime: UserPreferences = {
        ...samplePreferences,
        readingTime: 20,
      };

      const result = converter.validatePreferences(preferencesWithInvalidTime);

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Invalid reading time 20, using default 5 minutes');
      expect(result.sanitizedPreferences.readingTime).toBe(5);
    });

    it('should sanitize sources', () => {
      const preferencesWithMessySources: UserPreferences = {
        ...samplePreferences,
        preferredSources: ['  TechCrunch  ', 'BBC', '', '   '],
        excludedSources: ['  TABLOID  ', '', 'spam-news'],
      };

      const result = converter.validatePreferences(preferencesWithMessySources);

      expect(result.sanitizedPreferences.preferredSources).toEqual(['techcrunch', 'bbc']);
      expect(result.sanitizedPreferences.excludedSources).toEqual(['tabloid', 'spam-news']);
    });
  });

  describe('configuration management', () => {
    it('should return current configuration', () => {
      const config = converter.getConfig();

      expect(config).toEqual(expect.objectContaining({
        topicWeight: expect.any(Number),
        sourceWeight: expect.any(Number),
        fallbackTopics: expect.any(Array),
        maxQueryLength: expect.any(Number),
      }));
    });

    it('should update configuration', () => {
      const newConfig = {
        topicWeight: 0.8,
        maxQueryLength: 300,
      };

      converter.updateConfig(newConfig);
      const updatedConfig = converter.getConfig();

      expect(updatedConfig.topicWeight).toBe(0.8);
      expect(updatedConfig.maxQueryLength).toBe(300);
      expect(updatedConfig.sourceWeight).toBe(DEFAULT_PREFERENCE_QUERY_CONFIG.sourceWeight);
    });
  });

  describe('factory functions', () => {
    it('should create converter with default config', () => {
      const newConverter = createPreferenceQueryConverter();
      expect(newConverter).toBeInstanceOf(PreferenceQueryConverter);
    });

    it('should create converter with custom config', () => {
      const customConfig = { topicWeight: 0.9 };
      const newConverter = createPreferenceQueryConverter(customConfig);
      expect(newConverter.getConfig().topicWeight).toBe(0.9);
    });
  });

  describe('utility functions', () => {
    it('should convert preferences to query using utility function', async () => {
      // Mock the createPreferenceQueryConverter function
      const mockConverter = {
        convertPreferencesToQuery: vi.fn().mockResolvedValue({
          queryText: 'test query',
          queryEmbedding: sampleEmbedding,
          weightedTopics: [],
          fallbackUsed: false,
          processingTime: 100,
        }),
      };

      vi.doMock('../preference-query-converter', () => ({
        createPreferenceQueryConverter: vi.fn(() => mockConverter),
        convertPreferencesToQuery: async (preferences: UserPreferences) => {
          const converter = mockConverter;
          return converter.convertPreferencesToQuery(preferences);
        },
      }));

      const { convertPreferencesToQuery: utilityFunction } = await import('../preference-query-converter');
      const result = await utilityFunction(samplePreferences);

      expect(result.queryText).toBe('test query');
      expect(mockConverter.convertPreferencesToQuery).toHaveBeenCalledWith(samplePreferences);
    });

    it('should generate fallback query using utility function', async () => {
      // Mock the createPreferenceQueryConverter function
      const mockConverter = {
        generateFallbackQuery: vi.fn().mockResolvedValue({
          queryText: 'fallback query',
          queryEmbedding: sampleEmbedding,
          weightedTopics: [],
          fallbackUsed: true,
          processingTime: 50,
        }),
      };

      vi.doMock('../preference-query-converter', () => ({
        createPreferenceQueryConverter: vi.fn(() => mockConverter),
        generateFallbackQuery: async () => {
          const converter = mockConverter;
          return converter.generateFallbackQuery();
        },
      }));

      const { generateFallbackQuery: utilityFunction } = await import('../preference-query-converter');
      const result = await utilityFunction();

      expect(result.queryText).toBe('fallback query');
      expect(result.fallbackUsed).toBe(true);
      expect(mockConverter.generateFallbackQuery).toHaveBeenCalled();
    });
  });
});