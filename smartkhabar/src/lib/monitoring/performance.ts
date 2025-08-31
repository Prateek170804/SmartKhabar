/**
 * Performance monitoring system for SmartKhabar
 * Tracks response times, database queries, and system metrics
 */

import { NextRequest } from 'next/server';

// Performance metrics interface
export interface PerformanceMetrics {
  requestId: string;
  endpoint: string;
  method: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  statusCode?: number;
  userId?: string;
  dbQueries: DatabaseQueryMetric[];
  memoryUsage?: NodeJS.MemoryUsage;
  errors?: string[];
}

export interface DatabaseQueryMetric {
  query: string;
  duration: number;
  timestamp: number;
  success: boolean;
  error?: string;
}

export interface SystemMetrics {
  timestamp: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage?: NodeJS.CpuUsage;
  activeRequests: number;
  totalRequests: number;
  averageResponseTime: number;
  errorRate: number;
}

// In-memory storage for metrics (in production, use Redis or database)
class MetricsStore {
  private metrics: Map<string, PerformanceMetrics> = new Map();
  private systemMetrics: SystemMetrics[] = [];
  private readonly maxMetrics = 1000; // Keep last 1000 requests
  private readonly maxSystemMetrics = 100; // Keep last 100 system snapshots

  addMetric(metric: PerformanceMetrics): void {
    this.metrics.set(metric.requestId, metric);
    
    // Clean up old metrics
    if (this.metrics.size > this.maxMetrics) {
      const oldestKey = this.metrics.keys().next().value;
      if (oldestKey) {
        this.metrics.delete(oldestKey);
      }
    }
  }

  getMetric(requestId: string): PerformanceMetrics | undefined {
    return this.metrics.get(requestId);
  }

  getAllMetrics(): PerformanceMetrics[] {
    return Array.from(this.metrics.values());
  }

  addSystemMetric(metric: SystemMetrics): void {
    this.systemMetrics.push(metric);
    
    // Clean up old system metrics
    if (this.systemMetrics.length > this.maxSystemMetrics) {
      this.systemMetrics.shift();
    }
  }

  getSystemMetrics(): SystemMetrics[] {
    return this.systemMetrics;
  }

  getLatestSystemMetric(): SystemMetrics | undefined {
    return this.systemMetrics[this.systemMetrics.length - 1];
  }

  clear(): void {
    this.metrics.clear();
    this.systemMetrics.length = 0;
  }
}

const metricsStore = new MetricsStore();

