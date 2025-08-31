/**
 * Enhanced Free News Collector
 * Integrates NewsData.io API (primary), GNews API (fallback), Puppeteer scraper, and Hugging Face
 */

import { NewsArticle } from '@/types';
import { NewsDataClient } from './newsdata-client';
import { getGNewsClient } from './gnews-client';
import { getScraper } from './puppeteer-scraper';
import { getHuggingFaceClient } from '../llm/huggingface-client';
import { getLogger } from '../monitoring/production-logger';
import { getCache, CacheKeys } from '../cache';
import { config } from '@/lib/config';

export interface NewsCollectionConfig {
  maxArticles: number;
  enableScraping: boolean;
  enableSummarization: boolean;
  categories: string[];
  sources: string[];
  useRealTime: boolean;
}

export interface CollectionResult {
  articles: NewsArticle[];
  totalCollected: number;
  errors: string[];
  apiUsage: {
    newsdata: number;
    gnews: number;
    huggingface: number;
    scraping: number;
  };
}

export class FreeNewsCollector {
  private logger = getLogger();
  private cache = getCache();
  private newsDataClient: NewsDataClient;
  
  constructor(private collectionConfig: NewsCollectionConfig) {
    this.newsDataClient = new NewsDataClient(config.newsdata.apiKey);
  }

  /**
   * Collect news from all free sources with NewsData.io as primary
   */
  async collectNews(): Promise<CollectionResult> {
    const startTime = Date.now();
    const requestId = `collect_${Date.now()}`;
    
    this.logger.info('Starting enhanced news collection with NewsData.io', {
      config: this.collectionConfig
    }, requestId);

    const result: CollectionResult = {
      articles: [],
      totalCollected: 0,
      errors: [],
      apiUsage: {
        newsdata: 0,
        gnews: 0,
        huggingface: 0,
        scraping: 0
      }
    };

    try {
      // Step 1: Collect articles from NewsData.io (primary)
      const newsDataArticles = await this.collectFromNewsData(requestId);
      result.articles.push(...newsDataArticles);
      result.apiUsage.newsdata = newsDataArticles.length;

      // Step 2: Fallback to GNews if NewsData.io didn't provide enough articles
      if (result.articles.length < this.collectionConfig.maxArticles / 2) {
        const gnewsArticles = await this.collectFromGNews(requestId);
        result.articles.push(...gnewsArticles);
        result.apiUsage.gnews = gnewsArticles.length;
      }

      // Step 3: Enhance articles with scraping if enabled
      if (this.collectionConfig.enableScraping) {
        const enhancedArticles = await this.enhanceWithScraping(
          result.articles.slice(0, 10), // Limit scraping to first 10 articles
          requestId
        );
        result.articles = enhancedArticles;
        result.apiUsage.scraping = enhancedArticles.length;
      }

      // Step 4: Generate summaries if enabled
      if (this.collectionConfig.enableSummarization) {
        const summarizedArticles = await this.generateSummaries(
          result.articles.slice(0, 5), // Limit summarization to first 5 articles
          requestId
        );
        result.articles = [...summarizedArticles, ...result.articles.slice(5)];
        result.apiUsage.huggingface = summarizedArticles.length;
      }

      result.totalCollected = result.articles.length;

      const duration = Date.now() - startTime;
      this.logger.info('Enhanced news collection completed', {
        totalArticles: result.totalCollected,
        duration,
        apiUsage: result.apiUsage
      }, requestId);

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Enhanced news collection failed', error as Error, {
        duration,
        partialResults: result.articles.length
      }, requestId);

