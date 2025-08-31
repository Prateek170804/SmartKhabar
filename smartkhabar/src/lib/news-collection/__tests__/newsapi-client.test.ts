import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { NewsAPIClient } from '../newsapi-client';
import { NewsArticle } from '@/types';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('NewsAPIClient', () => {
  let client: NewsAPIClient;
  let mockAxiosInstance: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Mock axios.create
    mockAxiosInstance = {
      get: vi.fn(),
      interceptors: {
        response: {
          use: vi.fn(),
        },
      },
    };
    
    mockedAxios.create.mockReturnValue(mockAxiosInstance);
    mockedAxios.isAxiosError.mockReturnValue(false);

    // Create client instance
    client = new NewsAPIClient({
      apiKey: 'test-api-key',
      baseUrl: 'https://newsapi.org/v2',
      timeout: 5000,
      retryAttempts: 2,
      retryDelay: 100,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create axios instance with correct configuration', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'https://newsapi.org/v2',
        timeout: 5000,
        headers: {
          'X-API-Key': 'test-api-key',
          'User-Agent': 'SmartKhabar/1.0',
        },
      });
    });

    it('should set up response interceptor', () => {
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
    });
  });

  describe('fetchFromSource', () => {
    const mockNewsAPIResponse = {
      data: {
        status: 'ok',
        totalResults: 2,
        articles: [
          {
            source: { id: 'cnn', name: 'CNN' },
            author: 'John Doe',
            title: 'Test Article 1',
            description: 'Test description 1',
            url: 'https://example.com/article1',
            urlToImage: 'https://example.com/image1.jpg',
            publishedAt: '2024-01-15T10:00:00Z',
            content: 'This is the full content of test article 1. It contains enough text to be considered valid content for processing.',
          },
          {
            source: { id: 'cnn', name: 'CNN' },
            author: 'Jane Smith',
            title: 'Test Article 2',
            description: 'Test description 2',
            url: 'https://example.com/article2',
            urlToImage: 'https://example.com/image2.jpg',
            publishedAt: '2024-01-15T11:00:00Z',
            content: 'This is the full content of test article 2. It also contains sufficient text content for processing.',
          },
        ],
      },
    };

    it('should fetch articles from a specific source successfully', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce(mockNewsAPIResponse);

      const articles = await client.fetchFromSource('cnn');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/everything', {
        params: {
          sources: 'cnn',
          pageSize: 20,
          page: 1,
          sortBy: 'publishedAt',
        },
      });

      expect(articles).toHaveLength(2);
      expect(articles[0]).toMatchObject({
        headline: 'Test Article 1',
        content: 'This is the full content of test article 1. It contains enough text to be considered valid content for processing.',
        source: 'cnn',
        category: 'general',
        url: 'https://example.com/article1',
      });
      expect(articles[0].publishedAt).toBeInstanceOf(Date);
      expect(articles[0].id).toBeDefined();
      expect(articles[0].tags).toBeInstanceOf(Array);
    });

    it('should handle custom options', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce(mockNewsAPIResponse);

      await client.fetchFromSource('techcrunch', {
        pageSize: 10,
        page: 2,
        from: '2024-01-01T00:00:00Z',
        to: '2024-01-31T23:59:59Z',
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/everything', {
        params: {
          sources: 'techcrunch',
          pageSize: 10,
          page: 2,
          sortBy: 'publishedAt',
          from: '2024-01-01T00:00:00Z',
          to: '2024-01-31T23:59:59Z',
        },
      });
    });

    it('should filter out articles without content', async () => {
      const responseWithIncompleteArticles = {
        data: {
          status: 'ok',
          totalResults: 3,
          articles: [
            {
              source: { id: 'cnn', name: 'CNN' },
              title: 'Valid Article',
              description: 'Valid description',
              url: 'https://example.com/valid',
              publishedAt: '2024-01-15T10:00:00Z',
              content: 'Valid content that is long enough',
            },
            {
              source: { id: 'cnn', name: 'CNN' },
              title: 'Invalid Article - No Content',
              description: 'Description only',
              url: 'https://example.com/invalid1',
              publishedAt: '2024-01-15T10:00:00Z',
              content: null,
            },
            {
              source: { id: 'cnn', name: 'CNN' },
              title: null,
              description: 'No title',
              url: 'https://example.com/invalid2',
              publishedAt: '2024-01-15T10:00:00Z',
              content: 'Some content',
            },
          ],
        },
      };

      mockAxiosInstance.get.mockResolvedValueOnce(responseWithIncompleteArticles);

      const articles = await client.fetchFromSource('cnn');

      expect(articles).toHaveLength(1);
      expect(articles[0].headline).toBe('Valid Article');
    });

    it('should handle API errors', async () => {
      const errorResponse = {
        data: {
          status: 'error',
          code: 'apiKeyInvalid',
          message: 'Your API key is invalid or incorrect.',
        },
      };

      // Mock successful response but with error status
      mockAxiosInstance.get.mockResolvedValueOnce(errorResponse);

      await expect(client.fetchFromSource('cnn')).rejects.toThrow(
        'NewsAPI request failed: error'
      );
    });

    it('should retry on server errors', async () => {
      const serverError = new Error('Network Error');
      mockAxiosInstance.get
        .mockRejectedValueOnce(serverError)
        .mockResolvedValueOnce(mockNewsAPIResponse);

      const articles = await client.fetchFromSource('cnn');

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
      expect(articles).toHaveLength(2);
    });

    it('should not retry on client errors', async () => {
      const clientError = {
        response: {
          status: 400,
          data: {
            status: 'error',
            code: 'parameterInvalid',
            message: 'Invalid parameter',
          },
        },
      };

      mockedAxios.isAxiosError.mockReturnValue(true);
      mockAxiosInstance.get.mockRejectedValueOnce(clientError);

      await expect(client.fetchFromSource('cnn')).rejects.toThrow();
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('fetchTopHeadlines', () => {
    const mockHeadlinesResponse = {
      data: {
        status: 'ok',
        totalResults: 1,
        articles: [
          {
            source: { id: 'bbc-news', name: 'BBC News' },
            author: 'BBC Reporter',
            title: 'Breaking News',
            description: 'Important breaking news',
            url: 'https://bbc.com/breaking',
            urlToImage: 'https://bbc.com/image.jpg',
            publishedAt: '2024-01-15T12:00:00Z',
            content: 'This is breaking news content that is important and timely.',
          },
        ],
      },
    };

    it('should fetch top headlines successfully', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce(mockHeadlinesResponse);

      const articles = await client.fetchTopHeadlines('bbc-news');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/top-headlines', {
        params: {
          sources: 'bbc-news',
          pageSize: 20,
          page: 1,
        },
      });

      expect(articles).toHaveLength(1);
      expect(articles[0].headline).toBe('Breaking News');
      expect(articles[0].source).toBe('bbc-news');
    });
  });

  describe('fetchFromMultipleSources', () => {
    it('should fetch from multiple sources sequentially', async () => {
      const cnnResponse = {
        data: {
          status: 'ok',
          totalResults: 1,
          articles: [
            {
              source: { id: 'cnn', name: 'CNN' },
              title: 'CNN Article',
              description: 'CNN description',
              url: 'https://cnn.com/article',
              publishedAt: '2024-01-15T10:00:00Z',
              content: 'CNN article content that is long enough to be valid.',
            },
          ],
        },
      };

      const bbcResponse = {
        data: {
          status: 'ok',
          totalResults: 1,
          articles: [
            {
              source: { id: 'bbc-news', name: 'BBC News' },
              title: 'BBC Article',
              description: 'BBC description',
              url: 'https://bbc.com/article',
              publishedAt: '2024-01-15T11:00:00Z',
              content: 'BBC article content that is long enough to be valid.',
            },
          ],
        },
      };

      mockAxiosInstance.get
        .mockResolvedValueOnce(cnnResponse)
        .mockResolvedValueOnce(bbcResponse);

      const articles = await client.fetchFromMultipleSources(['cnn', 'bbc-news'], {
        articlesPerSource: 5,
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
      expect(articles).toHaveLength(2);
      
      // Should be sorted by publication date (newest first)
      expect(articles[0].headline).toBe('BBC Article');
      expect(articles[1].headline).toBe('CNN Article');
    });

    it('should continue with other sources if one fails', async () => {
      const successResponse = {
        data: {
          status: 'ok',
          totalResults: 1,
          articles: [
            {
              source: { id: 'bbc-news', name: 'BBC News' },
              title: 'BBC Article',
              description: 'BBC description',
              url: 'https://bbc.com/article',
              publishedAt: '2024-01-15T10:00:00Z',
              content: 'BBC article content that is long enough to be valid.',
            },
          ],
        },
      };

      mockAxiosInstance.get
        .mockRejectedValueOnce(new Error('CNN failed'))
        .mockResolvedValueOnce(successResponse);

      const articles = await client.fetchFromMultipleSources(['cnn', 'bbc-news']);

      expect(articles).toHaveLength(1);
      expect(articles[0].headline).toBe('BBC Article');
    });
  });

  describe('category inference', () => {
    it('should infer correct categories for different sources', async () => {
      const mockResponse = {
        data: {
          status: 'ok',
          totalResults: 1,
          articles: [
            {
              source: { id: 'techcrunch', name: 'TechCrunch' },
              title: 'Tech Article',
              description: 'Tech description',
              url: 'https://techcrunch.com/article',
              publishedAt: '2024-01-15T10:00:00Z',
              content: 'Technology article content that is long enough to be valid.',
            },
          ],
        },
      };

      mockAxiosInstance.get.mockResolvedValueOnce(mockResponse);

      const articles = await client.fetchFromSource('techcrunch');

      expect(articles[0].category).toBe('technology');
    });
  });

  describe('tag extraction', () => {
    it('should extract relevant tags from title and description', async () => {
      const mockResponse = {
        data: {
          status: 'ok',
          totalResults: 1,
          articles: [
            {
              source: { id: 'cnn', name: 'CNN' },
              title: 'AI Technology Breakthrough in Healthcare Research',
              description: 'Scientists use artificial intelligence to advance medical research',
              url: 'https://cnn.com/ai-health',
              publishedAt: '2024-01-15T10:00:00Z',
              content: 'Detailed content about AI in healthcare research and medical applications.',
            },
          ],
        },
      };

      mockAxiosInstance.get.mockResolvedValueOnce(mockResponse);

      const articles = await client.fetchFromSource('cnn');

      expect(articles[0].tags).toContain('ai');
      expect(articles[0].tags).toContain('artificial intelligence');
      expect(articles[0].tags).toContain('technology');
      expect(articles[0].tags).toContain('health');
      expect(articles[0].tags).toContain('medical');
      expect(articles[0].tags).toContain('research');
    });
  });
});