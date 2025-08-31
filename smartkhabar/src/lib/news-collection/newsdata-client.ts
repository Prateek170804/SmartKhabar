import { Article } from '@/types';

export interface NewsDataArticle {
  article_id: string;
  title: string;
  link: string;
  keywords?: string[];
  creator?: string[];
  video_url?: string;
  description: string;
  content: string;
  pubDate: string;
  image_url?: string;
  source_id: string;
  source_priority: number;
  source_url: string;
  source_icon?: string;
  language: string;
  country: string[];
  category: string[];
  ai_tag?: string;
  sentiment?: string;
  sentiment_stats?: string;
  ai_region?: string;
  ai_org?: string;
  duplicate?: boolean;
}

export interface NewsDataResponse {
  status: string;
  totalResults: number;
  results: NewsDataArticle[];
  nextPage?: string;
}

export class NewsDataClient {
  private apiKey: string;
  private baseUrl = 'https://newsdata.io/api/1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async getLatestNews(options: {
    category?: string;
    country?: string;
    language?: string;
    q?: string;
    qInTitle?: string;
    qInMeta?: string;
    domain?: string;
    domainurl?: string;
    excludedomain?: string;
    timeframe?: string;
    from_date?: string;
    to_date?: string;
    size?: number;
    page?: string;
    full_content?: boolean;
    image?: boolean;
    video?: boolean;
    prioritydomain?: string;
    excludecategory?: string;
    sentiment?: string;
    ai_tag?: string;
  } = {}): Promise<NewsDataResponse> {
    const params = new URLSearchParams({
      apikey: this.apiKey,
      ...Object.fromEntries(
        Object.entries(options).map(([key, value]) => [
          key,
          typeof value === 'boolean' ? (value ? '1' : '0') : String(value)
        ])
      )
    });

    const response = await fetch(`${this.baseUrl}/news?${params}`);
    
    if (!response.ok) {
      throw new Error(`NewsData API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getArchiveNews(options: {
    q?: string;
    qInTitle?: string;
    qInMeta?: string;
    category?: string;
    country?: string;
    language?: string;
    domain?: string;
    domainurl?: string;
    excludedomain?: string;
    from_date: string;
    to_date: string;
    size?: number;
    page?: string;
    full_content?: boolean;
    image?: boolean;
    video?: boolean;
    prioritydomain?: string;
    excludecategory?: string;
    sentiment?: string;
    ai_tag?: string;
  }): Promise<NewsDataResponse> {
    const params = new URLSearchParams({
      apikey: this.apiKey,
      ...Object.fromEntries(
        Object.entries(options).map(([key, value]) => [
          key,
          typeof value === 'boolean' ? (value ? '1' : '0') : String(value)
        ])
      )
    });

    const response = await fetch(`${this.baseUrl}/archive?${params}`);
    
    if (!response.ok) {
      throw new Error(`NewsData Archive API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getCryptoNews(options: {
    q?: string;
    qInTitle?: string;
    qInMeta?: string;
    country?: string;
    language?: string;
    domain?: string;
    domainurl?: string;
    excludedomain?: string;
    timeframe?: string;
    from_date?: string;
    to_date?: string;
    size?: number;
    page?: string;
    full_content?: boolean;
    image?: boolean;
    video?: boolean;
    prioritydomain?: string;
    sentiment?: string;
    ai_tag?: string;
  } = {}): Promise<NewsDataResponse> {
    const params = new URLSearchParams({
      apikey: this.apiKey,
      ...Object.fromEntries(
        Object.entries(options).map(([key, value]) => [
          key,
          typeof value === 'boolean' ? (value ? '1' : '0') : String(value)
        ])
      )
    });

    const response = await fetch(`${this.baseUrl}/crypto?${params}`);
    
    if (!response.ok) {
      throw new Error(`NewsData Crypto API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  convertToArticle(newsDataArticle: NewsDataArticle): Article {
    return {
      id: newsDataArticle.article_id,
      title: newsDataArticle.title,
      description: newsDataArticle.description,
      content: newsDataArticle.content || newsDataArticle.description,
      url: newsDataArticle.link,
      urlToImage: newsDataArticle.image_url || null,
      publishedAt: newsDataArticle.pubDate,
      source: {
        id: newsDataArticle.source_id,
        name: newsDataArticle.source_id,
        url: newsDataArticle.source_url,
        icon: newsDataArticle.source_icon
      },
      author: newsDataArticle.creator?.[0] || null,
      category: newsDataArticle.category?.[0] || 'general',
      language: newsDataArticle.language,
      country: newsDataArticle.country?.[0] || 'us',
      keywords: newsDataArticle.keywords || [],
      sentiment: newsDataArticle.sentiment || null,
      aiTag: newsDataArticle.ai_tag || null,
      videoUrl: newsDataArticle.video_url || null,
      priority: newsDataArticle.source_priority || 0
    };
  }

  async getNewsByCategory(category: string, limit: number = 10): Promise<Article[]> {
    try {
      const response = await this.getLatestNews({
        category,
        language: 'en',
        size: limit,
        full_content: true,
        image: true
      });

      return response.results.map(article => this.convertToArticle(article));
    } catch (error) {
      console.error(`Error fetching ${category} news:`, error);
      return [];
    }
  }

  async searchNews(query: string, limit: number = 10): Promise<Article[]> {
    try {
      const response = await this.getLatestNews({
        q: query,
        language: 'en',
        size: limit,
        full_content: true,
        image: true
      });

      return response.results.map(article => this.convertToArticle(article));
    } catch (error) {
      console.error(`Error searching news for "${query}":`, error);
      return [];
    }
  }

  async getBreakingNews(limit: number = 20): Promise<Article[]> {
    try {
      const response = await this.getLatestNews({
        language: 'en',
        size: limit,
        full_content: true,
        image: true,
        prioritydomain: 'top'
      });

      return response.results.map(article => this.convertToArticle(article));
    } catch (error) {
      console.error('Error fetching breaking news:', error);
      return [];
    }
  }

  async getTrendingNews(limit: number = 15): Promise<Article[]> {
    try {
      const response = await this.getLatestNews({
        language: 'en',
        size: limit,
        full_content: true,
        image: true,
        sentiment: 'positive'
      });

      return response.results.map(article => this.convertToArticle(article));
    } catch (error) {
      console.error('Error fetching trending news:', error);
      return [];
    }
  }
}