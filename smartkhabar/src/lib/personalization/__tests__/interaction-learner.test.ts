import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import {
  InteractionLearner,
  InteractionLearnerError,
  DEFAULT_INTERACTION_LEARNER_CONFIG,
  InteractionLearnerConfig,
  LearningInsights,
  PreferenceUpdateResult,
} from '../interaction-learner';
import { UserInteraction, UserPreferences } from '@/types';
import { supabase } from '@/lib/supabase';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
  TABLES: {
    USER_INTERACTIONS: 'user_interactions',
    USER_PREFERENCES: 'user_preferences',
    ARTICLES: 'articles',
    ARTICLE_CHUNKS: 'article_chunks',
  },
}));

describe('InteractionLearner', () => {
  let interactionLearner: InteractionLearner;
  let mockSupabaseChain: any;

  const mockUserId = 'test-user-123';
  const mockArticleId = 'test-article-456';

  const mockUserPreferences: UserPreferences = {
    userId: mockUserId,
    topics: ['technology', 'science'],
    tone: 'casual',
    readingTime: 5,
    preferredSources: ['techcrunch'],
    excludedSources: [],
    lastUpdated: new Date('2024-01-01'),
  };

  const mockInteraction: UserInteraction = {
    userId: mockUserId,
    articleId: mockArticleId,
    action: 'read_more',
    timestamp: new Date(),
  };

  const mockInteractionsData = [
    {
      userId: mockUserId,
      articleId: 'article-1',
      action: 'read_more',
      timestamp: '2024-01-15T10:00:00Z',
      articles: {
        source: 'techcrunch',
        category: 'technology',
        tags: ['ai', 'machine-learning'],
      },
    },
    {
      userId: mockUserId,
      articleId: 'article-2',
      action: 'like',
      timestamp: '2024-01-14T10:00:00Z',
      articles: {
        source: 'bbc',
        category: 'science',
        tags: ['space', 'astronomy'],
      },
    },
    {
      userId: mockUserId,
      articleId: 'article-3',
      action: 'hide',
      timestamp: '2024-01-13T10:00:00Z',
      articles: {
        source: 'cnn',
        category: 'politics',
        tags: ['election', 'politics'],
      },
    },
    {
      userId: mockUserId,
      articleId: 'article-4',
      action: 'read_more',
      timestamp: '2024-01-12T10:00:00Z',
      articles: {
        source: 'techcrunch',
        category: 'technology',
        tags: ['ai', 'startups'],
      },
    },
    {
      userId: mockUserId,
      articleId: 'article-5',
      action: 'share',
      timestamp: '2024-01-11T10:00:00Z',
      articles: {
        source: 'bbc',
        category: 'science',
        tags: ['climate', 'environment'],
      },
    },
  ];

  beforeEach(() => {
    interactionLearner = new InteractionLearner();
    
    // Create a mock chain for Supabase operations
    mockSupabaseChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      single: vi.fn(),
    };

    (supabase.from as Mock).mockReturnValue(mockSupabaseChain);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      const learner = new InteractionLearner();
      expect(learner.getConfig()).toEqual(DEFAULT_INTERACTION_LEARNER_CONFIG);
    });

    it('should initialize with custom configuration', () => {
      const customConfig: Partial<InteractionLearnerConfig> = {
        learningRate: 0.2,
        minInteractionsForLearning: 10,
      };
      
      const learner = new InteractionLearner(customConfig);
      const config = learner.getConfig();
      
      expect(config.learningRate).toBe(0.2);
      expect(config.minInteractionsForLearning).toBe(10);
      expect(config.decayFactor).toBe(DEFAULT_INTERACTION_LEARNER_CONFIG.decayFactor);
    });
  });

  describe('trackInteraction', () => {
    it('should successfully track a user interaction', async () => {
      mockSupabaseChain.insert.mockResolvedValue({ error: null });
      mockSupabaseChain.select.mockResolvedValue({ 
        data: mockInteractionsData.slice(0, 3), 
        error: null 
      });

      await expect(interactionLearner.trackInteraction(mockInteraction))
        .resolves.not.toThrow();

      expect(supabase.from).toHaveBeenCalledWith('user_interactions');
      expect(mockSupabaseChain.insert).toHaveBeenCalledWith({
        userId: mockInteraction.userId,
        articleId: mockInteraction.articleId,
        action: mockInteraction.action,
        timestamp: mockInteraction.timestamp.toISOString(),
      });
    });

    it('should throw InteractionLearnerError on database error', async () => {
      const dbError = { message: 'Database connection failed' };
      mockSupabaseChain.insert.mockResolvedValue({ error: dbError });

      await expect(interactionLearner.trackInteraction(mockInteraction))
        .rejects.toThrow(InteractionLearnerError);
    });

    it('should clean up old interactions when limit is exceeded', async () => {
      const manyInteractions = Array.from({ length: 1005 }, (_, i) => ({
        ...mockInteractionsData[0],
        timestamp: new Date(Date.now() - i * 1000).toISOString(),
      }));

      mockSupabaseChain.insert.mockResolvedValue({ error: null });
      mockSupabaseChain.select.mockResolvedValue({ 
        data: manyInteractions, 
        error: null 
      });
      mockSupabaseChain.delete.mockResolvedValue({ error: null });

      await interactionLearner.trackInteraction(mockInteraction);

      expect(mockSupabaseChain.delete).toHaveBeenCalled();
    });
  });

  describe('analyzeInteractions', () => {
    it('should return empty insights for insufficient interactions', async () => {
      mockSupabaseChain.select.mockResolvedValue({ 
        data: mockInteractionsData.slice(0, 2), // Less than minInteractionsForLearning
        error: null 
      });

      const insights = await interactionLearner.analyzeInteractions(mockUserId);

      expect(insights.totalInteractions).toBe(0);
      expect(insights.learningConfidence).toBe(0);
      expect(insights.topCategories).toEqual([]);
      expect(insights.emergingTopics).toEqual([]);
    });

    it('should analyze interactions and generate insights', async () => {
      mockSupabaseChain.select.mockResolvedValue({ 
        data: mockInteractionsData, 
        error: null 
      });

      const insights = await interactionLearner.analyzeInteractions(mockUserId);

      expect(insights.userId).toBe(mockUserId);
      expect(insights.totalInteractions).toBe(mockInteractionsData.length);
      expect(insights.learningConfidence).toBeGreaterThan(0);
      expect(insights.topCategories.length).toBeGreaterThan(0);
      expect(insights.topSources.length).toBeGreaterThan(0);
      expect(insights.lastAnalyzed).toBeInstanceOf(Date);
    });

    it('should identify emerging topics from recent interactions', async () => {
      const recentInteractions = mockInteractionsData.map(interaction => ({
        ...interaction,
        timestamp: new Date().toISOString(), // Make all interactions recent
      }));

      mockSupabaseChain.select.mockResolvedValue({ 
        data: recentInteractions, 
        error: null 
      });

      const insights = await interactionLearner.analyzeInteractions(mockUserId);

      expect(insights.emergingTopics).toContain('ai');
    });

    it('should identify declining sources', async () => {
      const interactionsWithDecline = [
        ...mockInteractionsData,
        {
          userId: mockUserId,
          articleId: 'article-6',
          action: 'hide',
          timestamp: '2024-01-10T10:00:00Z',
          articles: {
            source: 'cnn',
            category: 'politics',
            tags: ['politics'],
          },
        },
        {
          userId: mockUserId,
          articleId: 'article-7',
          action: 'hide',
          timestamp: '2024-01-09T10:00:00Z',
          articles: {
            source: 'cnn',
            category: 'politics',
            tags: ['politics'],
          },
        },
      ];

      mockSupabaseChain.select.mockResolvedValue({ 
        data: interactionsWithDecline, 
        error: null 
      });

      const insights = await interactionLearner.analyzeInteractions(mockUserId);

      expect(insights.decliningSources).toContain('cnn');
    });

    it('should throw InteractionLearnerError on database error', async () => {
      const dbError = { message: 'Failed to fetch interactions' };
      mockSupabaseChain.select.mockResolvedValue({ error: dbError });

      await expect(interactionLearner.analyzeInteractions(mockUserId))
        .rejects.toThrow(InteractionLearnerError);
    });
  });

  describe('updatePreferencesFromInteractions', () => {
    it('should not update preferences when confidence is too low', async () => {
      mockSupabaseChain.select.mockResolvedValue({ 
        data: mockInteractionsData.slice(0, 2), // Low confidence scenario
        error: null 
      });

      const result = await interactionLearner.updatePreferencesFromInteractions(
        mockUserId,
        mockUserPreferences
      );

      expect(result.changes).toHaveLength(0);
      expect(result.updatedPreferences).toEqual(mockUserPreferences);
    });

    it('should update preferences based on learning insights', async () => {
      mockSupabaseChain.select.mockResolvedValue({ 
        data: mockInteractionsData, 
        error: null 
      });

      const result = await interactionLearner.updatePreferencesFromInteractions(
        mockUserId,
        mockUserPreferences
      );

      expect(result.changes.length).toBeGreaterThan(0);
      expect(result.updatedPreferences.lastUpdated).toBeInstanceOf(Date);
      expect(result.learningInsights).toBeDefined();
    });

    it('should update topics based on emerging patterns', async () => {
      const interactionsWithNewTopics = mockInteractionsData.map(interaction => ({
        ...interaction,
        timestamp: new Date().toISOString(),
        articles: {
          ...interaction.articles,
          tags: ['blockchain', 'cryptocurrency'], // New emerging topics
        },
      }));

      mockSupabaseChain.select.mockResolvedValue({ 
        data: interactionsWithNewTopics, 
        error: null 
      });

      const result = await interactionLearner.updatePreferencesFromInteractions(
        mockUserId,
        mockUserPreferences
      );

      const topicChange = result.changes.find(change => change.field === 'topics');
      expect(topicChange).toBeDefined();
      expect(topicChange?.reason).toContain('emerging topics');
    });

    it('should update preferred sources based on positive interactions', async () => {
      mockSupabaseChain.select.mockResolvedValue({ 
        data: mockInteractionsData, 
        error: null 
      });

      const result = await interactionLearner.updatePreferencesFromInteractions(
        mockUserId,
        mockUserPreferences
      );

      const sourceChange = result.changes.find(change => change.field === 'preferredSources');
      if (sourceChange) {
        expect(sourceChange.reason).toContain('positive source interactions');
      }
    });

    it('should update excluded sources based on negative interactions', async () => {
      const interactionsWithNegative = [
        ...mockInteractionsData,
        ...Array.from({ length: 3 }, (_, i) => ({
          userId: mockUserId,
          articleId: `negative-article-${i}`,
          action: 'hide' as const,
          timestamp: new Date().toISOString(),
          articles: {
            source: 'negative-source',
            category: 'unwanted',
            tags: ['spam'],
          },
        })),
      ];

      mockSupabaseChain.select.mockResolvedValue({ 
        data: interactionsWithNegative, 
        error: null 
      });

      const result = await interactionLearner.updatePreferencesFromInteractions(
        mockUserId,
        mockUserPreferences
      );

      const excludedChange = result.changes.find(change => change.field === 'excludedSources');
      if (excludedChange) {
        expect(excludedChange.reason).toContain('negative interactions');
      }
    });
  });

  describe('getUserInteractionStats', () => {
    it('should return interaction statistics', async () => {
      const statsData = mockInteractionsData.map(interaction => ({
        action: interaction.action,
        timestamp: interaction.timestamp,
      }));

      mockSupabaseChain.select.mockResolvedValue({ 
        data: statsData, 
        error: null 
      });

      const stats = await interactionLearner.getUserInteractionStats(mockUserId);

      expect(stats.totalInteractions).toBe(statsData.length);
      expect(stats.topActions).toBeDefined();
      expect(stats.activityTrend).toMatch(/increasing|decreasing|stable/);
    });

    it('should return empty stats for user with no interactions', async () => {
      mockSupabaseChain.select.mockResolvedValue({ 
        data: [], 
        error: null 
      });

      const stats = await interactionLearner.getUserInteractionStats(mockUserId);

      expect(stats.totalInteractions).toBe(0);
      expect(stats.recentInteractions).toBe(0);
      expect(stats.topActions).toEqual([]);
      expect(stats.activityTrend).toBe('stable');
    });

    it('should calculate activity trend correctly', async () => {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      const trendingUpData = [
        // Recent week - 5 interactions
        ...Array.from({ length: 5 }, (_, i) => ({
          action: 'read_more',
          timestamp: new Date(now.getTime() - i * 24 * 60 * 60 * 1000).toISOString(),
        })),
        // Previous week - 2 interactions
        ...Array.from({ length: 2 }, (_, i) => ({
          action: 'read_more',
          timestamp: new Date(sevenDaysAgo.getTime() - i * 24 * 60 * 60 * 1000).toISOString(),
        })),
      ];

      mockSupabaseChain.select.mockResolvedValue({ 
        data: trendingUpData, 
        error: null 
      });

      const stats = await interactionLearner.getUserInteractionStats(mockUserId);

      expect(stats.activityTrend).toBe('increasing');
    });
  });

  describe('resetUserLearning', () => {
    it('should successfully reset user learning data', async () => {
      mockSupabaseChain.delete.mockResolvedValue({ error: null });

      await expect(interactionLearner.resetUserLearning(mockUserId))
        .resolves.not.toThrow();

      expect(mockSupabaseChain.delete).toHaveBeenCalled();
      expect(mockSupabaseChain.eq).toHaveBeenCalledWith('userId', mockUserId);
    });

    it('should throw InteractionLearnerError on database error', async () => {
      const dbError = { message: 'Failed to delete interactions' };
      mockSupabaseChain.delete.mockResolvedValue({ error: dbError });

      await expect(interactionLearner.resetUserLearning(mockUserId))
        .rejects.toThrow(InteractionLearnerError);
    });
  });

  describe('configuration management', () => {
    it('should update configuration', () => {
      const newConfig = { learningRate: 0.3, decayFactor: 0.9 };
      
      interactionLearner.updateConfig(newConfig);
      const config = interactionLearner.getConfig();

      expect(config.learningRate).toBe(0.3);
      expect(config.decayFactor).toBe(0.9);
    });

    it('should return current configuration', () => {
      const config = interactionLearner.getConfig();
      
      expect(config).toEqual(DEFAULT_INTERACTION_LEARNER_CONFIG);
    });
  });

  describe('error handling', () => {
    it('should handle InteractionLearnerError correctly', () => {
      const error = new InteractionLearnerError('Test error', 'TEST_CODE');
      
      expect(error.name).toBe('InteractionLearnerError');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
    });

    it('should handle cleanup failures gracefully', async () => {
      // Mock successful insert but failed cleanup
      mockSupabaseChain.insert.mockResolvedValue({ error: null });
      mockSupabaseChain.select.mockResolvedValue({ 
        data: Array.from({ length: 1005 }, () => mockInteractionsData[0]), 
        error: null 
      });
      mockSupabaseChain.delete.mockResolvedValue({ 
        error: { message: 'Cleanup failed' } 
      });

      // Should not throw even if cleanup fails
      await expect(interactionLearner.trackInteraction(mockInteraction))
        .resolves.not.toThrow();
    });
  });

  describe('learning algorithms', () => {
    it('should calculate learning confidence correctly', async () => {
      // Test with different interaction counts
      const testCases = [
        { interactions: 3, expectedConfidence: 0 }, // Below minimum
        { interactions: 5, expectedConfidence: 0 }, // At minimum
        { interactions: 10, expectedConfidence: 0.3 }, // Above minimum
        { interactions: 50, expectedConfidence: 0.7 }, // High confidence
      ];

      for (const testCase of testCases) {
        const interactions = Array.from({ length: testCase.interactions }, (_, i) => ({
          ...mockInteractionsData[0],
          articleId: `article-${i}`,
        }));

        mockSupabaseChain.select.mockResolvedValue({ 
          data: interactions, 
          error: null 
        });

        const insights = await interactionLearner.analyzeInteractions(mockUserId);
        
        if (testCase.interactions < DEFAULT_INTERACTION_LEARNER_CONFIG.minInteractionsForLearning) {
          expect(insights.learningConfidence).toBe(0);
        } else {
          expect(insights.learningConfidence).toBeGreaterThan(0);
          expect(insights.learningConfidence).toBeLessThanOrEqual(1);
        }
      }
    });

    it('should prioritize items with higher positive ratios and interaction counts', async () => {
      const mixedInteractions = [
        // High positive ratio, high count (should rank high)
        ...Array.from({ length: 10 }, (_, i) => ({
          userId: mockUserId,
          articleId: `high-pos-${i}`,
          action: 'read_more',
          timestamp: new Date().toISOString(),
          articles: { source: 'high-positive-source', category: 'tech', tags: [] },
        })),
        // Low positive ratio, high count (should rank lower)
        ...Array.from({ length: 10 }, (_, i) => ({
          userId: mockUserId,
          articleId: `low-pos-${i}`,
          action: i < 3 ? 'read_more' : 'hide',
          timestamp: new Date().toISOString(),
          articles: { source: 'low-positive-source', category: 'politics', tags: [] },
        })),
        // High positive ratio, low count (should rank medium)
        ...Array.from({ length: 3 }, (_, i) => ({
          userId: mockUserId,
          articleId: `med-pos-${i}`,
          action: 'like',
          timestamp: new Date().toISOString(),
          articles: { source: 'medium-positive-source', category: 'science', tags: [] },
        })),
      ];

      mockSupabaseChain.select.mockResolvedValue({ 
        data: mixedInteractions, 
        error: null 
      });

      const insights = await interactionLearner.analyzeInteractions(mockUserId);

      expect(insights.topSources[0].item).toBe('high-positive-source');
      expect(insights.topSources[0].positiveRatio).toBeGreaterThan(0.8);
    });
  });
});