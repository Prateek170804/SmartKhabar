import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from '../route';
import { NextRequest } from 'next/server';

// Mock the scheduler
const mockScheduler = {
  executeCollection: vi.fn(),
};

vi.mock('@/lib/news-collection/scheduler', () => ({
  createNewsCollectionScheduler: vi.fn(() => mockScheduler),
}));

// Mock the config
vi.mock('@/lib/config', () => ({
  config: {
    newsSources: {
      cnn: 'cnn',
      bbc: 'bbc-news',
      techcrunch: 'techcrunch',
    },
  },
}));

describe('/api/cron/collect-news', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Store original environment
    originalEnv = process.env;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = originalEnv;
  });

  describe('GET', () => {
    it('should successfully execute scheduled collection', async () => {
      const mockStatus = {
        id: 'collection-123',
        startTime: new Date(),
        endTime: new Date(),
        status: 'completed' as const,
        articlesCollected: 25,
        sourcesProcessed: 3,
        sourcesWithErrors: 0,
        errors: [],
        metadata: {
          collectionTime: 5000,
          memoryUsage: process.memoryUsage(),
        },
      };

      mockScheduler.executeCollection.mockResolvedValue(mockStatus);

      const request = new NextRequest('http://localhost:3000/api/cron/collect-news');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.collectionId).toBe('collection-123');
      expect(data.data.articlesCollected).toBe(25);
      expect(data.data.sourcesProcessed).toBe(3);
      expect(data.data.sourcesWithErrors).toBe(0);
      expect(data.data.collectionTime).toBe(5000);
      expect(data.data.errors).toEqual([]);
    });

    it('should handle collection failures', async () => {
      const error = new Error('Collection service unavailable');
      mockScheduler.executeCollection.mockRejectedValue(error);

      const request = new NextRequest('http://localhost:3000/api/cron/collect-news');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('COLLECTION_FAILED');
      expect(data.error.message).toBe('Collection service unavailable');
    });

    it('should verify cron secret when provided', async () => {
      process.env.CRON_SECRET = 'test-secret';

      // Request without authorization header
      const requestWithoutAuth = new NextRequest('http://localhost:3000/api/cron/collect-news');
      const responseWithoutAuth = await GET(requestWithoutAuth);
      
      expect(responseWithoutAuth.status).toBe(401);

      // Request with wrong authorization
      const requestWithWrongAuth = new NextRequest('http://localhost:3000/api/cron/collect-news', {
        headers: {
          'authorization': 'Bearer wrong-secret',
        },
      });
      const responseWithWrongAuth = await GET(requestWithWrongAuth);
      
      expect(responseWithWrongAuth.status).toBe(401);

      // Request with correct authorization
      mockScheduler.executeCollection.mockResolvedValue({
        id: 'collection-123',
        articlesCollected: 10,
        sourcesProcessed: 2,
        sourcesWithErrors: 0,
        errors: [],
        metadata: { collectionTime: 2000 },
      });

      const requestWithCorrectAuth = new NextRequest('http://localhost:3000/api/cron/collect-news', {
        headers: {
          'authorization': 'Bearer test-secret',
        },
      });
      const responseWithCorrectAuth = await GET(requestWithCorrectAuth);
      
      expect(responseWithCorrectAuth.status).toBe(200);
    });

    it('should work without cron secret when not configured', async () => {
      delete process.env.CRON_SECRET;

      mockScheduler.executeCollection.mockResolvedValue({
        id: 'collection-123',
        articlesCollected: 10,
        sourcesProcessed: 2,
        sourcesWithErrors: 0,
        errors: [],
        metadata: { collectionTime: 2000 },
      });

      const request = new NextRequest('http://localhost:3000/api/cron/collect-news');
      const response = await GET(request);
      
      expect(response.status).toBe(200);
    });

    it('should create scheduler with correct configuration', async () => {
      mockScheduler.executeCollection.mockResolvedValue({
        id: 'collection-123',
        articlesCollected: 10,
        sourcesProcessed: 2,
        sourcesWithErrors: 0,
        errors: [],
        metadata: { collectionTime: 2000 },
      });

      const request = new NextRequest('http://localhost:3000/api/cron/collect-news');
      await GET(request);

      const { createNewsCollectionScheduler } = await import('@/lib/news-collection/scheduler');
      
      expect(createNewsCollectionScheduler).toHaveBeenCalledWith({
        sources: ['cnn', 'bbc-news', 'techcrunch'],
        articlesPerSource: 15,
        includeHackerNews: true,
        enableDeduplication: true,
        maxRetries: 3,
        retryDelayMs: 5000,
      });
    });

    it('should handle partial collection success with errors', async () => {
      const mockStatus = {
        id: 'collection-123',
        startTime: new Date(),
        endTime: new Date(),
        status: 'completed' as const,
        articlesCollected: 15,
        sourcesProcessed: 3,
        sourcesWithErrors: 1,
        errors: [
          {
            source: 'cnn',
            error: 'Rate limit exceeded',
          },
        ],
        metadata: {
          collectionTime: 3000,
        },
      };

      mockScheduler.executeCollection.mockResolvedValue(mockStatus);

      const request = new NextRequest('http://localhost:3000/api/cron/collect-news');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.articlesCollected).toBe(15);
      expect(data.data.sourcesWithErrors).toBe(1);
      expect(data.data.errors).toHaveLength(1);
      expect(data.data.errors[0].source).toBe('cnn');
      expect(data.data.errors[0].error).toBe('Rate limit exceeded');
    });
  });
});