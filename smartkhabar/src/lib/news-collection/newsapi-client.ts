import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { NewsArticle } from '@/types';
import { config } from '@/lib/config';

// NewsAPI response interfaces
interface NewsAPIArticle {
  source: {
    id: string | null;
    name: string;
  };
  author: string | null;
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  content: string | null;
}

interface NewsAPIResponse {
  status: string;
  totalResults: number;
  articles: NewsAPIArticle[];
}

interface NewsAPIError {
  status: string;
  code: string;
  message: string;
}

export interface NewsAPIClientOptions {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export class NewsAPIClient {
  private client: AxiosInstance;
  private retryAttempts: number;
  private retryDelay: number;
  private lastRequestTime: number = 0;
  private readonly rateLimitDelay = 1000; // 1 second between requests

  constructor(options: NewsAPIClientOptions) {
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelay = options.retryDelay || 1000;

    this.client = axios.create({
      baseURL: options.baseUrl || config.newsApi.baseUrl,
      timeout: options.timeout || 10000,
      headers: {
        'X-API-Key': options.apiKey,
        'User-Agent': 'SmartKhabar/1.0',
      },
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.data?.code && error.response?.data?.message) {
          const apiError: NewsAPIError = error.response.data;
          throw new Error(`NewsAPI Error [${apiError.code}]: ${apiError.message}`);
        }
        throw error;
      }
    );
  }

  /**
   * Enforce rate limiting between requests
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.rateLimitDelay) {
      const delay = this.rateLimitDelay - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Retry mechanism with exponential backoff
   */
  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        await this.enforceRateLimit();
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on client errors (4xx)
        if (axios.isAxiosError(error) && error.response?.status && error.response.status < 500) {
          throw error;
        }

        if (attempt < this.retryAttempts) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError!;
  }

  /**
   * Convert NewsAPI article to our NewsArticle format
   */
  private convertToNewsArticle(apiArticle: NewsAPIArticle, source: string): NewsArticle {
    const id = this.generateArticleId(apiArticle.url, apiArticle.publishedAt);
    
    return {
      id,
      headline: apiArticle.title,
      content: apiArticle.content || apiArticle.description || '',
      source: source,
      category: this.inferCategory(source),
      publishedAt: new Date(apiArticle.publishedAt),
      url: apiArticle.url,
      tags: this.extractTags(apiArticle.title, apiArticle.description),
    };
  }

  /**
   * Generate unique article ID from URL and timestamp
   */
  private generateArticleId(url: string, publishedAt: string): string {
    const urlHash = Buffer.from(url).toString('base64').slice(0, 8);
    const timestamp = new Date(publishedAt).getTime();
    return `${urlHash}-${timestamp}`;
  }

  /**
   * Infer category from source
   */
  private inferCategory(source: string): string {
    const categoryMap: Record<string, string> = {
      'cnn': 'general',
      'bbc-news': 'general',
      'techcrunch': 'technology',
    };
    
    return categoryMap[source] || 'general';
  }

  /**
   * Extract tags from title and description
   */
  private extractTags(title: string, description: string | null): string[] {
    const text = `${title} ${description || ''}`.toLowerCase();
    const tags: string[] = [];
    
    // Simple keyword extraction
    const keywords = [
      'technology', 'tech', 'ai', 'artificial intelligence',
      'business', 'finance', 'economy', 'market',
      'politics', 'government', 'election',
      'health', 'medical', 'covid',
      'science', 'research', 'study',
      'sports', 'football', 'basketball',
      'entertainment', 'movie', 'music',
    ];
    
    keywords.forEach(keyword => {
      if (text.includes(keyword)) {
        tags.push(keyword);
      }
    });
    
    return [...new Set(tags)]; // Remove duplicates
  }

  /**
   * Fetch articles from a specific source
   */
  async fetchFromSource(source: string, options: {
    pageSize?: number;
    page?: number;
    from?: string;
    to?: string;
  } = {}): Promise<NewsArticle[]> {
    const params = {
      sources: source,
      pageSize: options.pageSize || 20,
      page: options.page || 1,
      sortBy: 'publishedAt',
      ...(options.from && { from: options.from }),
      ...(options.to && { to: options.to }),
    };

    const response = await this.withRetry(async () => {
      return this.client.get<NewsAPIResponse>('/everything', { params });
    });

    if (response?.data?.status !== 'ok') {
      throw new Error(`NewsAPI request failed: ${response?.data?.status || 'unknown error'}`);
    }

    return response.data.articles
      .filter(article => article.content && article.title && article.url)
      .map(article => this.convertToNewsArticle(article, source));
  }

  /**
   * Fetch top headlines from a specific source
   */
  async fetchTopHeadlines(source: string, options: {
    pageSize?: number;
    page?: number;
  } = {}): Promise<NewsArticle[]> {
    const params = {
      sources: source,
      pageSize: options.pageSize || 20,
      page: options.page || 1,
    };

    const response = await this.withRetry(async () => {
      return this.client.get<NewsAPIResponse>('/top-headlines', { params });
    });

    if (response?.data?.status !== 'ok') {
      throw new Error(`NewsAPI request failed: ${response?.data?.status || 'unknown error'}`);
    }

    return response.data.articles
      .filter(article => article.content && article.title && article.url)
      .map(article => this.convertToNewsArticle(article, source));
  }

  /**
   * Fetch articles from multiple sources
   */
  async fetchFromMultipleSources(sources: string[], options: {
    pageSize?: number;
    articlesPerSource?: number;
    timeRange?: { from: string; to: string };
  } = {}): Promise<NewsArticle[]> {
    const articlesPerSource = options.articlesPerSource || 10;
    const allArticles: NewsArticle[] = [];

    // Process sources sequentially to respect rate limits
    for (const source of sources) {
      try {
        const articles = await this.fetchFromSource(source, {
          pageSize: articlesPerSource,
          page: 1,
          ...options.timeRange,
        });
        
        allArticles.push(...articles);
      } catch (error) {
        console.error(`Failed to fetch from source ${source}:`, error);
        // Continue with other sources even if one fails
      }
    }

    // Sort by publication date (newest first)
    return allArticles.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
  }

  /**
   * Get available sources
   */
  async getAvailableSources(): Promise<Array<{ id: string; name: string; category: string }>> {
    const response = await this.withRetry(async () => {
      return this.client.get('/sources');
    });

    return response.data.sources.map((source: any) => ({
      id: source.id,
      name: source.name,
      category: source.category,
    }));
  }
}

// Factory function to create NewsAPI client
export function createNewsAPIClient(): NewsAPIClient {
  if (!config.newsApi.key) {
    throw new Error('NEWS_API_KEY environment variable is required');
  }

  return new NewsAPIClient({
    apiKey: config.newsApi.key,
    baseUrl: config.newsApi.baseUrl,
    timeout: 10000,
    retryAttempts: 3,
    retryDelay: 1000,
  });
}