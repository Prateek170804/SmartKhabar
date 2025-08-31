import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { FirecrawlClient, createFirecrawlClient } from '../firecrawl-client';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

// Mock config
vi.mock('@/lib/config', () => ({
  config: {
    firecrawl: {
      apiKey: 'test-api-key',
      baseUrl: 'https://api.firecrawl.dev',
    },
  },
}));

describe('FirecrawlClient Integration Tests', () => {
  let client: FirecrawlClient;
  let mockAxiosInstance: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock axios.create
    mockAxiosInstance = {
      post: vi.fn(),
      interceptors: {
        response: {
          use: vi.fn(),
        },
      },
    };
    
    mockedAxios.create = vi.fn().mockReturnValue(mockAxiosInstance);
    mockedAxios.get = vi.fn();
    
    client = new FirecrawlClient({
      apiKey: 'test-api-key',
      baseUrl: 'https://api.firecrawl.dev',
      timeout: 30000,
      retryAttempts: 2,
      retryDelay: 100,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Client Configuration', () => {
    it('should create client with correct configuration', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'https://api.firecrawl.dev',
        timeout: 30000,
        headers: {
          'Authorization': 'Bearer test-api-key',
          'Content-Type': 'application/json',
        },
      });
    });
  });

  describe('URL Scraping', () => {
    it('should successfully scrape a URL and return content', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            markdown: '# Test Article\n\nThis is test content.',
            metadata: {
              title: 'Test Article',
              description: 'Test description',
              publishedTime: '2024-01-01T00:00:00Z',
            },
          },
        },
      };

      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      const result = await client.scrapeUrl('https://example.com/article', {
        includeMarkdown: true,
        onlyMainContent: true,
      });

      expect(result).toEqual({
        content: '# Test Article\n\nThis is test content.',
        title: 'Test Article',
        description: 'Test description',
        publishedTime: '2024-01-01T00:00:00Z',
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/v0/scrape', {
        url: 'https://example.com/article',
        formats: ['markdown'],
        onlyMainContent: true,
        timeout: 30000,
      });
    });

    it('should handle scraping failures with proper error messages', async () => {
      const mockResponse = {
        data: {
          success: false,
          error: 'Failed to scrape URL',
        },
      };

      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      await expect(
        client.scrapeUrl('https://example.com/article')
      ).rejects.toThrow('Failed to scrape https://example.com/article: Failed to scrape URL');
    });

    it('should retry on server errors with exponential backoff', async () => {
      const serverError = {
        response: { status: 500 },
        isAxiosError: true,
      };

      const successResponse = {
        data: {
          success: true,
          data: {
            markdown: 'Success after retry',
            metadata: { title: 'Retry Success' },
          },
        },
      };

      mockAxiosInstance.post
        .mockRejectedValueOnce(serverError)
        .mockResolvedValueOnce(successResponse);

      const result = await client.scrapeUrl('https://example.com/article');

      expect(result.content).toBe('Success after retry');
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(2);
    });

    it('should not retry on client errors (4xx)', async () => {
      const clientError = {
        response: { status: 404 },
        isAxiosError: true,
      };

      mockAxiosInstance.post.mockRejectedValueOnce(clientError);

      await expect(
        client.scrapeUrl('https://example.com/article')
      ).rejects.toThrow();

      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
    });
  });

  describe('Domain Crawling', () => {
    it('should successfully crawl a domain and return multiple articles', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: [
            {
              markdown: '# Article 1\n\nContent 1',
              metadata: {
                title: 'Article 1',
                sourceURL: 'https://example.com/article1',
                publishedTime: '2024-01-01T00:00:00Z',
              },
            },
            {
              markdown: '# Article 2\n\nContent 2',
              metadata: {
                title: 'Article 2',
                sourceURL: 'https://example.com/article2',
                publishedTime: '2024-01-02T00:00:00Z',
              },
            },
          ],
        },
      };

      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      const result = await client.crawlDomain('https://example.com', {
        limit: 5,
        includeMarkdown: true,
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        url: 'https://example.com/article1',
        content: '# Article 1\n\nContent 1',
        title: 'Article 1',
        description: undefined,
        publishedTime: '2024-01-01T00:00:00Z',
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/v0/crawl', {
        url: 'https://example.com',
        limit: 5,
        scrapeOptions: {
          formats: ['markdown'],
          onlyMainContent: true,
        },
      });
    });
  });

  describe('Hacker News Scraping', () => {
    it('should successfully scrape Hacker News with fallback mechanisms', async () => {
      // Mock main page scraping
      const mainPageResponse = {
        data: {
          success: true,
          data: {
            markdown: `# Hacker News\n\n[Article 1](https://news.ycombinator.com/item?id=123456)\n[Article 2](https://example.com/article2)`,
            metadata: { title: 'Hacker News' },
          },
        },
      };

      // Mock individual story scraping
      const storyResponse = {
        data: {
          success: true,
          data: {
            markdown: '# Test Story\n\nThis is a test story from Hacker News with enough content to be valid and interesting.',
            metadata: {
              title: 'Test Story',
              publishedTime: '2024-01-01T00:00:00Z',
            },
          },
        },
      };

      mockAxiosInstance.post
        .mockResolvedValueOnce(mainPageResponse) // Main page
        .mockResolvedValue(storyResponse); // Story pages

      const result = await client.scrapeHackerNews({ limit: 2 });

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toMatchObject({
        headline: 'Test Story',
        source: 'hacker-news',
        category: 'technology',
        tags: expect.arrayContaining(['technology', 'hacker-news']),
      });
    });

    it('should fallback to Hacker News API when scraping fails', async () => {
      // Mock scraping failure
      mockAxiosInstance.post.mockRejectedValueOnce(new Error('Scraping failed'));

      // Mock Hacker News API responses
      const topStoriesResponse = { data: [123456] };
      const storyResponse = {
        data: {
          id: 123456,
          type: 'story',
          title: 'API Story 1',
          url: 'https://example.com/api-story-1',
          by: 'testuser',
          time: 1704067200, // 2024-01-01 00:00:00 UTC
          score: 100,
          descendants: 50,
        },
      };

      mockedAxios.get
        .mockResolvedValueOnce(topStoriesResponse)
        .mockResolvedValueOnce(storyResponse);

      const result = await client.scrapeHackerNews({ 
        limit: 1, 
        fallbackToApi: true 
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        headline: 'API Story 1',
        source: 'hacker-news',
        category: 'technology',
        url: 'https://example.com/api-story-1',
      });
    });
  });

  describe('Health Metrics', () => {
    it('should track health metrics correctly', async () => {
      const successResponse = {
        data: {
          success: true,
          data: {
            markdown: 'Success',
            metadata: { title: 'Success' },
          },
        },
      };

      const errorResponse = {
        response: { status: 500 },
        isAxiosError: true,
      };

      mockAxiosInstance.post
        .mockResolvedValueOnce(successResponse)
        .mockRejectedValueOnce(errorResponse)
        .mockRejectedValueOnce(errorResponse);

      // One successful request
      await client.scrapeUrl('https://example.com/success');

      // Two failed requests (with retries)
      try {
        await client.scrapeUrl('https://example.com/fail1');
      } catch {}
      
      try {
        await client.scrapeUrl('https://example.com/fail2');
      } catch {}

      const metrics = client.getHealthMetrics();
      expect(metrics.requestCount).toBe(3);
      expect(metrics.errorCount).toBe(2);
      expect(metrics.errorRate).toBeCloseTo(0.67, 1);
      expect(metrics.isHealthy).toBe(false);
    });

    it('should reset health metrics', () => {
      client.resetHealthMetrics();
      const metrics = client.getHealthMetrics();
      
      expect(metrics.requestCount).toBe(0);
      expect(metrics.errorCount).toBe(0);
      expect(metrics.errorRate).toBe(0);
      expect(metrics.isHealthy).toBe(true);
    });
  });

  describe('Content Processing', () => {
    it('should clean and format content properly', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            markdown: `# Test Article\n\n\nThis is content with    excessive   spaces.\n\n\n\nAnd too many line breaks.`,
            metadata: {
              title: 'Test Article',
              publishedTime: '2024-01-01T00:00:00Z',
            },
          },
        },
      };

      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      const result = await client.scrapeUrl('https://example.com/article');

      expect(result.content).toBe(
        '# Test Article\n\nThis is content with excessive spaces.\n\nAnd too many line breaks.'
      );
    });
  });
});

describe('createFirecrawlClient Factory', () => {
  it('should create client with config values', () => {
    const client = createFirecrawlClient();
    
    expect(mockedAxios.create).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: 'https://api.firecrawl.dev',
        timeout: 30000,
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-api-key',
          'Content-Type': 'application/json',
        }),
      })
    );
  });

  it('should throw error when API key is missing', () => {
    // Temporarily mock config without API key
    vi.doMock('@/lib/config', () => ({
      config: {
        firecrawl: {
          apiKey: '',
          baseUrl: 'https://api.firecrawl.dev',
        },
      },
    }));

    expect(() => createFirecrawlClient()).toThrow(
      'FIRECRAWL_API_KEY environment variable is required'
    );
  });
});