/**
 * Performance monitor class
 */
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private activeRequests = 0;
  private totalRequests = 0;
  private totalResponseTime = 0;
  private totalErrors = 0;

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Start tracking a request
   */
  startRequest(requestId: string, endpoint: string, method: string, userId?: string): PerformanceMetrics {
    this.activeRequests++;
    this.totalRequests++;

    const metric: PerformanceMetrics = {
      requestId,
      endpoint,
      method,
      startTime: Date.now(),
      userId,
      dbQueries: [],
    };

    metricsStore.addMetric(metric);
    return metric;
  }

  /**
   * End tracking a request
   */
  endRequest(requestId: string, statusCode: number, error?: string): PerformanceMetrics | undefined {
    const metric = metricsStore.getMetric(requestId);
    if (!metric) return undefined;

    this.activeRequests--;
    metric.endTime = Date.now();
    metric.duration = metric.endTime - metric.startTime;
    metric.statusCode = statusCode;
    metric.memoryUsage = process.memoryUsage();

    if (error) {
      metric.errors = metric.errors || [];
      metric.errors.push(error);
      this.totalErrors++;
    }

    this.totalResponseTime += metric.duration;

    // Update metric in store
    metricsStore.addMetric(metric);

    // Log slow requests
    if (metric.duration > 3000) { // 3 seconds
      console.warn(`Slow request detected: ${metric.endpoint} took ${metric.duration}ms`);
    }

    return metric;
  }

  /**
   * Track database query
   */
  trackDatabaseQuery(requestId: string, query: string, duration: number, success: boolean, error?: string): void {
    const metric = metricsStore.getMetric(requestId);
    if (!metric) return;

    const queryMetric: DatabaseQueryMetric = {
      query: this.sanitizeQuery(query),
      duration,
      timestamp: Date.now(),
      success,
      error,
    };

    metric.dbQueries.push(queryMetric);
    metricsStore.addMetric(metric);

    // Log slow queries
    if (duration > 1000) { // 1 second
      console.warn(`Slow database query detected: ${query} took ${duration}ms`);
    }
  }

  /**
   * Get current system metrics
   */
  getCurrentSystemMetrics(): SystemMetrics {
    const now = Date.now();
    const memoryUsage = process.memoryUsage();
    
    const averageResponseTime = this.totalRequests > 0 ? 
      this.totalResponseTime / this.totalRequests : 0;
    
    const errorRate = this.totalRequests > 0 ? 
      (this.totalErrors / this.totalRequests) * 100 : 0;

    const systemMetric: SystemMetrics = {
      timestamp: now,
      memoryUsage,
      activeRequests: this.activeRequests,
      totalRequests: this.totalRequests,
      averageResponseTime,
      errorRate,
    };

    metricsStore.addSystemMetric(systemMetric);
    return systemMetric;
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(timeWindow?: number): {
    totalRequests: number;
    averageResponseTime: number;
    slowRequests: number;
    errorRate: number;
    topSlowEndpoints: Array<{ endpoint: string; averageTime: number; count: number }>;
    databaseStats: {
      totalQueries: number;
      averageQueryTime: number;
      slowQueries: number;
    };
  } {
    const metrics = metricsStore.getAllMetrics();
    const cutoffTime = timeWindow ? Date.now() - timeWindow : 0;
    
    const filteredMetrics = metrics.filter(m => m.startTime >= cutoffTime);
    
    const totalRequests = filteredMetrics.length;
    const completedRequests = filteredMetrics.filter(m => m.duration !== undefined);
    
    const averageResponseTime = completedRequests.length > 0 ?
      completedRequests.reduce((sum, m) => sum + (m.duration || 0), 0) / completedRequests.length : 0;
    
    const slowRequests = completedRequests.filter(m => (m.duration || 0) > 3000).length;
    const errorRequests = filteredMetrics.filter(m => m.errors && m.errors.length > 0).length;
    const errorRate = totalRequests > 0 ? (errorRequests / totalRequests) * 100 : 0;

    // Calculate top slow endpoints
    const endpointStats = new Map<string, { totalTime: number; count: number }>();
    completedRequests.forEach(m => {
      const existing = endpointStats.get(m.endpoint) || { totalTime: 0, count: 0 };
      existing.totalTime += m.duration || 0;
      existing.count += 1;
      endpointStats.set(m.endpoint, existing);
    });

    const topSlowEndpoints = Array.from(endpointStats.entries())
      .map(([endpoint, stats]) => ({
        endpoint,
        averageTime: stats.totalTime / stats.count,
        count: stats.count,
      }))
      .sort((a, b) => b.averageTime - a.averageTime)
      .slice(0, 5);

    // Database statistics
    const allQueries = filteredMetrics.flatMap(m => m.dbQueries);
    const totalQueries = allQueries.length;
    const averageQueryTime = totalQueries > 0 ?
      allQueries.reduce((sum, q) => sum + q.duration, 0) / totalQueries : 0;
    const slowQueries = allQueries.filter(q => q.duration > 1000).length;

    return {
      totalRequests,
      averageResponseTime,
      slowRequests,
      errorRate,
      topSlowEndpoints,
      databaseStats: {
        totalQueries,
        averageQueryTime,
        slowQueries,
      },
    };
  }

  /**
   * Get system health status
   */
  getHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical';
    checks: Array<{
      name: string;
      status: 'pass' | 'warn' | 'fail';
      message: string;
      value?: number;
      threshold?: number;
    }>;
  } {
    const stats = this.getPerformanceStats(5 * 60 * 1000); // Last 5 minutes
    const systemMetric = metricsStore.getLatestSystemMetric();
    
    const checks = [
      {
        name: 'Response Time',
        status: (stats.averageResponseTime < 1000 ? 'pass' : 
                stats.averageResponseTime < 3000 ? 'warn' : 'fail') as 'pass' | 'warn' | 'fail',
        message: `Average response time: ${stats.averageResponseTime.toFixed(2)}ms`,
        value: stats.averageResponseTime,
        threshold: 1000,
      },
      {
        name: 'Error Rate',
        status: (stats.errorRate < 1 ? 'pass' : 
                stats.errorRate < 5 ? 'warn' : 'fail') as 'pass' | 'warn' | 'fail',
        message: `Error rate: ${stats.errorRate.toFixed(2)}%`,
        value: stats.errorRate,
        threshold: 1,
      },
      {
        name: 'Memory Usage',
        status: (systemMetric && systemMetric.memoryUsage.heapUsed < 100 * 1024 * 1024 ? 'pass' : 
                systemMetric && systemMetric.memoryUsage.heapUsed < 200 * 1024 * 1024 ? 'warn' : 'fail') as 'pass' | 'warn' | 'fail',
        message: systemMetric ? 
          `Heap used: ${(systemMetric.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB` : 
          'No memory data available',
        value: systemMetric ? systemMetric.memoryUsage.heapUsed / 1024 / 1024 : undefined,
        threshold: 100,
      },
      {
        name: 'Active Requests',
        status: (this.activeRequests < 10 ? 'pass' : 
                this.activeRequests < 50 ? 'warn' : 'fail') as 'pass' | 'warn' | 'fail',
        message: `Active requests: ${this.activeRequests}`,
        value: this.activeRequests,
        threshold: 10,
      },
    ];

    const failedChecks = checks.filter(c => c.status === 'fail').length;
    const warningChecks = checks.filter(c => c.status === 'warn').length;

    const status = failedChecks > 0 ? 'critical' : 
                   warningChecks > 0 ? 'warning' : 'healthy';

    return { status, checks };
  }

  /**
   * Reset all metrics (for testing)
   */
  reset(): void {
    this.activeRequests = 0;
    this.totalRequests = 0;
    this.totalResponseTime = 0;
    this.totalErrors = 0;
    metricsStore.clear();
  }

  /**
   * Sanitize database query for logging
   */
  private sanitizeQuery(query: string): string {
    // Remove sensitive data from queries
    return query
      .replace(/password\s*=\s*'[^']*'/gi, "password='***'")
      .replace(/token\s*=\s*'[^']*'/gi, "token='***'")
      .substring(0, 200); // Limit length
  }
}

