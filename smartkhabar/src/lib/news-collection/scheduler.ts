import { NewsCollector, createNewsCollector, NewsCollectionResult } from './news-collector';
import { NewsArticle } from '@/types';
import { config } from '@/lib/config';

export interface CollectionStatus {
  id: string;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'failed';
  articlesCollected: number;
  sourcesProcessed: number;
  sourcesWithErrors: number;
  errors: Array<{
    source: string;
    error: string;
  }>;
  metadata: {
    collectionTime: number;
    memoryUsage?: NodeJS.MemoryUsage;
  };
}

export interface SchedulerConfig {
  sources?: string[];
  articlesPerSource?: number;
  includeHackerNews?: boolean;
  customUrls?: string[];
  enableDeduplication?: boolean;
  maxRetries?: number;
  retryDelayMs?: number;
}

export class NewsCollectionScheduler {
  private collector: NewsCollector;
  private collectionHistory: CollectionStatus[] = [];
  private isRunning: boolean = false;
  private currentCollectionId: string | null = null;

  constructor(private config: SchedulerConfig = {}) {
    this.collector = createNewsCollector();
  }

  /**
   * Execute a scheduled news collection
   */
  async executeCollection(): Promise<CollectionStatus> {
    if (this.isRunning) {
      throw new Error('Collection is already running');
    }

    const collectionId = this.generateCollectionId();
    this.currentCollectionId = collectionId;
    this.isRunning = true;

    const status: CollectionStatus = {
      id: collectionId,
      startTime: new Date(),
      status: 'running',
      articlesCollected: 0,
      sourcesProcessed: 0,
      sourcesWithErrors: 0,
      errors: [],
      metadata: {
        collectionTime: 0,
      },
    };

    // Add to history
    this.collectionHistory.push(status);

    try {
      console.log(`Starting news collection ${collectionId}`);
      
      // Collect articles from all sources
      const result = await this.collectWithRetry();
      
      // Update status with results
      status.endTime = new Date();
      status.status = 'completed';
      status.articlesCollected = result.articles.length;
      status.sourcesProcessed = result.metadata.sourcesProcessed;
      status.sourcesWithErrors = result.metadata.sourcesWithErrors;
      status.errors = result.errors;
      status.metadata.collectionTime = result.metadata.collectionTime;
      status.metadata.memoryUsage = process.memoryUsage();

      console.log(`Collection ${collectionId} completed: ${result.articles.length} articles from ${result.metadata.sourcesProcessed} sources`);
      
      // Store articles (this would typically save to database)
      await this.storeArticles(result.articles);
      
      return status;

    } catch (error) {
      console.error(`Collection ${collectionId} failed:`, error);
      
      status.endTime = new Date();
      status.status = 'failed';
      status.errors.push({
        source: 'scheduler',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      status.metadata.collectionTime = Date.now() - status.startTime.getTime();
      status.metadata.memoryUsage = process.memoryUsage();

      throw error;

    } finally {
      this.isRunning = false;
      this.currentCollectionId = null;
      
      // Keep only last 50 collection records
      if (this.collectionHistory.length > 50) {
        this.collectionHistory = this.collectionHistory.slice(-50);
      }
    }
  }

  /**
   * Collect articles with retry logic
   */
  private async collectWithRetry(): Promise<NewsCollectionResult> {
    const maxRetries = this.config.maxRetries || 3;
    const retryDelay = this.config.retryDelayMs || 5000;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.collector.collectFromAllSources({
          sources: this.config.sources,
          articlesPerSource: this.config.articlesPerSource || 10,
          includeHackerNews: this.config.includeHackerNews || true,
          customUrls: this.config.customUrls,
        });

        // Apply additional deduplication if enabled
        if (this.config.enableDeduplication !== false) {
          result.articles = this.deduplicateArticles(result.articles);
        }

        return result;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.warn(`Collection attempt ${attempt}/${maxRetries} failed:`, lastError.message);
        
        if (attempt < maxRetries) {
          console.log(`Retrying in ${retryDelay}ms...`);
          await this.delay(retryDelay);
        }
      }
    }

    throw lastError || new Error('Collection failed after all retries');
  }

