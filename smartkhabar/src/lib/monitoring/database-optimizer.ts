/**
 * Database query optimization and monitoring utilities
 * Provides connection pooling, query caching, and performance tracking
 */

import { performanceMonitor, trackDatabaseQuery } from './performance';

// Query cache interface
interface QueryCacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

// Connection pool interface
interface ConnectionPoolConfig {
  maxConnections: number;
  minConnections: number;
  acquireTimeoutMillis: number;
  idleTimeoutMillis: number;
}

/**
 * Query cache for frequently accessed data
 */
export class QueryCache {
  private cache = new Map<string, QueryCacheEntry>();
  private readonly defaultTTL = 5 * 60 * 1000; // 5 minutes
  private readonly maxCacheSize = 1000;

  /**
   * Get cached query result
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set cached query result
   */
  set(key: string, data: any, ttl?: number): void {
    // Clean up old entries if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      this.cleanup();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
    });
  }

  /**
   * Invalidate cache entry
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidate cache entries by pattern
   */
  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const expiredKeys = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.cache.delete(key));

    // If still too many entries, remove oldest ones
    if (this.cache.size >= this.maxCacheSize) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = entries.slice(0, Math.floor(this.maxCacheSize * 0.2));
      toRemove.forEach(([key]) => this.cache.delete(key));
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    hitRate: number;
    memoryUsage: number;
  } {
    // Simple approximation of memory usage
    const memoryUsage = JSON.stringify(Array.from(this.cache.values())).length;
    
    return {
      size: this.cache.size,
      hitRate: 0, // Would need to track hits/misses for accurate rate
      memoryUsage,
    };
  }
}

/**
 * Database connection pool manager
 */
export class ConnectionPool {
  private connections: Array<{ id: string; inUse: boolean; lastUsed: number }> = [];
  private config: ConnectionPoolConfig;
  private waitingQueue: Array<{ resolve: Function; reject: Function; timeout: NodeJS.Timeout }> = [];

  constructor(config: Partial<ConnectionPoolConfig> = {}) {
    this.config = {
      maxConnections: 10,
      minConnections: 2,
      acquireTimeoutMillis: 30000,
      idleTimeoutMillis: 300000, // 5 minutes
      ...config,
    };

    // Initialize minimum connections
    this.initializeConnections();
    
    // Start cleanup interval
    setInterval(() => this.cleanupIdleConnections(), 60000); // Every minute
  }

  /**
   * Acquire a connection from the pool
   */
  async acquire(): Promise<string> {
    // Try to find an available connection
    const availableConnection = this.connections.find(conn => !conn.inUse);
    
    if (availableConnection) {
      availableConnection.inUse = true;
      availableConnection.lastUsed = Date.now();
      return availableConnection.id;
    }

    // If no available connection and we can create more
    if (this.connections.length < this.config.maxConnections) {
      const newConnection = this.createConnection();
      newConnection.inUse = true;
      this.connections.push(newConnection);
      return newConnection.id;
    }

    // Wait for a connection to become available
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waitingQueue.findIndex(item => item.resolve === resolve);
        if (index !== -1) {
          this.waitingQueue.splice(index, 1);
        }
        reject(new Error('Connection acquire timeout'));
      }, this.config.acquireTimeoutMillis);

      this.waitingQueue.push({ resolve, reject, timeout });
    });
  }

  /**
   * Release a connection back to the pool
   */
  release(connectionId: string): void {
    const connection = this.connections.find(conn => conn.id === connectionId);
    if (connection) {
      connection.inUse = false;
      connection.lastUsed = Date.now();

      // If there are waiting requests, fulfill the next one
      if (this.waitingQueue.length > 0) {
        const waiting = this.waitingQueue.shift()!;
        clearTimeout(waiting.timeout);
        connection.inUse = true;
        waiting.resolve(connectionId);
      }
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    waitingRequests: number;
  } {
    const activeConnections = this.connections.filter(conn => conn.inUse).length;
    
    return {
      totalConnections: this.connections.length,
      activeConnections,
      idleConnections: this.connections.length - activeConnections,
      waitingRequests: this.waitingQueue.length,
    };
  }

  /**
   * Initialize minimum connections
   */
  private initializeConnections(): void {
    for (let i = 0; i < this.config.minConnections; i++) {
      this.connections.push(this.createConnection());
    }
  }

  /**
   * Create a new connection
   */
  private createConnection(): { id: string; inUse: boolean; lastUsed: number } {
    return {
      id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      inUse: false,
      lastUsed: Date.now(),
    };
  }

  /**
   * Clean up idle connections
   */
  private cleanupIdleConnections(): void {
    const now = Date.now();
    const minConnections = this.config.minConnections;
    
    // Remove idle connections beyond minimum
    this.connections = this.connections.filter((conn, index) => {
      if (conn.inUse) return true;
      if (index < minConnections) return true;
      
      return now - conn.lastUsed < this.config.idleTimeoutMillis;
    });
  }
}

