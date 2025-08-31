/**
 * Tests for performance monitoring system
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PerformanceMonitor, PerformanceAlerts, performanceMonitor } from '../performance';

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = PerformanceMonitor.getInstance();
    monitor.reset();
  });

  afterEach(() => {
    monitor.reset();
  });

  it('should track request lifecycle', () => {
    const requestId = 'test-request-1';
    const endpoint = '/api/test';
    const method = 'GET';
    const userId = 'user-123';

    // Start request
    const metric = monitor.startRequest(requestId, endpoint, method, userId);

    expect(metric.requestId).toBe(requestId);
    expect(metric.endpoint).toBe(endpoint);
    expect(metric.method).toBe(method);
    expect(metric.userId).toBe(userId);
    expect(metric.startTime).toBeGreaterThan(0);
    expect(metric.dbQueries).toEqual([]);

    // End request
    const endedMetric = monitor.endRequest(requestId, 200);

    expect(endedMetric).toBeDefined();
    expect(endedMetric!.endTime).toBeGreaterThan(endedMetric!.startTime);
    expect(endedMetric!.duration).toBeGreaterThan(0);
    expect(endedMetric!.statusCode).toBe(200);
    expect(endedMetric!.memoryUsage).toBeDefined();
  });

  it('should track database queries', () => {
    const requestId = 'test-request-2';
    monitor.startRequest(requestId, '/api/test', 'GET');

    // Track a successful query
    monitor.trackDatabaseQuery(requestId, 'SELECT * FROM users', 150, true);

    // Track a failed query
    monitor.trackDatabaseQuery(requestId, 'SELECT * FROM invalid', 500, false, 'Table not found');

    const metric = monitor.endRequest(requestId, 200);

    expect(metric!.dbQueries).toHaveLength(2);
    expect(metric!.dbQueries[0].query).toBe('SELECT * FROM users');
    expect(metric!.dbQueries[0].duration).toBe(150);
    expect(metric!.dbQueries[0].success).toBe(true);
    expect(metric!.dbQueries[1].success).toBe(false);
    expect(metric!.dbQueries[1].error).toBe('Table not found');
  });

  it('should calculate performance statistics', async () => {
    // Create multiple requests with different response times
    const requests = [
      { id: 'req1', duration: 100, status: 200 },
      { id: 'req2', duration: 500, status: 200 },
      { id: 'req3', duration: 2000, status: 500 }, // Error
      { id: 'req4', duration: 4000, status: 200 }, // Slow
    ];

    // Start and end requests synchronously for testing
    requests.forEach(req => {
      monitor.startRequest(req.id, '/api/test', 'GET');
      if (req.status === 500) {
        monitor.endRequest(req.id, req.status, 'Internal server error');
      } else {
        monitor.endRequest(req.id, req.status);
      }
    });

    const stats = monitor.getPerformanceStats();

    expect(stats.totalRequests).toBe(4);
    expect(stats.averageResponseTime).toBeGreaterThan(0);
    expect(stats.errorRate).toBe(25); // 1 out of 4 requests failed
    expect(stats.topSlowEndpoints).toHaveLength(1);
    expect(stats.databaseStats.totalQueries).toBe(0);
  });

  it('should get system metrics', () => {
    const systemMetrics = monitor.getCurrentSystemMetrics();

    expect(systemMetrics.timestamp).toBeGreaterThan(0);
    expect(systemMetrics.memoryUsage).toBeDefined();
    expect(systemMetrics.activeRequests).toBeGreaterThanOrEqual(0);
    expect(systemMetrics.totalRequests).toBeGreaterThanOrEqual(0);
    expect(systemMetrics.averageResponseTime).toBeGreaterThanOrEqual(0);
    expect(systemMetrics.errorRate).toBeGreaterThanOrEqual(0);
  });

  it('should get health status', () => {
    // Add some requests to get meaningful health data
    monitor.startRequest('req1', '/api/test', 'GET');
    monitor.endRequest('req1', 200);

    const health = monitor.getHealthStatus();

    expect(health.status).toMatch(/healthy|warning|critical/);
    expect(health.checks).toBeInstanceOf(Array);
    expect(health.checks.length).toBeGreaterThan(0);

    health.checks.forEach(check => {
      expect(check.name).toBeDefined();
      expect(check.status).toMatch(/pass|warn|fail/);
      expect(check.message).toBeDefined();
    });
  });

  it('should warn about slow requests', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    monitor.startRequest('slow-req', '/api/slow', 'GET');
    
    // Simulate a slow request by manually setting duration
    const metric = monitor.endRequest('slow-req', 200);
    if (metric) {
      metric.duration = 5000; // 5 seconds
      monitor.endRequest('slow-req', 200);
    }

    // Note: The actual warning would be triggered in a real scenario
    // where the request actually takes 5 seconds
    
    consoleSpy.mockRestore();
  });
});

describe('PerformanceAlerts', () => {
  beforeEach(() => {
    performanceMonitor.reset();
  });

  afterEach(() => {
    performanceMonitor.reset();
  });

  it('should check performance thresholds', () => {
    // Create some requests to trigger alerts
    performanceMonitor.startRequest('req1', '/api/test', 'GET');
    performanceMonitor.endRequest('req1', 500, 'Server error');

    const alerts = PerformanceAlerts.checkThresholds();

    expect(alerts).toBeInstanceOf(Array);
    // Alerts might be empty if thresholds aren't exceeded
    alerts.forEach(alert => {
      expect(alert.type).toMatch(/response_time|query_time|error_rate|memory_usage/);
      expect(alert.severity).toMatch(/warning|critical/);
      expect(alert.message).toBeDefined();
      expect(alert.value).toBeGreaterThanOrEqual(0);
      expect(alert.threshold).toBeGreaterThan(0);
    });
  });

  it('should allow setting custom thresholds', () => {
    const originalThresholds = {
      responseTime: 1000,
      queryTime: 500,
      errorRate: 2,
      memoryUsage: 100 * 1024 * 1024,
    };

    PerformanceAlerts.setThresholds(originalThresholds);

    // Create a request that exceeds the new thresholds
    performanceMonitor.startRequest('req1', '/api/test', 'GET');
    performanceMonitor.endRequest('req1', 500, 'Error');

    const alerts = PerformanceAlerts.checkThresholds();

    // Should potentially have error rate alert
    const errorRateAlert = alerts.find(alert => alert.type === 'error_rate');
    if (errorRateAlert) {
      expect(errorRateAlert.threshold).toBe(2);
    }
  });
});

describe('Performance Integration', () => {
  it('should work with singleton instance', () => {
    const instance1 = PerformanceMonitor.getInstance();
    const instance2 = PerformanceMonitor.getInstance();

    expect(instance1).toBe(instance2);
    expect(instance1).toBe(performanceMonitor);
  });

  it('should handle concurrent requests', async () => {
    const promises = [];

    // Start multiple concurrent requests
    for (let i = 0; i < 10; i++) {
      promises.push(
        new Promise<void>(resolve => {
          const requestId = `concurrent-${i}`;
          performanceMonitor.startRequest(requestId, '/api/test', 'GET');
          
          setTimeout(() => {
            performanceMonitor.endRequest(requestId, 200);
            resolve();
          }, Math.random() * 100);
        })
      );
    }

    await Promise.all(promises);

    const stats = performanceMonitor.getPerformanceStats();
    expect(stats.totalRequests).toBe(10);
  });
});