      result.errors.push((error as Error).message);
      return result;
    }
  }

  /**
   * Collect articles from NewsData.io API (primary source)
   */
  private async collectFromNewsData(requestId: string): Promise<NewsArticle[]> {
    const cacheKey = CacheKeys.newsCollection('newsdata', 'all');
    const cached = this.cache.get<NewsArticle[]>(cacheKey);
    
    if (cached) {
      this.logger.info('Using cached NewsData.io articles', { count: cached.length }, requestId);
      return cached;
    }

    try {
      const articles: NewsArticle[] = [];

      // Collect from different categories with real-time data
      for (const category of this.collectionConfig.categories) {
        try {
          const response = await this.newsDataClient.getLatestNews({
            category,
            language: 'en',
            size: Math.floor(this.collectionConfig.maxArticles / this.collectionConfig.categories.length),
            full_content: true,
            image: true,
            // timeframe removed for free tier compatibility
          });

          const categoryArticles = response.results.map(article => ({
            id: article.article_id,
            headline: article.title,
            content: article.content || article.description,
            source: article.source_id,
            category: article.category?.[0] || category,
            publishedAt: new Date(article.pubDate),
            url: article.link,
            tags: article.keywords || []
          }));

          articles.push(...categoryArticles);
          
          // Add small delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (error) {
          this.logger.warn(`Failed to collect ${category} articles from NewsData.io`, {
            error: (error as Error).message
          }, requestId);
        }
      }

      // Cache the results (shorter cache for real-time)
      const cacheTime = this.collectionConfig.useRealTime ? 5 * 60 * 1000 : 30 * 60 * 1000; // 5 min vs 30 min
      this.cache.set(cacheKey, articles, cacheTime);

      this.logger.info('Collected articles from NewsData.io', {
        count: articles.length,
        categories: this.collectionConfig.categories,
        realTime: this.collectionConfig.useRealTime
      }, requestId);

      return articles;

    } catch (error) {
      this.logger.error('NewsData.io collection failed', error as Error, {}, requestId);
      return [];
    }
  }

  /**
   * Collect articles from GNews API (fallback)
   */
  private async collectFromGNews(requestId: string): Promise<NewsArticle[]> {
    const cacheKey = CacheKeys.newsCollection('gnews', 'fallback');
    const cached = this.cache.get<NewsArticle[]>(cacheKey);
    
    if (cached) {
      this.logger.info('Using cached GNews fallback articles', { count: cached.length }, requestId);
      return cached;
    }

    try {
      const gnews = getGNewsClient();
      const articles: NewsArticle[] = [];

      // Collect from different categories
      for (const category of this.collectionConfig.categories) {
        try {
          const categoryArticles = await gnews.search({
            q: category,
            max: Math.floor(this.collectionConfig.maxArticles / this.collectionConfig.categories.length / 2), // Half of NewsData.io
            lang: 'en',
            sortby: 'publishedAt'
          });

          articles.push(...categoryArticles);
          
          // Add delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          this.logger.warn(`Failed to collect ${category} articles from GNews fallback`, {
            error: (error as Error).message
          }, requestId);
        }
      }

      // Cache the results
      this.cache.set(cacheKey, articles, 15 * 60 * 1000); // 15 minutes

      this.logger.info('Collected fallback articles from GNews', {
        count: articles.length,
        categories: this.collectionConfig.categories
      }, requestId);

      return articles;

    } catch (error) {
      this.logger.error('GNews fallback collection failed', error as Error, {}, requestId);
      return [];
    }
  }

  /**
   * Get breaking news using NewsData.io real-time capabilities
   */
  async getBreakingNews(limit: number = 20): Promise<NewsArticle[]> {
    const requestId = `breaking_${Date.now()}`;
    
    try {
      const response = await this.newsDataClient.getLatestNews({
        language: 'en',
        size: limit,
        full_content: true,
        image: true,
        // timeframe removed for free tier compatibility
        prioritydomain: 'top'
      });

      const articles = response.results.map(article => ({
        id: article.article_id,
        headline: article.title,
        content: article.content || article.description,
        source: article.source_id,
        category: article.category?.[0] || 'breaking',
        publishedAt: new Date(article.pubDate),
        url: article.link,
        tags: article.keywords || []
      }));

      this.logger.info('Collected breaking news', {
        count: articles.length
      }, requestId);

      return articles;

    } catch (error) {
      this.logger.error('Breaking news collection failed', error as Error, {}, requestId);
      
      // Fallback to GNews for breaking news
      try {
        const gnews = getGNewsClient();
        return await gnews.search({
          q: 'breaking news',
          max: limit,
          lang: 'en',
          sortby: 'publishedAt'
        });
      } catch (fallbackError) {
        this.logger.error('Breaking news fallback failed', fallbackError as Error, {}, requestId);
        return [];
      }
    }
  }

  /**
   * Enhance articles with web scraping
   */
  private async enhanceWithScraping(articles: NewsArticle[], requestId: string): Promise<NewsArticle[]> {
    if (articles.length === 0) return articles;

    try {
      const scraper = getScraper({
        timeout: 15000,
        enableImages: false,
        enableJavaScript: true
      });

      const urls = articles.map(article => article.url);
      const scrapedContent = await scraper.scrapeUrls(urls, 3); // 3 concurrent requests

      const enhancedArticles = articles.map((article, index) => {
        const scraped = scrapedContent[index];
        
        if (scraped && scraped.success && scraped.content.length > article.content.length) {
          return {
            ...article,
            content: scraped.content
          };
        }
        
        return article;
      });

      this.logger.info('Enhanced articles with scraping', {
        total: articles.length,
        enhanced: enhancedArticles.filter((_, i) => scrapedContent[i]?.success).length
      }, requestId);

      return enhancedArticles;

    } catch (error) {
      this.logger.error('Article enhancement failed', error as Error, {}, requestId);
      return articles;
    }
  }

  /**
   * Generate summaries using Hugging Face
   */
  private async generateSummaries(articles: NewsArticle[], requestId: string): Promise<NewsArticle[]> {
    if (articles.length === 0) return articles;

    try {
      const hf = getHuggingFaceClient();
      const summarizedArticles: NewsArticle[] = [];

      for (const article of articles) {
        try {
          const cacheKey = CacheKeys.articleSummary(article.id, 'casual', 150);
          const cachedSummary = this.cache.get<string>(cacheKey);

          let summary: string;
          if (cachedSummary) {
            summary = cachedSummary;
          } else {
            summary = await hf.generateArticleSummary(
              article.content,
              'casual',
              150
            );
            
            // Cache the summary
            this.cache.set(cacheKey, summary, 60 * 60 * 1000); // 1 hour
          }

          summarizedArticles.push({
            ...article,
            content: summary || article.content
          });

          // Add delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (error) {
          this.logger.warn(`Failed to summarize article: ${article.headline}`, {
            error: (error as Error).message
          }, requestId);
          
          // Keep original article if summarization fails
          summarizedArticles.push(article);
        }
      }

      this.logger.info('Generated summaries with Hugging Face', {
        total: articles.length,
        summarized: summarizedArticles.length
      }, requestId);

      return summarizedArticles;

    } catch (error) {
      this.logger.error('Summary generation failed', error as Error, {}, requestId);
      return articles;
    }
  }

  /**
   * Get collection statistics
   */
  async getStats(): Promise<{
    newsdataRemaining: number;
    gnewsRemaining: number;
    cacheHitRate: number;
    lastCollection: Date | null;
  }> {
    try {
      const gnews = getGNewsClient();
      const cacheStats = this.cache.getStats();
      
      return {
        newsdataRemaining: 200, // NewsData.io free tier limit
        gnewsRemaining: gnews.getRemainingRequests(),
        cacheHitRate: cacheStats.totalEntries > 0 ? 
          (cacheStats.totalEntries - cacheStats.expiredEntries) / cacheStats.totalEntries : 0,
        lastCollection: null // Could be stored in cache/database
      };
    } catch (error) {
      return {
        newsdataRemaining: 0,
        gnewsRemaining: 0,
        cacheHitRate: 0,
        lastCollection: null
      };
    }
  }
}

