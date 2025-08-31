import { Article } from '@/types';
import { NewsDataClient } from './newsdata-client';
import { config } from '@/lib/config';

export class EnhancedNewsCollector {
  private newsDataClient: NewsDataClient;

  constructor() {
    this.newsDataClient = new NewsDataClient(config.newsdata.apiKey);
  }

  async getBreakingNews(limit: number = 20): Promise<Article[]> {
    try {
      // NewsData.io for real-time breaking news
      return await this.newsDataClient.getBreakingNews(limit);
    } catch (error) {
      console.error('NewsData.io breaking news failed:', error);
      return [];
    }
  }

  async getTrendingNews(limit: number = 15): Promise<Article[]> {
    try {
      // NewsData.io for trending with sentiment analysis
      return await this.newsDataClient.getTrendingNews(limit);
    } catch (error) {
      console.error('NewsData.io trending news failed:', error);
      return [];
    }
  }

  async getNewsByCategory(category: string, limit: number = 10): Promise<Article[]> {
    try {
      // NewsData.io with better categorization
      return await this.newsDataClient.getNewsByCategory(category, limit);
    } catch (error) {
      console.error(`NewsData.io ${category} news failed:`, error);
      return [];
    }
  }

  async searchNews(query: string, limit: number = 10): Promise<Article[]> {
    try {
      // NewsData.io with advanced search capabilities
      return await this.newsDataClient.searchNews(query, limit);
    } catch (error) {
      console.error(`NewsData.io search for "${query}" failed:`, error);
      return [];
    }
  }

  async getCryptoNews(limit: number = 10): Promise<Article[]> {
    try {
      // NewsData.io has dedicated crypto endpoint
      const response = await this.newsDataClient.getCryptoNews({
        language: 'en',
        size: limit,
        full_content: true,
        image: true,
        timeframe: '24'
      });

      return response.results.map(article => this.newsDataClient.convertToArticle(article));
    } catch (error) {
      console.warn('NewsData.io crypto news failed, falling back to search:', error);
      
      try {
        // Fallback to crypto search
        return await this.searchNews('cryptocurrency bitcoin ethereum', limit);
      } catch (fallbackError) {
        console.error('All crypto news sources failed:', fallbackError);
        return [];
      }
    }
  }

  async getPersonalizedNews(preferences: {
    topics: string[];
    preferredSources?: string[];
    excludedSources?: string[];
    sentiment?: string;
  }, limit: number = 20): Promise<Article[]> {
    const allArticles: Article[] = [];

    // Collect articles from each preferred topic
    for (const topic of preferences.topics) {
      try {
        const topicArticles = await this.getNewsByCategory(topic, Math.ceil(limit / preferences.topics.length));
        allArticles.push(...topicArticles);
      } catch (error) {
        console.warn(`Failed to get articles for topic ${topic}:`, error);
      }
    }

    // Filter by preferred/excluded sources if specified
    let filteredArticles = allArticles;
    
    if (preferences.preferredSources && preferences.preferredSources.length > 0) {
      filteredArticles = filteredArticles.filter(article => 
        preferences.preferredSources!.some(source => 
          article.source.name.toLowerCase().includes(source.toLowerCase()) ||
          article.source.id?.toLowerCase().includes(source.toLowerCase())
        )
      );
    }

    if (preferences.excludedSources && preferences.excludedSources.length > 0) {
      filteredArticles = filteredArticles.filter(article => 
        !preferences.excludedSources!.some(source => 
          article.source.name.toLowerCase().includes(source.toLowerCase()) ||
          article.source.id?.toLowerCase().includes(source.toLowerCase())
        )
      );
    }

    // Filter by sentiment if specified
    if (preferences.sentiment) {
      filteredArticles = filteredArticles.filter(article => 
        article.sentiment === preferences.sentiment
      );
    }

    // Remove duplicates and sort by priority/recency
    const uniqueArticles = this.removeDuplicates(filteredArticles);
    return this.sortByRelevance(uniqueArticles).slice(0, limit);
  }

  async getMultiSourceNews(categories: string[], limit: number = 30): Promise<Article[]> {
    const allArticles: Article[] = [];
    const articlesPerCategory = Math.ceil(limit / categories.length);

    // Collect from NewsData.io in parallel
    const promises = categories.map(async (category) => {
      try {
        return await this.newsDataClient.getNewsByCategory(category, articlesPerCategory);
      } catch (error) {
        console.warn(`Failed to get ${category} articles:`, error);
        return [];
      }
    });

    const results = await Promise.allSettled(promises);
    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        allArticles.push(...result.value);
      }
    });

    return this.removeDuplicates(allArticles).slice(0, limit);
  }

  private removeDuplicates(articles: Article[]): Article[] {
    const seen = new Set<string>();
    return articles.filter(article => {
      const key = article.title.toLowerCase().trim();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private sortByRelevance(articles: Article[]): Article[] {
    return articles.sort((a, b) => {
      // Sort by priority first (if available)
      if (a.priority !== undefined && b.priority !== undefined) {
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
      }
      
      // Then by recency
      const dateA = new Date(a.publishedAt).getTime();
      const dateB = new Date(b.publishedAt).getTime();
      return dateB - dateA;
    });
  }

  async getHealthStatus(): Promise<{
    newsdata: boolean;
    overall: boolean;
  }> {
    const status = {
      newsdata: false,
      overall: false
    };

    // Test NewsData.io
    try {
      await this.newsDataClient.getLatestNews({ size: 1 });
      status.newsdata = true;
      status.overall = true;
    } catch (error) {
      console.warn('NewsData.io health check failed:', error);
    }

    return status;
  }
}