/**
 * Middleware to track request performance
 */
export function withPerformanceMonitoring<T>(
  handler: (request: NextRequest, context: any) => Promise<T>,
  options: { trackDbQueries?: boolean } = {}
) {
  return async (request: NextRequest, context: any): Promise<T> => {
    const monitor = PerformanceMonitor.getInstance();
    const url = new URL(request.url);
    
    // Start tracking
    const metric = monitor.startRequest(
      context.requestId,
      url.pathname,
      request.method,
      context.userId
    );

    try {
      const result = await handler(request, context);
      
      // End tracking with success
      monitor.endRequest(context.requestId, 200);
      
      return result;
    } catch (error) {
      // End tracking with error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      monitor.endRequest(context.requestId, 500, errorMessage);
      
      throw error;
    }
  };
}

/**
 * Database query tracker
 */
export function trackDatabaseQuery<T>(
  requestId: string,
  queryName: string,
  queryFn: () => Promise<T>
): Promise<T> {
  const monitor = PerformanceMonitor.getInstance();
  const startTime = Date.now();

  return queryFn()
    .then(result => {
      const duration = Date.now() - startTime;
      monitor.trackDatabaseQuery(requestId, queryName, duration, true);
      return result;
    })
    .catch(error => {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      monitor.trackDatabaseQuery(requestId, queryName, duration, false, errorMessage);
      throw error;
    });
}

/**
 * Performance benchmarks and alerts
 */
export class PerformanceAlerts {
  private static thresholds = {
    responseTime: 3000, // 3 seconds
    queryTime: 1000, // 1 second
    errorRate: 5, // 5%
    memoryUsage: 200 * 1024 * 1024, // 200MB
  };

  static checkThresholds(): Array<{
    type: 'response_time' | 'query_time' | 'error_rate' | 'memory_usage';
    severity: 'warning' | 'critical';
    message: string;
    value: number;
    threshold: number;
  }> {
    const monitor = PerformanceMonitor.getInstance();
    const stats = monitor.getPerformanceStats(5 * 60 * 1000); // Last 5 minutes
    const alerts = [];

    // Check response time
    if (stats.averageResponseTime > this.thresholds.responseTime) {
      alerts.push({
        type: 'response_time' as const,
        severity: stats.averageResponseTime > this.thresholds.responseTime * 2 ? 'critical' as const : 'warning' as const,
        message: `Average response time is ${stats.averageResponseTime.toFixed(2)}ms`,
        value: stats.averageResponseTime,
        threshold: this.thresholds.responseTime,
      });
    }

    // Check error rate
    if (stats.errorRate > this.thresholds.errorRate) {
      alerts.push({
        type: 'error_rate' as const,
        severity: stats.errorRate > this.thresholds.errorRate * 2 ? 'critical' as const : 'warning' as const,
        message: `Error rate is ${stats.errorRate.toFixed(2)}%`,
        value: stats.errorRate,
        threshold: this.thresholds.errorRate,
      });
    }

    // Check memory usage
    const memoryUsage = process.memoryUsage().heapUsed;
    if (memoryUsage > this.thresholds.memoryUsage) {
      alerts.push({
        type: 'memory_usage' as const,
        severity: memoryUsage > this.thresholds.memoryUsage * 2 ? 'critical' as const : 'warning' as const,
        message: `Memory usage is ${(memoryUsage / 1024 / 1024).toFixed(2)}MB`,
        value: memoryUsage,
        threshold: this.thresholds.memoryUsage,
      });
    }

    return alerts;
  }

  static setThresholds(newThresholds: Partial<typeof PerformanceAlerts.thresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
  }
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance();