/**
 * GNews API Client
 * Free alternative to NewsAPI with 100 requests/day
 */

import axios, { AxiosInstance } from 'axios';
import { NewsArticle } from '@/types';

export interface GNewsConfig {
  apiKey: string;
  baseUrl: string;
  timeout: number;
  maxRetries: number;
}

export interface GNewsArticle {
  title: string;
  description: string;
  content: string;
  url: string;
  image: string;
  publishedAt: string;
  source: {
    name: string;
    url: string;
  };
}

export interface GNewsResponse {
  totalArticles: number;
  articles: GNewsArticle[];
}

export interface SearchParams {
  q?: string;
  lang?: string;
  country?: string;
  max?: number;
  in?: 'title' | 'description' | 'content';
  nullable?: 'title' | 'description' | 'content' | 'image';
  from?: string;
  to?: string;
  sortby?: 'publishedAt' | 'relevance';
}

export class GNewsClient {
  private client: AxiosInstance;
  private config: GNewsConfig;
  private requestCount: number = 0;
  private dailyLimit: number = 100;

  constructor(config: Partial<GNewsConfig> = {}) {
    this.config = {
      apiKey: process.env.GNEWS_API_KEY || '',
      baseUrl: 'https://gnews.io/api/v4',
      timeout: 10000,
      maxRetries: 3,
      ...config
    };

    if (!this.config.apiKey) {
      throw new Error('GNews API key is required');
    }

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'User-Agent': 'SmartKhabar/1.0'
      }
    });
  }

  /**
   * Search for articles
   */
  async search(params: SearchParams): Promise<NewsArticle[]> {
    if (this.requestCount >= this.dailyLimit) {
      throw new Error('Daily API limit reached (100 requests/day)');
    }

    try {
      const response = await this.client.get<GNewsResponse>('/search', {
        params: {
          ...params,
          token: this.config.apiKey,
          max: Math.min(params.max || 10, 100) // GNews max is 100
        }
      });

      this.requestCount++;
      
      return this.transformArticles(response.data.articles);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`GNews API error: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get top headlines
   */
  async getTopHeadlines(params: Omit<SearchParams, 'q'> = {}): Promise<NewsArticle[]> {
    return this.search({
      ...params,
      sortby: 'publishedAt'
    });
  }

  /**
   * Get articles by category
   */
  async getByCategory(category: string, params: Omit<SearchParams, 'q'> = {}): Promise<NewsArticle[]> {
    return this.search({
      ...params,
      q: category
    });
  }

  /**
   * Get technology news
   */
  async getTechNews(params: Omit<SearchParams, 'q'> = {}): Promise<NewsArticle[]> {
    return this.search({
      ...params,
      q: 'technology OR tech OR AI OR software OR startup',
      max: params.max || 20
    });
  }

  /**
   * Get business news
   */
  async getBusinessNews(params: Omit<SearchParams, 'q'> = {}): Promise<NewsArticle[]> {
    return this.search({
      ...params,
      q: 'business OR finance OR economy OR market',
      max: params.max || 20
    });
  }

  /**
   * Get science news
   */
  async getScienceNews(params: Omit<SearchParams, 'q'> = {}): Promise<NewsArticle[]> {
    return this.search({
      ...params,
      q: 'science OR research OR discovery OR study',
      max: params.max || 20
    });
  }

  /**
   * Transform GNews articles to our Article format
   */
  private transformArticles(gnewsArticles: GNewsArticle[]): NewsArticle[] {
    return gnewsArticles.map(article => ({
      id: this.generateArticleId(article.url),
      headline: article.title,
      content: article.content || article.description,
      source: article.source.name,
      category: this.inferCategory(article.title + ' ' + article.description),
      publishedAt: new Date(article.publishedAt),
      url: article.url,
      tags: []
    }));
  }

  /**
   * Generate unique article ID from URL
   */
  private generateArticleId(url: string): string {
    return Buffer.from(url).toString('base64').slice(0, 16);
  }

  /**
   * Infer category from article content
   */
  private inferCategory(text: string): string {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('tech') || lowerText.includes('ai') || 
        lowerText.includes('software') || lowerText.includes('startup')) {
      return 'technology';
    }
    
    if (lowerText.includes('business') || lowerText.includes('finance') || 
        lowerText.includes('economy') || lowerText.includes('market')) {
      return 'business';
    }
    
    if (lowerText.includes('science') || lowerText.includes('research') || 
        lowerText.includes('study') || lowerText.includes('discovery')) {
      return 'science';
    }
    
    if (lowerText.includes('health') || lowerText.includes('medical') || 
        lowerText.includes('medicine')) {
      return 'health';
    }
    
    if (lowerText.includes('sport') || lowerText.includes('game') || 
        lowerText.includes('match')) {
      return 'sports';
    }
    
    return 'general';
  }

  /**
   * Get current request count
   */
  getRequestCount(): number {
    return this.requestCount;
  }

  /**
   * Get remaining requests for today
   */
  getRemainingRequests(): number {
    return Math.max(0, this.dailyLimit - this.requestCount);
  }

  /**
   * Reset request count (call this daily)
   */
  resetRequestCount(): void {
    this.requestCount = 0;
  }

  /**
   * Check if API is available
   */
  async checkHealth(): Promise<boolean> {
    try {
      await this.search({ q: 'test', max: 1 });
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Default client instance
let defaultClient: GNewsClient | null = null;

/**
 * Get or create default GNews client
 */
export function getGNewsClient(config?: Partial<GNewsConfig>): GNewsClient {
  if (!defaultClient) {
    defaultClient = new GNewsClient(config);
  }
  return defaultClient;
}

/**
 * Search articles (convenience function)
 */
export async function searchArticles(params: SearchParams): Promise<NewsArticle[]> {
  const client = getGNewsClient();
  return client.search(params);
}

/**
 * Get top headlines (convenience function)
 */
export async function getTopHeadlines(params?: Omit<SearchParams, 'q'>): Promise<NewsArticle[]> {
  const client = getGNewsClient();
  return client.getTopHeadlines(params);
}