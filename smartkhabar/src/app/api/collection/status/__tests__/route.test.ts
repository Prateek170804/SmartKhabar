import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET, POST } from '../route';
import { NextRequest } from 'next/server';

// Mock the scheduler
const mockScheduler = {
  getCurrentStatus: vi.fn(),
  isCollectionRunning: vi.fn(),
  getCollectionHistory: vi.fn(),
  getCollectionStats: vi.fn(),
  executeCollection: vi.fn(),
};

vi.mock('@/lib/news-collection/scheduler', () => ({
  createNewsCollectionScheduler: vi.fn(() => mockScheduler),
}));

describe('/api/collection/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET', () => {
    it('should return current status by default', async () => {
      const mockStatus = {
        id: 'collection-123',
        startTime: new Date(),
        status: 'running' as const,
        articlesCollected: 0,
        sourcesProcessed: 0,
        sourcesWithErrors: 0,
        errors: [],
        metadata: { collectionTime: 0 },
      };

      mockScheduler.getCurrentStatus.mockReturnValue(mockStatus);
      mockScheduler.isCollectionRunning.mockReturnValue(true);

      const request = new NextRequest('http://localhost:3000/api/collection/status');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.currentStatus).toEqual(mockStatus);
      expect(data.data.isRunning).toBe(true);
    });

    it('should return current status when action=current', async () => {
      mockScheduler.getCurrentStatus.mockReturnValue(null);
      mockScheduler.isCollectionRunning.mockReturnValue(false);

      const request = new NextRequest('http://localhost:3000/api/collection/status?action=current');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.currentStatus).toBeNull();
      expect(data.data.isRunning).toBe(false);
    });

    it('should return collection history when action=history', async () => {
      const mockHistory = [
        {
          id: 'collection-1',
          startTime: new Date('2024-01-01T10:00:00Z'),
          endTime: new Date('2024-01-01T10:05:00Z'),
          status: 'completed' as const,
          articlesCollected: 20,
          sourcesProcessed: 3,
          sourcesWithErrors: 0,
          errors: [],
          metadata: { collectionTime: 5000 },
        },
        {
          id: 'collection-2',
          startTime: new Date('2024-01-01T08:00:00Z'),
          endTime: new Date('2024-01-01T08:03:00Z'),
          status: 'completed' as const,
          articlesCollected: 15,
          sourcesProcessed: 3,
          sourcesWithErrors: 1,
          errors: [{ source: 'cnn', error: 'Timeout' }],
          metadata: { collectionTime: 3000 },
        },
      ];

      mockScheduler.getCollectionHistory.mockReturnValue(mockHistory);

      const request = new NextRequest('http://localhost:3000/api/collection/status?action=history&limit=5');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.history).toEqual(mockHistory);
      expect(data.data.total).toBe(2);
      expect(mockScheduler.getCollectionHistory).toHaveBeenCalledWith(5);
    });

    it('should return collection statistics when action=stats', async () => {
      const mockStats = {
        totalCollections: 10,
        successfulCollections: 8,
        failedCollections: 2,
        averageArticlesPerCollection: 18,
        averageCollectionTime: 4500,
        lastCollectionTime: new Date('2024-01-01T10:00:00Z'),
      };

      mockScheduler.getCollectionStats.mockReturnValue(mockStats);

      const request = new NextRequest('http://localhost:3000/api/collection/status?action=stats');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockStats);
    });

    it('should return error for invalid action', async () => {
      const request = new NextRequest('http://localhost:3000/api/collection/status?action=invalid');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('INVALID_ACTION');
      expect(data.error.message).toContain('Invalid action parameter');
    });

    it('should handle scheduler errors', async () => {
      mockScheduler.getCurrentStatus.mockImplementation(() => {
        throw new Error('Scheduler error');
      });

      const request = new NextRequest('http://localhost:3000/api/collection/status');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('STATUS_REQUEST_FAILED');
      expect(data.error.message).toBe('Scheduler error');
    });

    it('should use default limit for history', async () => {
      mockScheduler.getCollectionHistory.mockReturnValue([]);

      const request = new NextRequest('http://localhost:3000/api/collection/status?action=history');
      await GET(request);

      expect(mockScheduler.getCollectionHistory).toHaveBeenCalledWith(10);
    });
  });

  describe('POST', () => {
    it('should trigger manual collection with default config', async () => {
      const mockStatus = {
        id: 'collection-manual-123',
        startTime: new Date(),
        endTime: new Date(),
        status: 'completed' as const,
        articlesCollected: 12,
        sourcesProcessed: 2,
        sourcesWithErrors: 0,
        errors: [],
        metadata: { collectionTime: 2500 },
      };

      mockScheduler.isCollectionRunning.mockReturnValue(false);
      
      // Mock the createNewsCollectionScheduler to return a new instance for manual collection
      const { createNewsCollectionScheduler } = await import('@/lib/news-collection/scheduler');
      const manualScheduler = {
        executeCollection: vi.fn().mockResolvedValue(mockStatus),
      };
      createNewsCollectionScheduler.mockReturnValueOnce(manualScheduler);

      const request = new NextRequest('http://localhost:3000/api/collection/status', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.collectionId).toBe('collection-manual-123');
      expect(data.data.articlesCollected).toBe(12);
      expect(data.data.sourcesProcessed).toBe(2);
      expect(data.data.sourcesWithErrors).toBe(0);
      expect(data.data.collectionTime).toBe(2500);
      expect(data.data.errors).toEqual([]);
    });

    it('should trigger manual collection with custom config', async () => {
      const mockStatus = {
        id: 'collection-custom-123',
        articlesCollected: 25,
        sourcesProcessed: 4,
        sourcesWithErrors: 1,
        errors: [{ source: 'custom-source', error: 'Custom error' }],
        metadata: { collectionTime: 4000 },
      };

      mockScheduler.isCollectionRunning.mockReturnValue(false);
      
      const { createNewsCollectionScheduler } = await import('@/lib/news-collection/scheduler');
      const customScheduler = {
        executeCollection: vi.fn().mockResolvedValue(mockStatus),
      };
      createNewsCollectionScheduler.mockReturnValueOnce(customScheduler);

      const customConfig = {
        sources: ['custom-source-1', 'custom-source-2'],
        articlesPerSource: 20,
        includeHackerNews: false,
        customUrls: ['https://example.com/feed'],
        enableDeduplication: true,
      };

      const request = new NextRequest('http://localhost:3000/api/collection/status', {
        method: 'POST',
        body: JSON.stringify(customConfig),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(createNewsCollectionScheduler).toHaveBeenCalledWith(customConfig);
      expect(data.data.articlesCollected).toBe(25);
      expect(data.data.sourcesWithErrors).toBe(1);
      expect(data.data.errors).toHaveLength(1);
    });

    it('should prevent manual collection when already running', async () => {
      mockScheduler.isCollectionRunning.mockReturnValue(true);

      const request = new NextRequest('http://localhost:3000/api/collection/status', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('COLLECTION_ALREADY_RUNNING');
      expect(data.error.message).toBe('A collection is already in progress');
    });

    it('should handle manual collection failures', async () => {
      mockScheduler.isCollectionRunning.mockReturnValue(false);
      
      const { createNewsCollectionScheduler } = await import('@/lib/news-collection/scheduler');
      const failingScheduler = {
        executeCollection: vi.fn().mockRejectedValue(new Error('Manual collection failed')),
      };
      createNewsCollectionScheduler.mockReturnValueOnce(failingScheduler);

      const request = new NextRequest('http://localhost:3000/api/collection/status', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('MANUAL_COLLECTION_FAILED');
      expect(data.error.message).toBe('Manual collection failed');
    });

    it('should handle invalid JSON in request body', async () => {
      mockScheduler.isCollectionRunning.mockReturnValue(false);
      
      const { createNewsCollectionScheduler } = await import('@/lib/news-collection/scheduler');
      const defaultScheduler = {
        executeCollection: vi.fn().mockResolvedValue({
          id: 'collection-123',
          articlesCollected: 5,
          sourcesProcessed: 1,
          sourcesWithErrors: 0,
          errors: [],
          metadata: { collectionTime: 1000 },
        }),
      };
      createNewsCollectionScheduler.mockReturnValueOnce(defaultScheduler);

      const request = new NextRequest('http://localhost:3000/api/collection/status', {
        method: 'POST',
        body: 'invalid json',
      });
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(createNewsCollectionScheduler).toHaveBeenCalledWith({
        sources: undefined,
        articlesPerSource: 10,
        includeHackerNews: true,
        customUrls: undefined,
        enableDeduplication: true,
      });
    });
  });
});