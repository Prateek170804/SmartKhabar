import { NewsArticle } from '@/types';
import { NewsAPIClient, createNewsAPIClient } from './newsapi-client';
import { FirecrawlClient, createFirecrawlClient } from './firecrawl-client';
import { config } from '@/lib/config';

export interface NewsCollectionOptions {
  sources?: string[];
  articlesPerSource?: number;
  timeRange?: {
    from: Date;
    to: Date;
  };
  includeTopHeadlines?: boolean;
}

export interface NewsCollectionResult {
  articles: NewsArticle[];
  errors: Array<{
    source: string;
    error: string;
  }>;
  metadata: {
    totalArticles: number;
    sourcesProcessed: number;
    sourcesWithErrors: number;
    collectionTime: number; // milliseconds
  };
}

export class NewsCollector {
  private newsApiClient: NewsAPIClient;
  private firecrawlClient: FirecrawlClient | null;
  private defaultSources: string[];

  constructor() {
    this.newsApiClient = createNewsAPIClient();
    
    // Initialize Firecrawl client if API key is available
    try {
      this.firecrawlClient = createFirecrawlClient();
    } catch (error) {
      console.warn('Firecrawl client not initialized:', error);
      this.firecrawlClient = null;
    }
    
    this.defaultSources = [
      config.newsSources.cnn,
      config.newsSources.bbc,
      config.newsSources.techcrunch,
    ];
  }

  /**
   * Collect articles from NewsAPI sources
   */
  async collectFromAPI(options: NewsCollectionOptions = {}): Promise<NewsCollectionResult> {
    const startTime = Date.now();
    const sources = options.sources || this.defaultSources;
    const articlesPerSource = options.articlesPerSource || 10;
    const errors: Array<{ source: string; error: string }> = [];
    let allArticles: NewsArticle[] = [];

    // Convert date range to ISO strings if provided
    const timeRange = options.timeRange ? {
      from: options.timeRange.from.toISOString(),
      to: options.timeRange.to.toISOString(),
    } : undefined;

    // Collect from each source
    for (const source of sources) {
      try {
        let articles: NewsArticle[] = [];

        if (options.includeTopHeadlines) {
          // Fetch top headlines
          const headlines = await this.newsApiClient.fetchTopHeadlines(source, {
            pageSize: Math.ceil(articlesPerSource / 2),
          });
          articles.push(...headlines);
        }

        // Fetch regular articles
        const regularArticles = await this.newsApiClient.fetchFromSource(source, {
          pageSize: articlesPerSource - articles.length,
          ...timeRange,
        });
        articles.push(...regularArticles);

        // Remove duplicates based on URL
        articles = this.removeDuplicates(articles);
        allArticles.push(...articles);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push({
          source,
          error: errorMessage,
        });
        console.error(`Failed to collect from source ${source}:`, error);
      }
    }

    // Remove duplicates across all sources
    allArticles = this.removeDuplicates(allArticles);

    // Sort by publication date (newest first)
    allArticles.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

    const collectionTime = Date.now() - startTime;

    return {
      articles: allArticles,
      errors,
      metadata: {
        totalArticles: allArticles.length,
        sourcesProcessed: sources.length,
        sourcesWithErrors: errors.length,
        collectionTime,
      },
    };
  }

  /**
   * Collect articles from a specific source
   */
  async collectFromSource(source: string, options: {
    articlesCount?: number;
    timeRange?: { from: Date; to: Date };
    includeTopHeadlines?: boolean;
  } = {}): Promise<NewsArticle[]> {
    const result = await this.collectFromAPI({
      sources: [source],
      articlesPerSource: options.articlesCount || 20,
      timeRange: options.timeRange,
      includeTopHeadlines: options.includeTopHeadlines,
    });

    if (result.errors.length > 0) {
      throw new Error(`Failed to collect from ${source}: ${result.errors[0].error}`);
    }

    return result.articles;
  }

  /**
   * Get fresh articles from the last 24 hours
   */
  async collectFreshArticles(options: {
    sources?: string[];
    articlesPerSource?: number;
  } = {}): Promise<NewsCollectionResult> {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    return this.collectFromAPI({
      ...options,
      timeRange: {
        from: yesterday,
        to: now,
      },
      includeTopHeadlines: true,
    });
  }

