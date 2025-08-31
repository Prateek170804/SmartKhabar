import axios, { AxiosInstance } from 'axios';
import { NewsArticle } from '@/types';
import { config } from '@/lib/config';

// Firecrawl API interfaces
interface FirecrawlScrapeRequest {
  url: string;
  formats?: string[];
  includeTags?: string[];
  excludeTags?: string[];
  onlyMainContent?: boolean;
  timeout?: number;
}

interface FirecrawlScrapeResponse {
  success: boolean;
  data?: {
    markdown?: string;
    html?: string;
    metadata?: {
      title?: string;
      description?: string;
      language?: string;
      sourceURL?: string;
      publishedTime?: string;
    };
  };
  error?: string;
}

interface FirecrawlCrawlRequest {
  url: string;
  limit?: number;
  scrapeOptions?: {
    formats?: string[];
    includeTags?: string[];
    excludeTags?: string[];
    onlyMainContent?: boolean;
  };
}

interface FirecrawlCrawlResponse {
  success: boolean;
  data?: Array<{
    markdown?: string;
    html?: string;
    metadata?: {
      title?: string;
      description?: string;
      sourceURL?: string;
      publishedTime?: string;
    };
  }>;
  error?: string;
}

export interface FirecrawlClientOptions {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export class FirecrawlClient {
  private client: AxiosInstance;
  private retryAttempts: number;
  private retryDelay: number;
  private lastRequestTime: number = 0;
  private readonly rateLimitDelay = 2000; // 2 seconds between requests
  private requestCount: number = 0;
  private errorCount: number = 0;
  private readonly maxErrorRate = 0.5; // 50% error rate threshold

