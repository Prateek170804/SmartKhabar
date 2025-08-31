import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, GET } from '../route';
import { userInteractionService } from '@/lib/database';
import { interactionLearner } from '@/lib/personalization/interaction-learner';
import { userPreferencesService } from '@/lib/database';

// Mock the database services
vi.mock('@/lib/database', () => ({
  userInteractionService: {
    recordInteraction: vi.fn(),
    getUserInteractionStats: vi.fn(),
  },
  userPreferencesService: {
    getOrCreateUserPreferences: vi.fn(),
    updateUserPreferences: vi.fn(),
  },
}));

// Mock the interaction learner
vi.mock('@/lib/personalization/interaction-learner', () => ({
  interactionLearner: {
    trackInteraction: vi.fn(),
    updatePreferencesFromInteractions: vi.fn(),
    getUserInteractionStats: vi.fn(),
    analyzeInteractions: vi.fn(),
  },
}));

describe('/api/interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/interactions', () => {
    describe('Single interaction tracking', () => {
      it('should successfully track a single interaction', async () => {
        // Mock successful responses
        const mockPreferences = {
          userId: 'user123',
          topics: ['technology'],
          tone: 'casual' as const,
          readingTime: 5,
          preferredSources: [],
          excludedSources: [],
          lastUpdated: new Date(),
        };

        const mockLearningResult = {
          updatedPreferences: mockPreferences,
          changes: [],
          learningInsights: {
            userId: 'user123',
            totalInteractions: 5,
            learningConfidence: 0.6,
            topCategories: [],
            topSources: [],
            emergingTopics: [],
            decliningSources: [],
            recommendedPreferenceUpdates: {},
            lastAnalyzed: new Date(),
          },
        };

        vi.mocked(userInteractionService.recordInteraction).mockResolvedValue({
          userId: 'user123',
          articleId: 'article123',
          action: 'read_more',
          timestamp: new Date(),
        });

        vi.mocked(interactionLearner.trackInteraction).mockResolvedValue();
        vi.mocked(userPreferencesService.getOrCreateUserPreferences).mockResolvedValue(mockPreferences);
        vi.mocked(interactionLearner.updatePreferencesFromInteractions).mockResolvedValue(mockLearningResult);

        const request = new NextRequest('http://localhost:3000/api/interactions', {
          method: 'POST',
          body: JSON.stringify({
            userId: 'user123',
            articleId: 'article123',
            action: 'read_more',
          }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.success).toBe(true);
        expect(userInteractionService.recordInteraction).toHaveBeenCalledWith({
          userId: 'user123',
          articleId: 'article123',
          action: 'read_more',
        });
        expect(interactionLearner.trackInteraction).toHaveBeenCalled();
      });

      it('should update preferences when learning suggests changes', async () => {
        const mockPreferences = {
          userId: 'user123',
          topics: ['technology'],
          tone: 'casual' as const,
          readingTime: 5,
          preferredSources: [],
          excludedSources: [],
          lastUpdated: new Date(),
        };

        const mockUpdatedPreferences = {
          ...mockPreferences,
          topics: ['technology', 'science'],
          preferredSources: ['techcrunch'],
        };

        const mockLearningResult = {
          updatedPreferences: mockUpdatedPreferences,
          changes: [
            {
              field: 'topics' as const,
              oldValue: ['technology'],
              newValue: ['technology', 'science'],
              reason: 'Added emerging topics',
              confidence: 0.8,
            },
          ],
          learningInsights: {
            userId: 'user123',
            totalInteractions: 10,
            learningConfidence: 0.8,
            topCategories: [],
            topSources: [],
            emergingTopics: ['science'],
            decliningSources: [],
            recommendedPreferenceUpdates: {},
            lastAnalyzed: new Date(),
          },
        };

        vi.mocked(userInteractionService.recordInteraction).mockResolvedValue({
          userId: 'user123',
          articleId: 'article123',
          action: 'like',
          timestamp: new Date(),
        });

        vi.mocked(interactionLearner.trackInteraction).mockResolvedValue();
        vi.mocked(userPreferencesService.getOrCreateUserPreferences).mockResolvedValue(mockPreferences);
        vi.mocked(interactionLearner.updatePreferencesFromInteractions).mockResolvedValue(mockLearningResult);
        vi.mocked(userPreferencesService.updateUserPreferences).mockResolvedValue(mockUpdatedPreferences);

        const request = new NextRequest('http://localhost:3000/api/interactions', {
          method: 'POST',
          body: JSON.stringify({
            userId: 'user123',
            articleId: 'article123',
            action: 'like',
          }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.updatedPreferences).toBeDefined();
        expect(data.data.updatedPreferences.topics).toEqual(['technology', 'science']);
        expect(userPreferencesService.updateUserPreferences).toHaveBeenCalledWith('user123', {
          topics: ['technology', 'science'],
          preferredSources: ['techcrunch'],
          excludedSources: [],
        });
      });

      it('should validate required fields', async () => {
        const request = new NextRequest('http://localhost:3000/api/interactions', {
          method: 'POST',
          body: JSON.stringify({
            userId: 'user123',
            // Missing articleId and action
          }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('VALIDATION_ERROR');
      });

      it('should validate action enum values', async () => {
        const request = new NextRequest('http://localhost:3000/api/interactions', {
          method: 'POST',
          body: JSON.stringify({
            userId: 'user123',
            articleId: 'article123',
            action: 'invalid_action',
          }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('VALIDATION_ERROR');
      });

      it('should handle database errors gracefully', async () => {
        vi.mocked(userInteractionService.recordInteraction).mockRejectedValue(
          new Error('Database connection failed')
        );

        const request = new NextRequest('http://localhost:3000/api/interactions', {
          method: 'POST',
          body: JSON.stringify({
            userId: 'user123',
            articleId: 'article123',
            action: 'read_more',
          }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('PROCESSING_ERROR');
      });

      it('should handle invalid JSON', async () => {
        const request = new NextRequest('http://localhost:3000/api/interactions', {
          method: 'POST',
          body: 'invalid json',
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('INVALID_JSON');
      });
    });

    describe('Batch interaction tracking', () => {
      it('should successfully process batch interactions', async () => {
        const mockPreferences = {
          userId: 'user123',
          topics: ['technology'],
          tone: 'casual' as const,
          readingTime: 5,
          preferredSources: [],
          excludedSources: [],
          lastUpdated: new Date(),
        };

        const mockLearningResult = {
          updatedPreferences: mockPreferences,
          changes: [],
          learningInsights: {
            userId: 'user123',
            totalInteractions: 8,
            learningConfidence: 0.7,
            topCategories: [],
            topSources: [],
            emergingTopics: [],
            decliningSources: [],
            recommendedPreferenceUpdates: {},
            lastAnalyzed: new Date(),
          },
        };

        vi.mocked(userInteractionService.recordInteraction).mockResolvedValue({
          userId: 'user123',
          articleId: 'article123',
          action: 'read_more',
          timestamp: new Date(),
        });

        vi.mocked(interactionLearner.trackInteraction).mockResolvedValue();
        vi.mocked(userPreferencesService.getOrCreateUserPreferences).mockResolvedValue(mockPreferences);
        vi.mocked(interactionLearner.updatePreferencesFromInteractions).mockResolvedValue(mockLearningResult);

        const request = new NextRequest('http://localhost:3000/api/interactions', {
          method: 'POST',
          body: JSON.stringify({
            userId: 'user123',
            interactions: [
              {
                userId: 'user123',
                articleId: 'article123',
                action: 'read_more',
              },
              {
                userId: 'user123',
                articleId: 'article456',
                action: 'like',
              },
            ],
          }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(userInteractionService.recordInteraction).toHaveBeenCalledTimes(2);
        expect(interactionLearner.trackInteraction).toHaveBeenCalledTimes(2);
      });

      it('should validate batch request structure', async () => {
        const request = new NextRequest('http://localhost:3000/api/interactions', {
          method: 'POST',
          body: JSON.stringify({
            userId: 'user123',
            interactions: [], // Empty array should fail
          }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('VALIDATION_ERROR');
      });

      it('should validate individual interactions in batch', async () => {
        const request = new NextRequest('http://localhost:3000/api/interactions', {
          method: 'POST',
          body: JSON.stringify({
            userId: 'user123',
            interactions: [
              {
                userId: 'user123',
                articleId: 'article123',
                action: 'read_more',
              },
              {
                userId: 'user123',
                // Missing articleId
                action: 'like',
              },
            ],
          }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('VALIDATION_ERROR');
      });
    });
  });

  describe('GET /api/interactions', () => {
    it('should return basic interaction statistics', async () => {
      const mockStats = {
        totalInteractions: 25,
        actionCounts: {
          read_more: 10,
          like: 8,
          hide: 5,
          share: 2,
        },
        recentActivity: [
          {
            userId: 'user123',
            articleId: 'article123',
            action: 'read_more' as const,
            timestamp: new Date(),
          },
        ],
      };

      vi.mocked(userInteractionService.getUserInteractionStats).mockResolvedValue(mockStats);

      const request = new NextRequest('http://localhost:3000/api/interactions?userId=user123');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.userId).toBe('user123');
      expect(data.data.totalInteractions).toBe(25);
      expect(data.data.actionCounts).toEqual(mockStats.actionCounts);
    });

    it('should return detailed analytics when requested', async () => {
      const mockBasicStats = {
        totalInteractions: 25,
        recentInteractions: 5,
        topActions: [
          { action: 'read_more', count: 10 },
          { action: 'like', count: 8 },
        ],
        activityTrend: 'increasing' as const,
      };

      const mockInsights = {
        userId: 'user123',
        totalInteractions: 25,
        learningConfidence: 0.8,
        topCategories: [
          {
            item: 'technology',
            totalInteractions: 15,
            positiveInteractions: 12,
            negativeInteractions: 3,
            positiveRatio: 0.8,
            lastInteraction: new Date(),
            trend: 'increasing' as const,
          },
        ],
        topSources: [
          {
            item: 'techcrunch',
            totalInteractions: 10,
            positiveInteractions: 8,
            negativeInteractions: 2,
            positiveRatio: 0.8,
            lastInteraction: new Date(),
            trend: 'stable' as const,
          },
        ],
        emergingTopics: ['ai', 'blockchain'],
        decliningSources: ['oldnews'],
        recommendedPreferenceUpdates: {
          topics: ['technology', 'ai'],
          preferredSources: ['techcrunch'],
        },
        lastAnalyzed: new Date(),
      };

      vi.mocked(interactionLearner.getUserInteractionStats).mockResolvedValue(mockBasicStats);
      vi.mocked(interactionLearner.analyzeInteractions).mockResolvedValue(mockInsights);

      const request = new NextRequest('http://localhost:3000/api/interactions?userId=user123&type=detailed');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.userId).toBe('user123');
      expect(data.data.basicStats).toEqual(mockBasicStats);
      // Compare insights with date serialization handling
      expect(data.data.learningInsights.userId).toBe(mockInsights.userId);
      expect(data.data.learningInsights.totalInteractions).toBe(mockInsights.totalInteractions);
      expect(data.data.learningInsights.learningConfidence).toBe(mockInsights.learningConfidence);
      expect(data.data.learningInsights.emergingTopics).toEqual(mockInsights.emergingTopics);
      expect(data.data.learningInsights.decliningSources).toEqual(mockInsights.decliningSources);
    });

    it('should require userId parameter', async () => {
      const request = new NextRequest('http://localhost:3000/api/interactions');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('MISSING_USER_ID');
    });

    it('should handle analytics errors gracefully', async () => {
      vi.mocked(userInteractionService.getUserInteractionStats).mockRejectedValue(
        new Error('Analytics service unavailable')
      );

      const request = new NextRequest('http://localhost:3000/api/interactions?userId=user123');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('ANALYTICS_ERROR');
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle concurrent interaction tracking', async () => {
      const mockPreferences = {
        userId: 'user123',
        topics: ['technology'],
        tone: 'casual' as const,
        readingTime: 5,
        preferredSources: [],
        excludedSources: [],
        lastUpdated: new Date(),
      };

      const mockLearningResult = {
        updatedPreferences: mockPreferences,
        changes: [],
        learningInsights: {
          userId: 'user123',
          totalInteractions: 5,
          learningConfidence: 0.6,
          topCategories: [],
          topSources: [],
          emergingTopics: [],
          decliningSources: [],
          recommendedPreferenceUpdates: {},
          lastAnalyzed: new Date(),
        },
      };

      vi.mocked(userInteractionService.recordInteraction).mockResolvedValue({
        userId: 'user123',
        articleId: 'article123',
        action: 'read_more',
        timestamp: new Date(),
      });

      vi.mocked(interactionLearner.trackInteraction).mockResolvedValue();
      vi.mocked(userPreferencesService.getOrCreateUserPreferences).mockResolvedValue(mockPreferences);
      vi.mocked(interactionLearner.updatePreferencesFromInteractions).mockResolvedValue(mockLearningResult);

      // Simulate concurrent requests
      const requests = Array.from({ length: 3 }, (_, i) =>
        new NextRequest('http://localhost:3000/api/interactions', {
          method: 'POST',
          body: JSON.stringify({
            userId: 'user123',
            articleId: `article${i}`,
            action: 'read_more',
          }),
        })
      );

      const responses = await Promise.all(requests.map(req => POST(req)));
      
      for (const response of responses) {
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
      }
    });

    it('should handle learning service failures gracefully', async () => {
      vi.mocked(userInteractionService.recordInteraction).mockResolvedValue({
        userId: 'user123',
        articleId: 'article123',
        action: 'read_more',
        timestamp: new Date(),
      });

      vi.mocked(interactionLearner.trackInteraction).mockRejectedValue(
        new Error('Learning service unavailable')
      );

      const request = new NextRequest('http://localhost:3000/api/interactions', {
        method: 'POST',
        body: JSON.stringify({
          userId: 'user123',
          articleId: 'article123',
          action: 'read_more',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('PROCESSING_ERROR');
    });
  });
});