// Enhanced default configuration with NewsData.io - DIVERSE CATEGORIES
export const DEFAULT_COLLECTION_CONFIG: NewsCollectionConfig = {
  maxArticles: 30, // Increased due to better API
  enableScraping: true,
  enableSummarization: true,
  categories: [
    'top',          // General/Top news (NewsData.io equivalent of 'general')
    'technology',   // Tech news
    'business',     // Business & finance
    'science',      // Science & research
    'health',       // Health & medicine
    'sports',       // Sports news
    'entertainment',// Entertainment & celebrity
    'politics',     // Political news
    'world',        // International news
    'environment'   // Environmental news
  ],
  sources: ['newsdata', 'gnews', 'scraping'],
  useRealTime: true // Enable real-time news
};

// Global collector instance
let defaultCollector: FreeNewsCollector | null = null;

/**
 * Get or create default news collector
 */
export function getFreeNewsCollector(config?: Partial<NewsCollectionConfig>): FreeNewsCollector {
  if (!defaultCollector) {
    defaultCollector = new FreeNewsCollector({
      ...DEFAULT_COLLECTION_CONFIG,
      ...config
    });
  }
  return defaultCollector;
}

/**
 * Collect news (convenience function)
 */
export async function collectFreeNews(config?: Partial<NewsCollectionConfig>): Promise<CollectionResult> {
  const collector = getFreeNewsCollector(config);
  return collector.collectNews();
}

/**
 * Get breaking news (convenience function)
 */
export async function getBreakingNews(limit: number = 20): Promise<NewsArticle[]> {
  const collector = getFreeNewsCollector();
  return collector.getBreakingNews(limit);
}