  constructor(options: FirecrawlClientOptions) {
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelay = options.retryDelay || 1000;

    this.client = axios.create({
      baseURL: options.baseUrl || config.firecrawl.baseUrl,
      timeout: options.timeout || 30000,
      headers: {
        'Authorization': `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.data?.error) {
          throw new Error(`Firecrawl Error: ${error.response.data.error}`);
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
   * Retry mechanism with exponential backoff and circuit breaker
   */
  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    // Circuit breaker: if error rate is too high, fail fast
    if (this.requestCount > 10 && (this.errorCount / this.requestCount) > this.maxErrorRate) {
      throw new Error('Circuit breaker: Too many failures, service may be down');
    }

    let lastError: Error;
    this.requestCount++;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        await this.enforceRateLimit();
        const result = await operation();
        
        // Reset error count on success
        if (this.errorCount > 0) {
          this.errorCount = Math.max(0, this.errorCount - 1);
        }
        
        return result;
      } catch (error) {
        lastError = error as Error;
        this.errorCount++;
        
        // Don't retry on client errors (4xx) or authentication errors
        if (axios.isAxiosError(error) && error.response?.status) {
          const status = error.response.status;
          if (status < 500 || status === 401 || status === 403) {
            throw error;
          }
        }

        // Don't retry on the last attempt
        if (attempt < this.retryAttempts) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms:`, error instanceof Error ? error.message : String(error));
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError!;
  }

  /**
   * Get client health metrics
   */
  getHealthMetrics(): {
    requestCount: number;
    errorCount: number;
    errorRate: number;
    isHealthy: boolean;
  } {
    const errorRate = this.requestCount > 0 ? this.errorCount / this.requestCount : 0;
    return {
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      errorRate,
      isHealthy: errorRate < this.maxErrorRate,
    };
  }

  /**
   * Reset health metrics
   */
  resetHealthMetrics(): void {
    this.requestCount = 0;
    this.errorCount = 0;
  }

  /**
   * Scrape a single URL
   */
  async scrapeUrl(url: string, options: {
    includeMarkdown?: boolean;
    includeHtml?: boolean;
    onlyMainContent?: boolean;
    timeout?: number;
  } = {}): Promise<{
    content: string;
    title?: string;
    description?: string;
    publishedTime?: string;
  }> {
    const request: FirecrawlScrapeRequest = {
      url,
      formats: [],
      onlyMainContent: options.onlyMainContent ?? true,
      timeout: options.timeout || 30000,
    };

    if (options.includeMarkdown) {
      request.formats!.push('markdown');
    }
    if (options.includeHtml) {
      request.formats!.push('html');
    }
    if (request.formats!.length === 0) {
      request.formats!.push('markdown'); // Default to markdown
    }

    const response = await this.withRetry(async () => {
      return this.client.post<FirecrawlScrapeResponse>('/v0/scrape', request);
    });

    if (!response.data.success || !response.data.data) {
      throw new Error(`Failed to scrape ${url}: ${response.data.error || 'Unknown error'}`);
    }

    const data = response.data.data;
    const content = data.markdown || data.html || '';
    
    return {
      content,
      title: data.metadata?.title,
      description: data.metadata?.description,
      publishedTime: data.metadata?.publishedTime,
    };
  }

  /**
   * Crawl multiple URLs from a domain
   */
  async crawlDomain(baseUrl: string, options: {
    limit?: number;
    includeMarkdown?: boolean;
    includeHtml?: boolean;
    onlyMainContent?: boolean;
  } = {}): Promise<Array<{
    url: string;
    content: string;
    title?: string;
    description?: string;
    publishedTime?: string;
  }>> {
    const request: FirecrawlCrawlRequest = {
      url: baseUrl,
      limit: options.limit || 10,
      scrapeOptions: {
        formats: [],
        onlyMainContent: options.onlyMainContent ?? true,
      },
    };

    if (options.includeMarkdown) {
      request.scrapeOptions!.formats!.push('markdown');
    }
    if (options.includeHtml) {
      request.scrapeOptions!.formats!.push('html');
    }
    if (request.scrapeOptions!.formats!.length === 0) {
      request.scrapeOptions!.formats!.push('markdown'); // Default to markdown
    }

    const response = await this.withRetry(async () => {
      return this.client.post<FirecrawlCrawlResponse>('/v0/crawl', request);
    });

    if (!response.data.success || !response.data.data) {
      throw new Error(`Failed to crawl ${baseUrl}: ${response.data.error || 'Unknown error'}`);
    }

    return response.data.data.map(item => ({
      url: item.metadata?.sourceURL || baseUrl,
      content: item.markdown || item.html || '',
      title: item.metadata?.title,
      description: item.metadata?.description,
      publishedTime: item.metadata?.publishedTime,
    }));
  }

  /**
   * Scrape Hacker News front page with fallback mechanisms
   */
  async scrapeHackerNews(options: {
    limit?: number;
    fallbackToApi?: boolean;
  } = {}): Promise<NewsArticle[]> {
    const limit = options.limit || 20;
    const fallbackToApi = options.fallbackToApi ?? true;
    
    try {
      // First, scrape the main page to get story links
      const mainPageContent = await this.scrapeUrl('https://news.ycombinator.com', {
        includeMarkdown: true,
        onlyMainContent: true,
      });

      // Extract story URLs from the content
      const storyUrls = this.extractHackerNewsStoryUrls(mainPageContent.content, limit);
      
      if (storyUrls.length === 0) {
        console.warn('No story URLs found on Hacker News main page');
        if (fallbackToApi) {
          return this.fallbackToHackerNewsApi(limit);
        }
        return [];
      }
      
      const articles: NewsArticle[] = [];
      let failedCount = 0;
      
      // Scrape each story page with concurrent processing (limited)
      const batchSize = 3; // Process 3 stories at a time to avoid overwhelming the server
      for (let i = 0; i < Math.min(storyUrls.length, limit); i += batchSize) {
        const batch = storyUrls.slice(i, i + batchSize);
        const batchPromises = batch.map(async (storyUrl) => {
          try {
            const storyContent = await this.scrapeUrl(storyUrl, {
              includeMarkdown: true,
              onlyMainContent: true,
            });

            const article = this.convertHackerNewsToArticle(storyUrl, storyContent);
            return article;
          } catch (error) {
            console.error(`Failed to scrape Hacker News story ${storyUrl}:`, error);
            failedCount++;
            return null;
          }
        });

        const batchResults = await Promise.all(batchPromises);
        const validArticles = batchResults.filter((article): article is NewsArticle => article !== null);
        articles.push(...validArticles);

        // Stop if we have enough articles
        if (articles.length >= limit) {
          break;
        }
      }

      // If too many failures and fallback is enabled, try API fallback
      if (failedCount > storyUrls.length * 0.5 && fallbackToApi && articles.length < limit * 0.3) {
        console.warn(`High failure rate (${failedCount}/${storyUrls.length}), attempting API fallback`);
        const fallbackArticles = await this.fallbackToHackerNewsApi(limit - articles.length);
        articles.push(...fallbackArticles);
      }

      return articles.slice(0, limit);
    } catch (error) {
      console.error('Failed to scrape Hacker News:', error);
      
      // Try fallback to API if enabled
      if (fallbackToApi) {
        console.log('Attempting fallback to Hacker News API');
        try {
          return await this.fallbackToHackerNewsApi(limit);
        } catch (fallbackError) {
          console.error('Fallback to API also failed:', fallbackError);
        }
      }
      
      throw new Error(`Hacker News scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fallback to Hacker News API when scraping fails
   */
  private async fallbackToHackerNewsApi(limit: number): Promise<NewsArticle[]> {
    try {
      // Use the official Hacker News API as fallback
      const topStoriesResponse = await axios.get('https://hacker-news.firebaseio.com/v0/topstories.json');
      const topStoryIds = topStoriesResponse.data.slice(0, limit * 2); // Get more IDs in case some fail
      
      const articles: NewsArticle[] = [];
      
      // Fetch story details with limited concurrency
      const batchSize = 5;
      for (let i = 0; i < Math.min(topStoryIds.length, limit * 2); i += batchSize) {
        const batch = topStoryIds.slice(i, i + batchSize);
        const batchPromises = batch.map(async (storyId: number) => {
          try {
            const storyResponse = await axios.get(`https://hacker-news.firebaseio.com/v0/item/${storyId}.json`);
            const story = storyResponse.data;
            
            if (story && story.type === 'story' && story.title && story.url) {
              return this.convertHackerNewsApiToArticle(story);
            }
            return null;
          } catch (error) {
            console.error(`Failed to fetch HN story ${storyId}:`, error);
            return null;
          }
        });

        const batchResults = await Promise.all(batchPromises);
        const validArticles = batchResults.filter((article): article is NewsArticle => article !== null);
        articles.push(...validArticles);

        // Stop if we have enough articles
        if (articles.length >= limit) {
          break;
        }
      }

      return articles.slice(0, limit);
    } catch (error) {
      console.error('Hacker News API fallback failed:', error);
      throw new Error(`Hacker News API fallback failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert Hacker News API response to NewsArticle
   */
  private convertHackerNewsApiToArticle(story: any): NewsArticle {
    const id = `hn-api-${story.id}-${Date.now()}`;
    const publishedAt = story.time ? new Date(story.time * 1000) : new Date();
    
    // Create a basic content from title and URL since API doesn't provide full content
    const content = `# ${story.title}\n\n[Read full article](${story.url})\n\nSubmitted by ${story.by || 'unknown'} | ${story.score || 0} points | ${story.descendants || 0} comments`;
    
    return {
      id,
      headline: story.title,
      content,
      source: 'hacker-news',
      category: 'technology',
      publishedAt,
      url: story.url,
      tags: this.extractTags(story.title, content),
    };
  }

  /**
   * Extract story URLs from Hacker News main page content with multiple strategies
   */
  private extractHackerNewsStoryUrls(content: string, limit: number): string[] {
    const urls: string[] = [];
    
    // Strategy 1: Look for Hacker News story patterns
    // HN stories typically have URLs like https://news.ycombinator.com/item?id=XXXXXX
    const storyPattern = /https:\/\/news\.ycombinator\.com\/item\?id=(\d+)/g;
    let match;
    
    while ((match = storyPattern.exec(content)) !== null && urls.length < limit) {
      const storyUrl = match[0];
      if (!urls.includes(storyUrl)) {
        urls.push(storyUrl);
      }
    }

    // Strategy 2: Look for external links in markdown format
    if (urls.length < limit) {
      const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g;
      while ((match = linkPattern.exec(content)) !== null && urls.length < limit) {
        const url = match[2];
        // Skip HN internal links and common non-article URLs
        if (!url.includes('ycombinator.com') && 
            !url.includes('github.com') && 
            !url.includes('twitter.com') && 
            !url.includes('reddit.com') &&
            !urls.includes(url)) {
          urls.push(url);
        }
      }
    }

    // Strategy 3: Look for direct HTTP links in text
    if (urls.length < limit) {
      const directLinkPattern = /https?:\/\/[^\s\)]+/g;
      while ((match = directLinkPattern.exec(content)) !== null && urls.length < limit) {
        const url = match[0];
        // Clean up URL (remove trailing punctuation)
        const cleanUrl = url.replace(/[.,;!?]+$/, '');
        
        if (!cleanUrl.includes('ycombinator.com') && 
            !cleanUrl.includes('github.com') && 
            !cleanUrl.includes('twitter.com') && 
            !cleanUrl.includes('reddit.com') &&
            !urls.includes(cleanUrl) &&
            this.isValidArticleUrl(cleanUrl)) {
          urls.push(cleanUrl);
        }
      }
    }

    return urls;
  }

