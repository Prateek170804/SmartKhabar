import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';
import { userInteractionService } from '@/lib/database';
import { interactionLearner } from '@/lib/personalization/interaction-learner';

// Mock the services
vi.mock('@/lib/database', () => ({
  userInteractionService: {
    getUserInteractionStats: vi.fn(),
  },
}));

vi.mock('@/lib/personalization/interaction-learner', () => ({
  interactionLearner: {
    getUserInteractionStats: vi.fn(),
    analyzeInteractions: vi.fn(),
  },
}));

describe('Interaction Analytics API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic Analytics', () => {
    it('should return basic interaction statistics', async () => {
      const mockStats = {
        totalInteractions: 50,
        actionCounts: {
          read_more: 20,
          like: 15,
          hide: 10,
          share: 5,
        },
        recentActivity: [
          {
            userId: 'user123',
            articleId: 'article1',
            action: 'read_more' as const,
            timestamp: new Date('2024-01-15T10:00:00Z'),
          },
          {
            userId: 'user123',
            articleId: 'article2',
            action: 'like' as const,
            timestamp: new Date('2024-01-15T09:30:00Z'),
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
      expect(data.data.totalInteractions).toBe(50);
      expect(data.data.actionCounts).toEqual(mockStats.actionCounts);
      // Check recent activity structure (dates get serialized)
      expect(data.data.recentActivity).toHaveLength(mockStats.recentActivity.length);
      expect(data.data.recentActivity[0].userId).toBe('user123');
      expect(data.data.recentActivity[0].action).toBe('read_more');
      expect(data.data.timestamp).toBeDefined();
    });

    it('should handle users with no interactions', async () => {
      const mockStats = {
        totalInteractions: 0,
        actionCounts: {
          read_more: 0,
          like: 0,
          hide: 0,
          share: 0,
        },
        recentActivity: [],
      };

      vi.mocked(userInteractionService.getUserInteractionStats).mockResolvedValue(mockStats);

      const request = new NextRequest('http://localhost:3000/api/interactions?userId=newuser');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.totalInteractions).toBe(0);
      expect(data.data.actionCounts).toEqual(mockStats.actionCounts);
      expect(data.data.recentActivity).toEqual([]);
    });
  });

  describe('Detailed Analytics', () => {
    it('should return detailed analytics with learning insights', async () => {
      const mockBasicStats = {
        totalInteractions: 100,
        recentInteractions: 15,
        topActions: [
          { action: 'read_more', count: 40 },
          { action: 'like', count: 30 },
          { action: 'hide', count: 20 },
          { action: 'share', count: 10 },
        ],
        activityTrend: 'increasing' as const,
      };

      const mockInsights = {
        userId: 'user123',
        totalInteractions: 100,
        learningConfidence: 0.85,
        topCategories: [
          {
            item: 'technology',
            totalInteractions: 40,
            positiveInteractions: 35,
            negativeInteractions: 5,
            positiveRatio: 0.875,
            lastInteraction: new Date('2024-01-15T10:00:00Z'),
            trend: 'increasing' as const,
          },
          {
            item: 'science',
            totalInteractions: 25,
            positiveInteractions: 20,
            negativeInteractions: 5,
            positiveRatio: 0.8,
            lastInteraction: new Date('2024-01-15T09:00:00Z'),
            trend: 'stable' as const,
          },
        ],
        topSources: [
          {
            item: 'techcrunch',
            totalInteractions: 30,
            positiveInteractions: 25,
            negativeInteractions: 5,
            positiveRatio: 0.833,
            lastInteraction: new Date('2024-01-15T10:00:00Z'),
            trend: 'increasing' as const,
          },
          {
            item: 'bbc',
            totalInteractions: 20,
            positiveInteractions: 15,
            negativeInteractions: 5,
            positiveRatio: 0.75,
            lastInteraction: new Date('2024-01-15T08:00:00Z'),
            trend: 'stable' as const,
          },
        ],
        emergingTopics: ['artificial-intelligence', 'quantum-computing'],
        decliningSources: ['oldnews', 'slowsource'],
        recommendedPreferenceUpdates: {
          topics: ['technology', 'science', 'artificial-intelligence'],
          preferredSources: ['techcrunch', 'bbc'],
          excludedSources: ['oldnews'],
        },
        lastAnalyzed: new Date('2024-01-15T10:30:00Z'),
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
      // Check learning insights structure (dates get serialized)
      expect(data.data.learningInsights.userId).toBe(mockInsights.userId);
      expect(data.data.learningInsights.totalInteractions).toBe(mockInsights.totalInteractions);
      expect(data.data.learningInsights.learningConfidence).toBe(mockInsights.learningConfidence);
      expect(data.data.learningInsights.emergingTopics).toEqual(mockInsights.emergingTopics);
      expect(data.data.learningInsights.decliningSources).toEqual(mockInsights.decliningSources);
      expect(data.data.timestamp).toBeDefined();
    });

    it('should handle low confidence learning insights', async () => {
      const mockBasicStats = {
        totalInteractions: 3,
        recentInteractions: 1,
        topActions: [
          { action: 'read_more', count: 2 },
          { action: 'like', count: 1 },
        ],
        activityTrend: 'stable' as const,
      };

      const mockInsights = {
        userId: 'user123',
        totalInteractions: 3,
        learningConfidence: 0.2, // Low confidence
        topCategories: [],
        topSources: [],
        emergingTopics: [],
        decliningSources: [],
        recommendedPreferenceUpdates: {},
        lastAnalyzed: new Date('2024-01-15T10:30:00Z'),
      };

      vi.mocked(interactionLearner.getUserInteractionStats).mockResolvedValue(mockBasicStats);
      vi.mocked(interactionLearner.analyzeInteractions).mockResolvedValue(mockInsights);

      const request = new NextRequest('http://localhost:3000/api/interactions?userId=user123&type=detailed');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.learningInsights.learningConfidence).toBe(0.2);
      expect(data.data.learningInsights.topCategories).toEqual([]);
      expect(data.data.learningInsights.emergingTopics).toEqual([]);
    });
  });

  describe('Query Parameters', () => {
    it('should require userId parameter', async () => {
      const request = new NextRequest('http://localhost:3000/api/interactions');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('MISSING_USER_ID');
      expect(data.error.message).toBe('User ID is required');
    });

    it('should handle empty userId parameter', async () => {
      const request = new NextRequest('http://localhost:3000/api/interactions?userId=');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('MISSING_USER_ID');
    });

    it('should default to basic analytics when type is not specified', async () => {
      const mockStats = {
        totalInteractions: 10,
        actionCounts: {
          read_more: 5,
          like: 3,
          hide: 2,
          share: 0,
        },
        recentActivity: [],
      };

      vi.mocked(userInteractionService.getUserInteractionStats).mockResolvedValue(mockStats);

      const request = new NextRequest('http://localhost:3000/api/interactions?userId=user123');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.totalInteractions).toBe(10);
      expect(userInteractionService.getUserInteractionStats).toHaveBeenCalledWith('user123');
      expect(interactionLearner.getUserInteractionStats).not.toHaveBeenCalled();
    });

    it('should handle invalid type parameter gracefully', async () => {
      const mockStats = {
        totalInteractions: 10,
        actionCounts: {
          read_more: 5,
          like: 3,
          hide: 2,
          share: 0,
        },
        recentActivity: [],
      };

      vi.mocked(userInteractionService.getUserInteractionStats).mockResolvedValue(mockStats);

      const request = new NextRequest('http://localhost:3000/api/interactions?userId=user123&type=invalid');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      // Should default to basic analytics
      expect(userInteractionService.getUserInteractionStats).toHaveBeenCalledWith('user123');
      expect(interactionLearner.getUserInteractionStats).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle database service errors', async () => {
      vi.mocked(userInteractionService.getUserInteractionStats).mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = new NextRequest('http://localhost:3000/api/interactions?userId=user123');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('ANALYTICS_ERROR');
      expect(data.error.message).toBe('Failed to fetch interaction analytics');
    });

    it('should handle learning service errors in detailed analytics', async () => {
      const mockBasicStats = {
        totalInteractions: 10,
        recentInteractions: 2,
        topActions: [{ action: 'read_more', count: 5 }],
        activityTrend: 'stable' as const,
      };

      vi.mocked(interactionLearner.getUserInteractionStats).mockResolvedValue(mockBasicStats);
      vi.mocked(interactionLearner.analyzeInteractions).mockRejectedValue(
        new Error('Learning analysis failed')
      );

      const request = new NextRequest('http://localhost:3000/api/interactions?userId=user123&type=detailed');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('ANALYTICS_ERROR');
    });

    it('should handle timeout errors gracefully', async () => {
      vi.mocked(userInteractionService.getUserInteractionStats).mockImplementation(
        () => new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), 100);
        })
      );

      const request = new NextRequest('http://localhost:3000/api/interactions?userId=user123');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('ANALYTICS_ERROR');
    });
  });

  describe('Response Format', () => {
    it('should include timestamp in response', async () => {
      const mockStats = {
        totalInteractions: 5,
        actionCounts: {
          read_more: 3,
          like: 2,
          hide: 0,
          share: 0,
        },
        recentActivity: [],
      };

      vi.mocked(userInteractionService.getUserInteractionStats).mockResolvedValue(mockStats);

      const beforeRequest = new Date();
      const request = new NextRequest('http://localhost:3000/api/interactions?userId=user123');
      const response = await GET(request);
      const afterRequest = new Date();
      const data = await response.json();

      expect(data.data.timestamp).toBeDefined();
      const responseTimestamp = new Date(data.data.timestamp);
      expect(responseTimestamp.getTime()).toBeGreaterThanOrEqual(beforeRequest.getTime());
      expect(responseTimestamp.getTime()).toBeLessThanOrEqual(afterRequest.getTime());
    });

    it('should maintain consistent response structure for basic analytics', async () => {
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
            articleId: 'article1',
            action: 'read_more' as const,
            timestamp: new Date(),
          },
        ],
      };

      vi.mocked(userInteractionService.getUserInteractionStats).mockResolvedValue(mockStats);

      const request = new NextRequest('http://localhost:3000/api/interactions?userId=user123');
      const response = await GET(request);
      const data = await response.json();

      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('data');
      expect(data.data).toHaveProperty('userId', 'user123');
      expect(data.data).toHaveProperty('totalInteractions', 25);
      expect(data.data).toHaveProperty('actionCounts');
      expect(data.data).toHaveProperty('recentActivity');
      expect(data.data).toHaveProperty('timestamp');
    });

    it('should maintain consistent response structure for detailed analytics', async () => {
      const mockBasicStats = {
        totalInteractions: 25,
        recentInteractions: 5,
        topActions: [{ action: 'read_more', count: 10 }],
        activityTrend: 'stable' as const,
      };

      const mockInsights = {
        userId: 'user123',
        totalInteractions: 25,
        learningConfidence: 0.7,
        topCategories: [],
        topSources: [],
        emergingTopics: [],
        decliningSources: [],
        recommendedPreferenceUpdates: {},
        lastAnalyzed: new Date(),
      };

      vi.mocked(interactionLearner.getUserInteractionStats).mockResolvedValue(mockBasicStats);
      vi.mocked(interactionLearner.analyzeInteractions).mockResolvedValue(mockInsights);

      const request = new NextRequest('http://localhost:3000/api/interactions?userId=user123&type=detailed');
      const response = await GET(request);
      const data = await response.json();

      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('data');
      expect(data.data).toHaveProperty('userId', 'user123');
      expect(data.data).toHaveProperty('basicStats');
      expect(data.data).toHaveProperty('learningInsights');
      expect(data.data).toHaveProperty('timestamp');
    });
  });

  describe('Performance', () => {
    it('should handle concurrent analytics requests', async () => {
      const mockStats = {
        totalInteractions: 10,
        actionCounts: {
          read_more: 5,
          like: 3,
          hide: 2,
          share: 0,
        },
        recentActivity: [],
      };

      vi.mocked(userInteractionService.getUserInteractionStats).mockResolvedValue(mockStats);

      // Simulate concurrent requests
      const requests = Array.from({ length: 5 }, () =>
        new NextRequest('http://localhost:3000/api/interactions?userId=user123')
      );

      const responses = await Promise.all(requests.map(req => GET(req)));
      
      for (const response of responses) {
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data.totalInteractions).toBe(10);
      }

      expect(userInteractionService.getUserInteractionStats).toHaveBeenCalledTimes(5);
    });

    it('should handle large datasets efficiently', async () => {
      const largeStats = {
        totalInteractions: 10000,
        actionCounts: {
          read_more: 4000,
          like: 3000,
          hide: 2000,
          share: 1000,
        },
        recentActivity: Array.from({ length: 100 }, (_, i) => ({
          userId: 'user123',
          articleId: `article${i}`,
          action: 'read_more' as const,
          timestamp: new Date(),
        })),
      };

      vi.mocked(userInteractionService.getUserInteractionStats).mockResolvedValue(largeStats);

      const request = new NextRequest('http://localhost:3000/api/interactions?userId=user123');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.totalInteractions).toBe(10000);
      expect(data.data.recentActivity).toHaveLength(100);
    });
  });
});