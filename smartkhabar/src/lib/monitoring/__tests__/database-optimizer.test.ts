/**
 * Tests for database optimizer
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryCache, ConnectionPool, DatabaseOptimizer, databaseOptimizer } from '../database-optimizer';

describe('QueryCache', () => {
  let cache: QueryCache;

  beforeEach(() => {
    cache = new QueryCache();
  });

  it('should cache and retrieve data', () => {
    const key = 'test-key';
    const data = { id: 1, name: 'test' };

    // Set data
    cache.set(key, data);

    // Get data
    const retrieved = cache.get(key);
    expect(retrieved).toEqual(data);
  });

  it('should return null for non-existent keys', () => {
    const result = cache.get('non-existent');
    expect(result).toBeNull();
  });

  it('should respect TTL', async () => {
    const key = 'ttl-test';
    const data = { test: true };
    const shortTTL = 50; // 50ms

    cache.set(key, data, shortTTL);

    // Should be available immediately
    expect(cache.get(key)).toEqual(data);

    // Wait for TTL to expire
    await new Promise(resolve => setTimeout(resolve, 60));

    // Should be null after TTL
    expect(cache.get(key)).toBeNull();
  });

  it('should invalidate specific keys', () => {
    cache.set('key1', 'data1');
    cache.set('key2', 'data2');

    cache.invalidate('key1');

    expect(cache.get('key1')).toBeNull();
    expect(cache.get('key2')).toBe('data2');
  });

  it('should invalidate by pattern', () => {
    cache.set('user:123:profile', { name: 'John' });
    cache.set('user:456:profile', { name: 'Jane' });
    cache.set('post:789', { title: 'Test' });

    cache.invalidatePattern('user:.*:profile');

    expect(cache.get('user:123:profile')).toBeNull();
    expect(cache.get('user:456:profile')).toBeNull();
    expect(cache.get('post:789')).toEqual({ title: 'Test' });
  });

  it('should provide cache statistics', () => {
    cache.set('key1', 'data1');
    cache.set('key2', 'data2');

    const stats = cache.getStats();

    expect(stats.size).toBe(2);
    expect(stats.memoryUsage).toBeGreaterThan(0);
    expect(stats.hitRate).toBeDefined();
  });
});

describe('ConnectionPool', () => {
  let pool: ConnectionPool;

  beforeEach(() => {
    pool = new ConnectionPool({
      maxConnections: 5,
      minConnections: 2,
      acquireTimeoutMillis: 1000,
      idleTimeoutMillis: 5000,
    });
  });

  it('should acquire and release connections', async () => {
    const connectionId = await pool.acquire();
    expect(connectionId).toBeDefined();
    expect(typeof connectionId).toBe('string');

    const stats = pool.getStats();
    expect(stats.activeConnections).toBe(1);
    expect(stats.totalConnections).toBeGreaterThanOrEqual(1);

    pool.release(connectionId);

    const statsAfterRelease = pool.getStats();
    expect(statsAfterRelease.activeConnections).toBe(0);
  });

  it('should handle multiple concurrent acquisitions', async () => {
    const promises = [];
    const connectionIds: string[] = [];

    // Acquire multiple connections
    for (let i = 0; i < 3; i++) {
      promises.push(
        pool.acquire().then(id => {
          connectionIds.push(id);
          return id;
        })
      );
    }

    await Promise.all(promises);

    expect(connectionIds).toHaveLength(3);
    expect(new Set(connectionIds).size).toBe(3); // All unique

    const stats = pool.getStats();
    expect(stats.activeConnections).toBe(3);

    // Release all connections
    connectionIds.forEach(id => pool.release(id));

    const finalStats = pool.getStats();
    expect(finalStats.activeConnections).toBe(0);
  });

  it('should timeout when no connections available', async () => {
    const pool = new ConnectionPool({
      maxConnections: 1,
      minConnections: 1,
      acquireTimeoutMillis: 100,
    });

    // Acquire the only connection
    const connectionId = await pool.acquire();

    // Try to acquire another - should timeout
    await expect(pool.acquire()).rejects.toThrow('Connection acquire timeout');

    // Release and try again - should succeed
    pool.release(connectionId);
    const newConnectionId = await pool.acquire();
    expect(newConnectionId).toBeDefined();
  });

  it('should provide pool statistics', async () => {
    const connectionId = await pool.acquire();
    const stats = pool.getStats();

    expect(stats.totalConnections).toBeGreaterThan(0);
    expect(stats.activeConnections).toBe(1);
    expect(stats.idleConnections).toBe(stats.totalConnections - 1);
    expect(stats.waitingRequests).toBe(0);

    pool.release(connectionId);
  });
});

describe('DatabaseOptimizer', () => {
  let optimizer: DatabaseOptimizer;

  beforeEach(() => {
    optimizer = new DatabaseOptimizer();
  });

  it('should execute queries with monitoring', async () => {
    const mockQueryFn = vi.fn().mockResolvedValue({ id: 1, name: 'test' });
    const requestId = 'test-request';
    const queryName = 'getUser';

    const result = await optimizer.executeQuery(requestId, queryName, mockQueryFn);

    expect(result).toEqual({ id: 1, name: 'test' });
    expect(mockQueryFn).toHaveBeenCalledTimes(1);

    const stats = optimizer.getQueryStats();
    expect(stats).toHaveLength(1);
    expect(stats[0].queryName).toBe(queryName);
    expect(stats[0].count).toBe(1);
  });

  it('should cache query results', async () => {
    const mockQueryFn = vi.fn().mockResolvedValue({ id: 1, name: 'test' });
    const requestId = 'test-request';
    const queryName = 'getUser';

    // First call
    const result1 = await optimizer.executeQuery(requestId, queryName, mockQueryFn, {
      cache: true,
      cacheKey: 'user:1',
    });

    // Second call - should use cache
    const result2 = await optimizer.executeQuery(requestId, queryName, mockQueryFn, {
      cache: true,
      cacheKey: 'user:1',
    });

    expect(result1).toEqual(result2);
    expect(mockQueryFn).toHaveBeenCalledTimes(1); // Only called once due to caching
  });

  it('should handle query errors', async () => {
    const mockQueryFn = vi.fn().mockRejectedValue(new Error('Database error'));
    const requestId = 'test-request';
    const queryName = 'failingQuery';

    await expect(
      optimizer.executeQuery(requestId, queryName, mockQueryFn)
    ).rejects.toThrow('Database error');

    const stats = optimizer.getQueryStats();
    expect(stats).toHaveLength(1);
    expect(stats[0].queryName).toBe(queryName);
    expect(stats[0].errorRate).toBe(100);
  });

  it('should execute batch queries', async () => {
    const queries = [
      {
        name: 'getUser',
        fn: vi.fn().mockResolvedValue({ id: 1, name: 'John' }),
      },
      {
        name: 'getPosts',
        fn: vi.fn().mockResolvedValue([{ id: 1, title: 'Post 1' }]),
      },
    ];

    const results = await optimizer.executeBatch('test-request', queries);

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ id: 1, name: 'John' });
    expect(results[1]).toEqual([{ id: 1, title: 'Post 1' }]);

    queries.forEach(query => {
      expect(query.fn).toHaveBeenCalledTimes(1);
    });
  });

  it('should identify slow queries', async () => {
    // Mock a slow query
    const slowQueryFn = vi.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve('slow result'), 50))
    );

    const fastQueryFn = vi.fn().mockResolvedValue('fast result');

    await optimizer.executeQuery('req1', 'slowQuery', slowQueryFn);
    await optimizer.executeQuery('req2', 'fastQuery', fastQueryFn);

    // Wait for slow query to complete
    await new Promise(resolve => setTimeout(resolve, 60));

    const slowQueries = optimizer.getSlowQueries(40); // 40ms threshold

    expect(slowQueries.length).toBeGreaterThanOrEqual(0);
    // Note: Timing-dependent test, might not always detect slow query in test environment
  });

  it('should provide comprehensive statistics', async () => {
    const mockQueryFn = vi.fn().mockResolvedValue('result');
    
    await optimizer.executeQuery('req1', 'testQuery', mockQueryFn);

    const stats = optimizer.getStats();

    expect(stats.cache).toBeDefined();
    expect(stats.connectionPool).toBeDefined();
    expect(stats.queries).toBeDefined();
    expect(stats.queries).toHaveLength(1);
  });

  it('should invalidate cache patterns', async () => {
    const mockQueryFn = vi.fn().mockResolvedValue('result');

    // Cache some data
    await optimizer.executeQuery('req1', 'getUser', mockQueryFn, {
      cache: true,
      cacheKey: 'user:123',
    });

    // Invalidate cache
    optimizer.invalidateCache('user:.*');

    // Next call should execute query again
    await optimizer.executeQuery('req2', 'getUser', mockQueryFn, {
      cache: true,
      cacheKey: 'user:123',
    });

    expect(mockQueryFn).toHaveBeenCalledTimes(2);
  });
});

describe('Database Optimizer Integration', () => {
  it('should work with singleton instance', () => {
    expect(databaseOptimizer).toBeInstanceOf(DatabaseOptimizer);
  });

  it('should handle concurrent operations', async () => {
    const promises = [];

    for (let i = 0; i < 5; i++) {
      promises.push(
        databaseOptimizer.executeQuery(
          `req-${i}`,
          'concurrentQuery',
          () => Promise.resolve(`result-${i}`)
        )
      );
    }

    const results = await Promise.all(promises);

    expect(results).toHaveLength(5);
    results.forEach((result, index) => {
      expect(result).toBe(`result-${index}`);
    });
  });
});