  /**
   * Check if URL is likely to be a valid article URL
   */
  private isValidArticleUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      
      // Skip common non-article domains
      const skipDomains = ['youtube.com', 'youtu.be', 'twitter.com', 'x.com', 'facebook.com', 'instagram.com'];
      if (skipDomains.some(domain => parsedUrl.hostname.includes(domain))) {
        return false;
      }
      
      // Skip file downloads
      const fileExtensions = ['.pdf', '.zip', '.tar', '.gz', '.exe', '.dmg'];
      if (fileExtensions.some(ext => parsedUrl.pathname.toLowerCase().endsWith(ext))) {
        return false;
      }
      
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Convert scraped Hacker News content to NewsArticle format
   */
  private convertHackerNewsToArticle(url: string, scrapedContent: {
    content: string;
    title?: string;
    description?: string;
    publishedTime?: string;
  }): NewsArticle | null {
    if (!scrapedContent.content || scrapedContent.content.length < 100) {
      return null;
    }

    const id = this.generateArticleId(url);
    const title = scrapedContent.title || this.extractTitleFromContent(scrapedContent.content);
    const publishedAt = scrapedContent.publishedTime 
      ? new Date(scrapedContent.publishedTime)
      : new Date(); // Default to current time if not available

    return {
      id,
      headline: title,
      content: this.cleanContent(scrapedContent.content),
      source: 'hacker-news',
      category: 'technology',
      publishedAt,
      url,
      tags: this.extractTags(title, scrapedContent.content),
    };
  }

