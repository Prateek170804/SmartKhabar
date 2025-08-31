/**
 * Tests for production optimizations
 * Validates caching, connection pooling, logging, and CDN optimizations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProductionCache, getCache, CacheKeys } from '@/lib/cache';
import { DatabaseConnectionPool, getConnectionPool } from '@/lib/database/connection-pool';
import { ProductionLogger, getLogger, LogLevel } from '@/lib/monitoring/production-logger';
import { CDNOptimizer, getCDNOptimizer } from '@/lib/cdn/optimization';

describe('Production Optimizations', () => {
  describe('Caching Service', () => {
    let cache: ProductionCache;
    
    beforeEach(() => {
      cache = new ProductionCache({
        maxSize: 1024 * 1024, // 1MB
        defaultTTL: 5000, // 5 seconds
        cleanupInterval: 1000 // 1 second
      });
    });
    
    afterEach(() => {
      cache.destroy();
    });
    
    it('should cache and retrieve values', () => {
      const testData = { message: 'test data' };
      const key = 'test-key';
      
      expect(cache.set(key, testData)).toBe(true);
      expect(cache.get(key)).toEqual(testData);
    });
    
    it('should expire cached values after TTL', async () => {
      const testData = { message: 'test data' };
      const key = 'test-key';
      const shortTTL = 100; // 100ms
      
      cache.set(key, testData, shortTTL);
      expect(cache.get(key)).toEqual(testData);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(cache.get(key)).toBeNull();
    });
    
    it('should handle cache size limits', () => {
      const largeData = 'x'.repeat(2 * 1024 * 1024); // 2MB (larger than cache)
      const key = 'large-key';
      
      expect(cache.set(key, largeData)).toBe(false);
    });
    
    it('should generate correct cache keys', () => {
      const userId = 'user123';
      const preferences = { topics: ['tech'], tone: 'casual' };
      
      const key = CacheKeys.personalizedNews(userId, preferences);
      expect(key).toContain('personalized_news');
      expect(key).toContain(userId);
    });
  });
  
  describe('Connection Pooling', () => {
    let pool: DatabaseConnectionPool;
    
    beforeEach(() => {
      pool = new DatabaseConnectionPool({
        maxConnections: 2,
        idleTimeout: 1000,
        connectionTimeout: 500,
        retryAttempts: 3,
        retryDelay: 100
      });
    });
    
    afterEach(async () => {
      await pool.destroy();
    });
    
    it('should provide connection statistics', () => {
      const stats = pool.getStats();
      
      expect(stats).toHaveProperty('totalConnections');
      expect(stats).toHaveProperty('activeConnections');
      expect(stats).toHaveProperty('idleConnections');
      expect(stats).toHaveProperty('maxConnections');
      expect(stats.maxConnections).toBe(2);
    });
    
    it('should execute operations with connection management', async () => {
      const mockOperation = vi.fn().mockResolvedValue('result');
      
      const result = await pool.withConnection(mockOperation);
      
      expect(result).toBe('result');
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('Production Logger', () => {
    let logger: ProductionLogger;
    
    beforeEach(() => {
      logger = new ProductionLogger({
        level: LogLevel.DEBUG,
        enableConsole: false,
        enableStructuredLogging: true,
        includeStackTrace: false,
        maxLogSize: 1024,
        bufferSize: 10,
        flushInterval: 1000
      });
    });
    
    afterEach(() => {
      logger.destroy();
    });
    
    it('should log messages at different levels', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      logger.info('Test info message');
      logger.warn('Test warning message');
      logger.error('Test error message');
      
      const stats = logger.getStats();
      expect(stats.bufferSize).toBeGreaterThan(0);
      
      consoleSpy.mockRestore();
    });
    
    it('should log API calls with proper context', () => {
      const requestId = 'req_123';
      
      logger.logApiCall('GET', '/api/test', 200, 150, requestId, 'user123');
      
      const stats = logger.getStats();
      expect(stats.bufferSize).toBe(1);
    });
    
    it('should create child loggers with context', () => {
      const context = { service: 'test-service' };
      const childLogger = logger.child(context);
      
      expect(childLogger).toBeInstanceOf(ProductionLogger);
    });
  });
  
  describe('CDN Optimizer', () => {
    let optimizer: CDNOptimizer;
    
    beforeEach(() => {
      optimizer = new CDNOptimizer({
        enableCompression: true,
        enableCaching: true,
        maxAge: 3600,
        staleWhileRevalidate: 7200,
        enableImageOptimization: true,
        enablePreloading: true
      });
    });
    
    it('should generate appropriate cache headers for different asset types', () => {
      const staticHeaders = optimizer.getCacheHeaders('static');
      const apiHeaders = optimizer.getCacheHeaders('api');
      const imageHeaders = optimizer.getCacheHeaders('image');
      
      expect(staticHeaders['Cache-Control']).toContain('max-age=3600');
      expect(apiHeaders['Cache-Control']).toContain('stale-while-revalidate');
      expect(imageHeaders['Cache-Control']).toContain('max-age=3600');
    });
    
    it('should determine caching eligibility correctly', () => {
      const cacheableRequest = {
        method: 'GET',
        headers: {},
        url: '/api/test'
      };
      
      const nonCacheableRequest = {
        method: 'POST',
        headers: { authorization: 'Bearer token' },
        url: '/api/test'
      };
      
      expect(optimizer.shouldCache(cacheableRequest)).toBe(true);
      expect(optimizer.shouldCache(nonCacheableRequest)).toBe(false);
    });
    
    it('should generate optimized image URLs', () => {
      const originalUrl = 'https://example.com/image.jpg';
      const optimizedUrl = optimizer.getOptimizedImageUrl(originalUrl, 800, 600, 80);
      
      expect(optimizedUrl).toContain('/_next/image');
      expect(optimizedUrl).toContain('w=800');
      expect(optimizedUrl).toContain('q=80');
    });
    
    it('should generate preload links', () => {
      const resources = [
        { href: '/script.js', as: 'script' as const },
        { href: '/style.css', as: 'style' as const }
      ];
      
      const preloadLinks = optimizer.generatePreloadLinks(resources);
      
      expect(preloadLinks).toHaveLength(2);
      expect(preloadLinks[0]).toContain('rel=preload');
      expect(preloadLinks[0]).toContain('as=script');
    });
    
    it('should generate ETags for content', () => {
      const content = 'test content';
      const etag = optimizer.generateETag(content);
      
      expect(etag).toMatch(/^"[a-f0-9]+"$/);
    });
  });
  
  describe('Global Instances', () => {
    it('should provide singleton cache instance', () => {
      const cache1 = getCache();
      const cache2 = getCache();
      
      expect(cache1).toBe(cache2);
    });
    
    it('should provide singleton connection pool instance', () => {
      const pool1 = getConnectionPool();
      const pool2 = getConnectionPool();
      
      expect(pool1).toBe(pool2);
    });
    
    it('should provide singleton logger instance', () => {
      const logger1 = getLogger();
      const logger2 = getLogger();
      
      expect(logger1).toBe(logger2);
    });
    
    it('should provide singleton CDN optimizer instance', () => {
      const optimizer1 = getCDNOptimizer();
      const optimizer2 = getCDNOptimizer();
      
      expect(optimizer1).toBe(optimizer2);
    });
  });
});