  /**
   * Enhanced deduplication logic
   */
  private deduplicateArticles(articles: NewsArticle[]): NewsArticle[] {
    const seen = new Map<string, NewsArticle>();
    const duplicates: string[] = [];

    for (const article of articles) {
      // Create a deduplication key based on URL and headline similarity
      const urlKey = article.url.toLowerCase();
      const headlineKey = this.normalizeHeadline(article.headline);
      const compositeKey = `${urlKey}|${headlineKey}`;

      // Check for exact URL match
      if (seen.has(urlKey)) {
        duplicates.push(article.id);
        continue;
      }

      // Check for similar headlines from the same source
      const similarKey = `${article.source}|${headlineKey}`;
      let isDuplicate = false;

      for (const [existingKey, existingArticle] of seen.entries()) {
        if (existingKey.includes(similarKey) || 
            (existingArticle.source === article.source && 
             this.calculateSimilarity(existingArticle.headline, article.headline) > 0.8)) {
          duplicates.push(article.id);
          isDuplicate = true;
          break;
        }
      }

      if (!isDuplicate) {
        seen.set(compositeKey, article);
      }
    }

    const deduplicated = Array.from(seen.values());
    
    if (duplicates.length > 0) {
      console.log(`Removed ${duplicates.length} duplicate articles`);
    }

    return deduplicated;
  }

  /**
   * Normalize headline for comparison
   */
  private normalizeHeadline(headline: string): string {
    return headline
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Calculate similarity between two strings
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) {
      return 1.0;
    }
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }
    
    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Store articles (placeholder for database integration)
   */
  private async storeArticles(articles: NewsArticle[]): Promise<void> {
    // This would typically save articles to the database
    // For now, we'll just log the count
    console.log(`Storing ${articles.length} articles to database`);
    
    // TODO: Implement actual database storage
    // await this.database.saveArticles(articles);
  }

  /**
   * Get current collection status
   */
  getCurrentStatus(): CollectionStatus | null {
    if (!this.currentCollectionId) {
      return null;
    }
    
    return this.collectionHistory.find(status => status.id === this.currentCollectionId) || null;
  }

  /**
   * Get collection history
   */
  getCollectionHistory(limit: number = 10): CollectionStatus[] {
    return this.collectionHistory
      .slice(-limit)
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }

  /**
   * Get collection statistics
   */
  getCollectionStats(): {
    totalCollections: number;
    successfulCollections: number;
    failedCollections: number;
    averageArticlesPerCollection: number;
    averageCollectionTime: number;
    lastCollectionTime?: Date;
  } {
    const total = this.collectionHistory.length;
    const successful = this.collectionHistory.filter(s => s.status === 'completed').length;
    const failed = this.collectionHistory.filter(s => s.status === 'failed').length;
    
    const completedCollections = this.collectionHistory.filter(s => s.status === 'completed');
    const avgArticles = completedCollections.length > 0 
      ? completedCollections.reduce((sum, s) => sum + s.articlesCollected, 0) / completedCollections.length 
      : 0;
    
    const avgTime = completedCollections.length > 0
      ? completedCollections.reduce((sum, s) => sum + s.metadata.collectionTime, 0) / completedCollections.length
      : 0;

    const lastCollection = this.collectionHistory.length > 0 
      ? this.collectionHistory[this.collectionHistory.length - 1]
      : null;

    return {
      totalCollections: total,
      successfulCollections: successful,
      failedCollections: failed,
      averageArticlesPerCollection: Math.round(avgArticles),
      averageCollectionTime: Math.round(avgTime),
      lastCollectionTime: lastCollection?.startTime,
    };
  }

  /**
   * Check if scheduler is currently running
   */
  isCollectionRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Generate unique collection ID
   */
  private generateCollectionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `collection-${timestamp}-${random}`;
  }

  /**
   * Utility function to delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Factory function to create scheduler
export function createNewsCollectionScheduler(config?: SchedulerConfig): NewsCollectionScheduler {
  return new NewsCollectionScheduler(config);
}