  /**
   * Scrape articles from custom sources using Firecrawl
   */
  async scrapeCustomSource(url: string, options: {
    limit?: number;
    timeout?: number;
  } = {}): Promise<NewsArticle[]> {
    if (!this.firecrawlClient) {
      throw new Error('Firecrawl client not available. Please configure FIRECRAWL_API_KEY.');
    }

    try {
      if (url.includes('news.ycombinator.com')) {
        return await this.firecrawlClient.scrapeHackerNews({
          limit: options.limit || 20,
        });
      } else {
        // For other URLs, try to scrape the single page
        const scrapedContent = await this.firecrawlClient.scrapeUrl(url, {
          includeMarkdown: true,
          onlyMainContent: true,
          timeout: options.timeout,
        });

        if (scrapedContent.content.length < 100) {
          return [];
        }

        const article: NewsArticle = {
          id: `scraped-${Buffer.from(url).toString('base64').slice(0, 8)}-${Date.now()}`,
          headline: scrapedContent.title || 'Scraped Article',
          content: scrapedContent.content,
          source: 'custom-scrape',
          category: 'general',
          publishedAt: scrapedContent.publishedTime ? new Date(scrapedContent.publishedTime) : new Date(),
          url,
          tags: ['scraped'],
        };

        return [article];
      }
    } catch (error) {
      console.error(`Failed to scrape ${url}:`, error);
      throw new Error(`Scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Collect articles from both API and custom scraping sources
   */
  async collectFromAllSources(options: NewsCollectionOptions & {
    includeHackerNews?: boolean;
    customUrls?: string[];
  } = {}): Promise<NewsCollectionResult> {
    const startTime = Date.now();
    const errors: Array<{ source: string; error: string }> = [];
    let allArticles: NewsArticle[] = [];

    // Collect from NewsAPI sources
    try {
      const apiResult = await this.collectFromAPI(options);
      allArticles.push(...apiResult.articles);
      errors.push(...apiResult.errors);
    } catch (error) {
      errors.push({
        source: 'newsapi',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Collect from Hacker News if requested
    if (options.includeHackerNews && this.firecrawlClient) {
      try {
        const hackerNewsArticles = await this.scrapeCustomSource(config.newsSources.hackerNews, {
          limit: 10,
        });
        allArticles.push(...hackerNewsArticles);
      } catch (error) {
        errors.push({
          source: 'hacker-news',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Collect from custom URLs if provided
    if (options.customUrls && options.customUrls.length > 0 && this.firecrawlClient) {
      for (const url of options.customUrls) {
        try {
          const customArticles = await this.scrapeCustomSource(url);
          allArticles.push(...customArticles);
        } catch (error) {
          errors.push({
            source: url,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    // Remove duplicates and sort
    allArticles = this.removeDuplicates(allArticles);
    allArticles.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

    const collectionTime = Date.now() - startTime;
    const totalSources = (options.sources?.length || this.defaultSources.length) + 
                        (options.includeHackerNews ? 1 : 0) + 
                        (options.customUrls?.length || 0);

    return {
      articles: allArticles,
      errors,
      metadata: {
        totalArticles: allArticles.length,
        sourcesProcessed: totalSources,
        sourcesWithErrors: errors.length,
        collectionTime,
      },
    };
  }

  /**
   * Get available news sources
   */
  async getAvailableSources(): Promise<Array<{ id: string; name: string; category: string; isActive: boolean }>> {
    try {
      const sources = await this.newsApiClient.getAvailableSources();
      
      const allSources = sources.map(source => ({
        ...source,
        isActive: this.defaultSources.includes(source.id),
      }));

      // Add Hacker News if Firecrawl is available
      if (this.firecrawlClient) {
        allSources.push({
          id: 'hacker-news',
          name: 'Hacker News',
          category: 'technology',
          isActive: false,
        });
      }

      return allSources;
    } catch (error) {
      console.error('Failed to fetch available sources:', error);
      return [];
    }
  }

  /**
   * Remove duplicate articles based on URL
   */
  private removeDuplicates(articles: NewsArticle[]): NewsArticle[] {
    const seen = new Set<string>();
    return articles.filter(article => {
      if (seen.has(article.url)) {
        return false;
      }
      seen.add(article.url);
      return true;
    });
  }

  /**
   * Validate article content quality
   */
  private isValidArticle(article: NewsArticle): boolean {
    // Check minimum content length
    if (article.content.length < 100) {
      return false;
    }

    // Check for common invalid content patterns
    const invalidPatterns = [
      /^\[Removed\]/i,
      /^This content is not available/i,
      /^Sign up for our newsletter/i,
      /^Subscribe to continue reading/i,
    ];

    return !invalidPatterns.some(pattern => pattern.test(article.content));
  }

  /**
   * Filter articles by quality and relevance
   */
  filterArticles(articles: NewsArticle[], options: {
    minContentLength?: number;
    excludePatterns?: RegExp[];
    requiredTags?: string[];
  } = {}): NewsArticle[] {
    const minContentLength = options.minContentLength || 100;
    const excludePatterns = options.excludePatterns || [];
    const requiredTags = options.requiredTags || [];

    return articles.filter(article => {
      // Check minimum content length
      if (article.content.length < minContentLength) {
        return false;
      }

      // Check exclude patterns
      if (excludePatterns.some(pattern => pattern.test(article.content))) {
        return false;
      }

      // Check required tags
      if (requiredTags.length > 0) {
        const hasRequiredTag = requiredTags.some(tag => 
          article.tags.includes(tag)
        );
        if (!hasRequiredTag) {
          return false;
        }
      }

      // General quality check
      return this.isValidArticle(article);
    });
  }
}

// Factory function to create news collector
export function createNewsCollector(): NewsCollector {
  return new NewsCollector();
}