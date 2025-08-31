/**
 * Production caching service for API responses
 * Implements in-memory caching with TTL and size limits
 */

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  size: number;
}

export interface CacheConfig {
  maxSize: number; // Maximum cache size in bytes
  defaultTTL: number; // Default TTL in milliseconds
  cleanupInterval: number; // Cleanup interval in milliseconds
}

export class ProductionCache {
  private cache = new Map<string, CacheEntry<any>>();
  private totalSize = 0;
  private cleanupTimer?: NodeJS.Timeout;
  
  constructor(private config: CacheConfig) {
    this.startCleanup();
  }
  
  /**
   * Get cached value
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  /**
   * Set cached value
   */
  set<T>(key: string, data: T, ttl?: number): boolean {
    const serialized = JSON.stringify(data);
    const size = Buffer.byteLength(serialized, 'utf8');
    
    // Check if this single item exceeds max size
    if (size > this.config.maxSize) {
      console.warn(`Cache item too large: ${key} (${size} bytes)`);
      return false;
    }
    
    // Make room if needed
    this.makeRoom(size);
    
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.config.defaultTTL,
      size
    };
    
    // Remove existing entry if it exists
    if (this.cache.has(key)) {
      this.delete(key);
    }
    
    this.cache.set(key, entry);
    this.totalSize += size;
    
    return true;
  }
  
  /**
   * Delete cached value
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.cache.delete(key);
      this.totalSize -= entry.size;
      return true;
    }
    return false;
  }
  
  /**
   * Clear all cached values
   */
  clear(): void {
    this.cache.clear();
    this.totalSize = 0;
  }
  
  /**
   * Get cache statistics
   */
  getStats() {
    const now = Date.now();
    let expiredCount = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        expiredCount++;
      }
    }
    
    return {
      totalEntries: this.cache.size,
      totalSize: this.totalSize,
      maxSize: this.config.maxSize,
      utilizationPercent: (this.totalSize / this.config.maxSize) * 100,
      expiredEntries: expiredCount
    };
  }
  
  /**
   * Make room in cache by removing expired and oldest entries
   */
  private makeRoom(neededSize: number): void {
    // First, remove expired entries
    this.cleanup();
    
    // If still not enough room, remove oldest entries
    while (this.totalSize + neededSize > this.config.maxSize && this.cache.size > 0) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.delete(oldestKey);
      }
    }
  }
  
  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        expiredKeys.push(key);
      }
    }
    
    expiredKeys.forEach(key => this.delete(key));
  }
  
  /**
   * Start periodic cleanup
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }
  
  /**
   * Stop periodic cleanup
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.clear();
  }
}

// Default cache configuration
export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  maxSize: 50 * 1024 * 1024, // 50MB
  defaultTTL: 5 * 60 * 1000, // 5 minutes
  cleanupInterval: 60 * 1000 // 1 minute
};

// Global cache instance
let globalCache: ProductionCache | null = null;

/**
 * Get or create global cache instance
 */
export function getCache(config?: Partial<CacheConfig>): ProductionCache {
  if (!globalCache) {
    globalCache = new ProductionCache({
      ...DEFAULT_CACHE_CONFIG,
      ...config
    });
  }
  return globalCache;
}

/**
 * Cache decorator for API responses
 */
export function cached(ttl?: number) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const cache = getCache();
      const cacheKey = `${propertyKey}:${JSON.stringify(args)}`;
      
      // Try to get from cache
      const cached = cache.get(cacheKey);
      if (cached) {
        return cached;
      }
      
      // Execute original method
      const result = await originalMethod.apply(this, args);
      
      // Cache the result
      cache.set(cacheKey, result, ttl);
      
      return result;
    };
    
    return descriptor;
  };
}

/**
 * Cache key generator utilities
 */
export const CacheKeys = {
  personalizedNews: (userId: string, preferences: any) => 
    `personalized_news:${userId}:${JSON.stringify(preferences)}`,
  
  articleSummary: (articleId: string, tone: string, readingTime: number) =>
    `article_summary:${articleId}:${tone}:${readingTime}`,
  
  userPreferences: (userId: string) =>
    `user_preferences:${userId}`,
  
  newsCollection: (source: string, category: string) =>
    `news_collection:${source}:${category}`,
  
  embeddings: (text: string) =>
    `embeddings:${Buffer.from(text).toString('base64').slice(0, 32)}`
};