  /**
   * Generate unique article ID from URL
   */
  private generateArticleId(url: string): string {
    const urlHash = Buffer.from(url).toString('base64').slice(0, 12);
    const timestamp = Date.now();
    return `hn-${urlHash}-${timestamp}`;
  }

  /**
   * Extract title from content if not provided
   */
  private extractTitleFromContent(content: string): string {
    // Look for the first heading or use the first line
    const headingMatch = content.match(/^#\s+(.+)$/m);
    if (headingMatch) {
      return headingMatch[1].trim();
    }

    // Use the first non-empty line
    const lines = content.split('\n').filter(line => line.trim());
    return lines[0]?.trim() || 'Untitled Article';
  }

  /**
   * Clean and format content
   */
  private cleanContent(content: string): string {
    return content
      .replace(/\n{3,}/g, '\n\n') // Remove excessive line breaks
      .replace(/\s{2,}/g, ' ') // Remove excessive spaces
      .trim();
  }

  /**
   * Extract tags from title and content
   */
  private extractTags(title: string, content: string): string[] {
    const text = `${title} ${content}`.toLowerCase();
    const tags: string[] = ['technology', 'hacker-news'];
    
    // Technology-related keywords
    const techKeywords = [
      'ai', 'artificial intelligence', 'machine learning', 'ml',
      'programming', 'software', 'development', 'coding',
      'javascript', 'python', 'react', 'node',
      'startup', 'tech', 'innovation', 'algorithm',
      'data', 'database', 'api', 'web', 'mobile',
      'security', 'blockchain', 'crypto', 'cloud',
    ];
    
    techKeywords.forEach(keyword => {
      if (text.includes(keyword)) {
        tags.push(keyword);
      }
    });
    
    return [...new Set(tags)]; // Remove duplicates
  }
}

// Factory function to create Firecrawl client
export function createFirecrawlClient(): FirecrawlClient {
  if (!config.firecrawl.apiKey) {
    throw new Error('FIRECRAWL_API_KEY environment variable is required');
  }

  return new FirecrawlClient({
    apiKey: config.firecrawl.apiKey,
    baseUrl: config.firecrawl.baseUrl,
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000,
  });
}