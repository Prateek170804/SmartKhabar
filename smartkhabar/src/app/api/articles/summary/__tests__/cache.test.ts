/**
 * Tests for caching functionality in the summary API
 */

import { describe, it, expect } from 'vitest';
import crypto from 'crypto';

// Test the cache key generation logic
function generateCacheKey(articles: any[], tone: string, maxReadingTime: number): string {
  const articleIds = articles.map(a => a.id).sort().join(',');
  const content = `${articleIds}-${tone}-${maxReadingTime}`;
  return crypto.createHash('md5').update(content).digest('hex');
}

// Test cache validity logic
function isCacheValid(timestamp: number, ttl: number = 60 * 60 * 1000): boolean {
  return Date.now() - timestamp < ttl;
}

describe('Summary API Cache', () => {
  const mockArticles = [
    { id: 'article-1', title: 'Test Article 1' },
    { id: 'article-2', title: 'Test Article 2' }
  ];

  describe('Cache Key Generation', () => {
    it('should generate consistent cache keys for same input', () => {
      const key1 = generateCacheKey(mockArticles, 'casual', 5);
      const key2 = generateCacheKey(mockArticles, 'casual', 5);
      
      expect(key1).toBe(key2);
      expect(key1).toHaveLength(32); // MD5 hash length
    });

    it('should generate different cache keys for different tones', () => {
      const key1 = generateCacheKey(mockArticles, 'casual', 5);
      const key2 = generateCacheKey(mockArticles, 'formal', 5);
      
      expect(key1).not.toBe(key2);
    });

    it('should generate different cache keys for different reading times', () => {
      const key1 = generateCacheKey(mockArticles, 'casual', 5);
      const key2 = generateCacheKey(mockArticles, 'casual', 10);
      
      expect(key1).not.toBe(key2);
    });

    it('should generate different cache keys for different articles', () => {
      const articles1 = [{ id: 'article-1', title: 'Test 1' }];
      const articles2 = [{ id: 'article-2', title: 'Test 2' }];
      
      const key1 = generateCacheKey(articles1, 'casual', 5);
      const key2 = generateCacheKey(articles2, 'casual', 5);
      
      expect(key1).not.toBe(key2);
    });

    it('should generate same cache key regardless of article order', () => {
      const articles1 = [
        { id: 'article-1', title: 'Test 1' },
        { id: 'article-2', title: 'Test 2' }
      ];
      const articles2 = [
        { id: 'article-2', title: 'Test 2' },
        { id: 'article-1', title: 'Test 1' }
      ];
      
      const key1 = generateCacheKey(articles1, 'casual', 5);
      const key2 = generateCacheKey(articles2, 'casual', 5);
      
      expect(key1).toBe(key2);
    });
  });

  describe('Cache Validity', () => {
    it('should consider recent timestamps as valid', () => {
      const recentTimestamp = Date.now() - 1000; // 1 second ago
      expect(isCacheValid(recentTimestamp)).toBe(true);
    });

    it('should consider old timestamps as invalid', () => {
      const oldTimestamp = Date.now() - (2 * 60 * 60 * 1000); // 2 hours ago
      expect(isCacheValid(oldTimestamp)).toBe(false);
    });

    it('should respect custom TTL', () => {
      const timestamp = Date.now() - 5000; // 5 seconds ago
      const shortTTL = 3000; // 3 seconds
      const longTTL = 10000; // 10 seconds
      
      expect(isCacheValid(timestamp, shortTTL)).toBe(false);
      expect(isCacheValid(timestamp, longTTL)).toBe(true);
    });

    it('should handle edge case at TTL boundary', () => {
      const ttl = 60000; // 1 minute
      const exactlyExpiredTimestamp = Date.now() - ttl;
      
      // Should be invalid when exactly at TTL
      expect(isCacheValid(exactlyExpiredTimestamp, ttl)).toBe(false);
    });
  });

  describe('Cache Map Operations', () => {
    it('should store and retrieve cache entries', () => {
      const cache = new Map();
      const key = 'test-key';
      const value = {
        summary: { id: 'summary-1', content: 'Test summary' },
        timestamp: Date.now()
      };
      
      cache.set(key, value);
      expect(cache.has(key)).toBe(true);
      expect(cache.get(key)).toEqual(value);
    });

    it('should handle cache cleanup', () => {
      const cache = new Map();
      const now = Date.now();
      const ttl = 60000; // 1 minute
      
      // Add valid entry
      cache.set('valid-key', {
        summary: { id: 'summary-1', content: 'Valid summary' },
        timestamp: now - 30000 // 30 seconds ago
      });
      
      // Add expired entry
      cache.set('expired-key', {
        summary: { id: 'summary-2', content: 'Expired summary' },
        timestamp: now - 120000 // 2 minutes ago
      });
      
      // Simulate cleanup
      for (const [key, value] of cache.entries()) {
        if (!isCacheValid(value.timestamp, ttl)) {
          cache.delete(key);
        }
      }
      
      expect(cache.has('valid-key')).toBe(true);
      expect(cache.has('expired-key')).toBe(false);
      expect(cache.size).toBe(1);
    });
  });
});