/**
 * Database query optimizer
 */
export class DatabaseOptimizer {
  private queryCache = new QueryCache();
  private connectionPool = new ConnectionPool();
  private queryStats = new Map<string, { count: number; totalTime: number; errors: number }>();

  /**
   * Execute optimized query with caching and monitoring
   */
  async executeQuery<T>(
    requestId: string,
    queryName: string,
    queryFn: () => Promise<T>,
    options: {
      cache?: boolean;
      cacheTTL?: number;
      cacheKey?: string;
    } = {}
  ): Promise<T> {
    const { cache = false, cacheTTL, cacheKey } = options;
    const finalCacheKey = cacheKey || `${queryName}_${JSON.stringify(arguments)}`;

    // Try cache first if enabled
    if (cache) {
      const cached = this.queryCache.get<T>(finalCacheKey);
      if (cached !== null) {
        return cached;
      }
    }

    // Execute query with connection pool and monitoring
    const connectionId = await this.connectionPool.acquire();
    
    try {
      const result = await trackDatabaseQuery(requestId, queryName, queryFn);
      
      // Update query statistics
      this.updateQueryStats(queryName, true);
      
      // Cache result if enabled
      if (cache) {
        this.queryCache.set(finalCacheKey, result, cacheTTL);
      }
      
      return result;
    } catch (error) {
      this.updateQueryStats(queryName, false);
      throw error;
    } finally {
      this.connectionPool.release(connectionId);
    }
  }

  /**
   * Batch execute multiple queries
   */
  async executeBatch<T>(
    requestId: string,
    queries: Array<{
      name: string;
      fn: () => Promise<T>;
      cache?: boolean;
      cacheTTL?: number;
    }>
  ): Promise<T[]> {
    const promises = queries.map(query =>
      this.executeQuery(requestId, query.name, query.fn, {
        cache: query.cache,
        cacheTTL: query.cacheTTL,
      })
    );

    return Promise.all(promises);
  }

  /**
   * Get query performance statistics
   */
  getQueryStats(): Array<{
    queryName: string;
    count: number;
    averageTime: number;
    errorRate: number;
  }> {
    return Array.from(this.queryStats.entries()).map(([queryName, stats]) => ({
      queryName,
      count: stats.count,
      averageTime: stats.totalTime / stats.count,
      errorRate: (stats.errors / stats.count) * 100,
    }));
  }

  /**
   * Get slow queries
   */
  getSlowQueries(threshold: number = 1000): Array<{
    queryName: string;
    averageTime: number;
    count: number;
  }> {
    return this.getQueryStats()
      .filter(stat => stat.averageTime > threshold)
      .sort((a, b) => b.averageTime - a.averageTime);
  }

  /**
   * Invalidate cache for specific patterns
   */
  invalidateCache(pattern: string): void {
    this.queryCache.invalidatePattern(pattern);
  }

  /**
   * Get optimizer statistics
   */
  getStats(): {
    cache: ReturnType<QueryCache['getStats']>;
    connectionPool: ReturnType<ConnectionPool['getStats']>;
    queries: ReturnType<DatabaseOptimizer['getQueryStats']>;
  } {
    return {
      cache: this.queryCache.getStats(),
      connectionPool: this.connectionPool.getStats(),
      queries: this.getQueryStats(),
    };
  }

  /**
   * Update query statistics
   */
  private updateQueryStats(queryName: string, success: boolean): void {
    const stats = this.queryStats.get(queryName) || { count: 0, totalTime: 0, errors: 0 };
    stats.count++;
    if (!success) {
      stats.errors++;
    }
    this.queryStats.set(queryName, stats);
  }
}

// Export singleton instance
export const databaseOptimizer = new DatabaseOptimizer();

/**
 * Decorator for optimized database operations
 */
export function optimizedQuery(
  queryName: string,
  options: {
    cache?: boolean;
    cacheTTL?: number;
  } = {}
) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const requestId = args[0]?.requestId || 'unknown';
      
      return databaseOptimizer.executeQuery(
        requestId,
        queryName,
        () => originalMethod.apply(this, args),
        options
      );
    };

    return descriptor;
  };
}