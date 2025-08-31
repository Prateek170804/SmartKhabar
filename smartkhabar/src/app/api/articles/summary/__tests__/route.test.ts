/**
 * Tests for article summary API endpoint
 */

import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mock the summarization service before importing the route
vi.mock('@/lib/summarization/summarization-service', () => ({
  SummarizationService: vi.fn().mockImplementation(() => ({
    generateSummary: vi.fn().mockResolvedValue({
      id: 'summary-1',
      content: 'Test summary content',
      keyPoints: ['Point 1', 'Point 2'],
      sourceArticles: ['article-1'],
      estimatedReadingTime: 2,
      tone: 'casual'
    }),
    getFallbackSummary: vi.fn().mockReturnValue({
      id: 'fallback-summary-1',
      content: 'Fallback summary content',
      keyPoints: ['Fallback point'],
      sourceArticles: ['article-1'],
      estimatedReadingTime: 1,
      tone: 'casual'
    }),
  }))
}));

// Import the route handlers after mocking
const { POST, GET } = await import('../route');

describe('/api/articles/summary', () => {
  const mockArticle = {
    id: 'article-1',
    headline: 'Test Article Headline',
    content: 'This is the test article content that should be summarized.',
    source: 'test-source',
    category: 'technology',
    publishedAt: '2024-01-01T00:00:00Z',
    url: 'https://example.com/article-1',
    tags: ['test', 'article']
  };

  describe('POST /api/articles/summary', () => {
    it('should handle validation errors for empty articles array', async () => {
      const invalidRequestBody = {
        articles: [], // Empty array should fail validation
        tone: 'casual',
        maxReadingTime: 5,
        userId: 'user-1'
      };

      const request = new NextRequest('http://localhost:3000/api/articles/summary', {
        method: 'POST',
        body: JSON.stringify(invalidRequestBody),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle validation errors for invalid tone', async () => {
      const invalidRequestBody = {
        articles: [mockArticle],
        tone: 'invalid-tone', // Invalid tone
        maxReadingTime: 5,
        userId: 'user-1'
      };

      const request = new NextRequest('http://localhost:3000/api/articles/summary', {
        method: 'POST',
        body: JSON.stringify(invalidRequestBody),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle validation errors for invalid reading time', async () => {
      const invalidRequestBody = {
        articles: [mockArticle],
        tone: 'casual',
        maxReadingTime: 20, // Exceeds maximum of 15
        userId: 'user-1'
      };

      const request = new NextRequest('http://localhost:3000/api/articles/summary', {
        method: 'POST',
        body: JSON.stringify(invalidRequestBody),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle missing userId', async () => {
      const invalidRequestBody = {
        articles: [mockArticle],
        tone: 'casual',
        maxReadingTime: 5
        // Missing userId
      };

      const request = new NextRequest('http://localhost:3000/api/articles/summary', {
        method: 'POST',
        body: JSON.stringify(invalidRequestBody),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should generate summary successfully with valid input', async () => {
      const validRequestBody = {
        articles: [mockArticle],
        tone: 'casual',
        maxReadingTime: 5,
        userId: 'user-1'
      };

      const request = new NextRequest('http://localhost:3000/api/articles/summary', {
        method: 'POST',
        body: JSON.stringify(validRequestBody),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('id');
      expect(data.data).toHaveProperty('content');
      expect(data.data).toHaveProperty('keyPoints');
      expect(data.data).toHaveProperty('sourceArticles');
      expect(data.data).toHaveProperty('estimatedReadingTime');
      expect(data.data).toHaveProperty('tone');
    });
  });

  describe('GET /api/articles/summary', () => {
    it('should return API information and cache statistics', async () => {
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('cacheSize');
      expect(data.data).toHaveProperty('cacheTTL');
      expect(data.data).toHaveProperty('availableTones');
      expect(data.data).toHaveProperty('readingTimeRange');
      expect(data.data).toHaveProperty('maxArticlesPerRequest');
      expect(data.data.availableTones).toEqual(['formal', 'casual', 'fun']);
      expect(data.data.readingTimeRange).toEqual({ min: 1, max: 15 });
    });
  });
});