/**
 * Performance Monitoring Utilities for E2E Tests
 * 
 * Provides utilities to monitor and validate performance metrics
 * during end-to-end testing, specifically for requirements 8.2 and 8.3
 */

import { Page, Request, Response } from '@playwright/test';

export interface PerformanceMetrics {
  responseTime: number;
  memoryUsage?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
  networkRequests: NetworkMetric[];
  coreWebVitals?: CoreWebVitals;
}

export interface NetworkMetric {
  url: string;
  method: string;
  status: number;
  responseTime: number;
  size?: number;
}

export interface CoreWebVitals {
  lcp?: number; // Largest Contentful Paint
  fid?: number; // First Input Delay
  cls?: number; // Cumulative Layout Shift
  fcp?: number; // First Contentful Paint
}

export interface LoadTestResult {
  userId: number;
  success: boolean;
  responseTime: number;
  error?: string;
  metrics?: PerformanceMetrics;
}

/**
 * Performance Monitor class for tracking metrics during tests
 */
export class PerformanceMonitor {
  private networkRequests: NetworkMetric[] = [];
  private startTime: number = 0;

  constructor(private page: Page) {
    this.setupNetworkMonitoring();
  }

  /**
   * Start monitoring performance
   */
  start(): void {
    this.startTime = Date.now();
    this.networkRequests = [];
  }

  /**
   * Setup network request monitoring
   */
  private setupNetworkMonitoring(): void {
    this.page.on('request', (request: Request) => {
      const startTime = Date.now();
      
      this.page.on('response', (response: Response) => {
        if (response.request() === request) {
          const responseTime = Date.now() - startTime;
          const contentLength = response.headers()['content-length'];
          
          this.networkRequests.push({
            url: request.url(),
            method: request.method(),
            status: response.status(),
            responseTime,
            size: contentLength ? parseInt(contentLength) : undefined
          });
        }
      });
    });
  }

  /**
   * Get current performance metrics
   */
  async getMetrics(): Promise<PerformanceMetrics> {
    const responseTime = Date.now() - this.startTime;
    
    // Get memory usage
    const memoryUsage = await this.page.evaluate(() => {
      return (performance as any).memory ? {
        usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
        totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
        jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
      } : undefined;
    });

    // Get Core Web Vitals
    const coreWebVitals = await this.getCoreWebVitals();

    return {
      responseTime,
      memoryUsage,
      networkRequests: [...this.networkRequests],
      coreWebVitals
    };
  }

  /**
   * Get Core Web Vitals metrics
   */
  private async getCoreWebVitals(): Promise<CoreWebVitals> {
    return await this.page.evaluate(() => {
      return new Promise<CoreWebVitals>((resolve) => {
        const vitals: CoreWebVitals = {};
        
        // Largest Contentful Paint (LCP)
        try {
          new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];
            vitals.lcp = lastEntry.startTime;
          }).observe({ entryTypes: ['largest-contentful-paint'] });
        } catch (e) {
          // LCP not supported
        }
        
        // First Input Delay (FID) - will be 0 in automated tests
        vitals.fid = 0;
        
        // Cumulative Layout Shift (CLS)
        try {
          let clsValue = 0;
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (!(entry as any).hadRecentInput) {
                clsValue += (entry as any).value;
              }
            }
            vitals.cls = clsValue;
          }).observe({ entryTypes: ['layout-shift'] });
        } catch (e) {
          // CLS not supported
        }
        
        // First Contentful Paint (FCP)
        try {
          new PerformanceObserver((list) => {
            const entries = list.getEntries();
            vitals.fcp = entries[0].startTime;
          }).observe({ entryTypes: ['paint'] });
        } catch (e) {
          // FCP not supported
        }
        
        setTimeout(() => resolve(vitals), 2000);
      });
    });
  }

  /**
   * Validate response time against requirement 8.2 (3 seconds)
   */
  validateResponseTime(responseTime: number, operation: string = 'operation'): boolean {
    const requirement = 3000; // 3 seconds in milliseconds
    const isValid = responseTime < requirement;
    
    if (!isValid) {
      console.warn(`⚠️  ${operation} took ${responseTime}ms, exceeding requirement 8.2 (${requirement}ms)`);
    }
    
    return isValid;
  }

  /**
   * Get API response times for specific endpoints
   */
  getAPIResponseTimes(endpointPattern: string): NetworkMetric[] {
    return this.networkRequests.filter(req => 
      req.url.includes('/api/') && 
      req.url.includes(endpointPattern)
    );
  }

  /**
   * Calculate network performance statistics
   */
  getNetworkStats(): {
    totalRequests: number;
    avgResponseTime: number;
    maxResponseTime: number;
    minResponseTime: number;
    totalDataTransferred: number;
  } {
    if (this.networkRequests.length === 0) {
      return {
        totalRequests: 0,
        avgResponseTime: 0,
        maxResponseTime: 0,
        minResponseTime: 0,
        totalDataTransferred: 0
      };
    }

    const responseTimes = this.networkRequests.map(req => req.responseTime);
    const sizes = this.networkRequests
      .map(req => req.size || 0)
      .filter(size => size > 0);

    return {
      totalRequests: this.networkRequests.length,
      avgResponseTime: responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length,
      maxResponseTime: Math.max(...responseTimes),
      minResponseTime: Math.min(...responseTimes),
      totalDataTransferred: sizes.reduce((sum, size) => sum + size, 0)
    };
  }
}

/**
 * Utility function to simulate concurrent users for load testing
 */
export async function simulateConcurrentUsers(
  userCount: number,
  userAction: (userId: number) => Promise<LoadTestResult>,
  options: {
    batchSize?: number;
    batchDelay?: number;
  } = {}
): Promise<LoadTestResult[]> {
  const { batchSize = 20, batchDelay = 1000 } = options;
  const batches = Math.ceil(userCount / batchSize);
  const allResults: LoadTestResult[] = [];

  console.log(`Simulating ${userCount} concurrent users in ${batches} batches of ${batchSize}`);

  for (let batch = 0; batch < batches; batch++) {
    const currentBatchSize = Math.min(batchSize, userCount - (batch * batchSize));
    console.log(`Processing batch ${batch + 1}/${batches} with ${currentBatchSize} users`);

    const batchPromises = Array.from({ length: currentBatchSize }, (_, index) => {
      const globalUserId = (batch * batchSize) + index;
      return userAction(globalUserId);
    });

    const batchResults = await Promise.all(batchPromises);
    allResults.push(...batchResults);

    // Brief pause between batches
    if (batch < batches - 1) {
      await new Promise(resolve => setTimeout(resolve, batchDelay));
    }
  }

  return allResults;
}

/**
 * Analyze load test results and validate against requirements
 */
export function analyzeLoadTestResults(
  results: LoadTestResult[],
  requirements: {
    minSuccessRate?: number;
    maxAvgResponseTime?: number;
    maxResponseTime?: number;
  } = {}
): {
  summary: {
    totalUsers: number;
    successfulUsers: number;
    failedUsers: number;
    successRate: number;
    avgResponseTime: number;
    maxResponseTime: number;
    minResponseTime: number;
  };
  meetsRequirements: boolean;
  issues: string[];
} {
  const {
    minSuccessRate = 90,
    maxAvgResponseTime = 3000, // Requirement 8.2
    maxResponseTime = 5000
  } = requirements;

  const successfulResults = results.filter(r => r.success);
  const failedResults = results.filter(r => !r.success);
  
  const responseTimes = successfulResults.map(r => r.responseTime);
  const avgResponseTime = responseTimes.length > 0 
    ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
    : 0;
  
  const summary = {
    totalUsers: results.length,
    successfulUsers: successfulResults.length,
    failedUsers: failedResults.length,
    successRate: (successfulResults.length / results.length) * 100,
    avgResponseTime,
    maxResponseTime: responseTimes.length > 0 ? Math.max(...responseTimes) : 0,
    minResponseTime: responseTimes.length > 0 ? Math.min(...responseTimes) : 0
  };

  const issues: string[] = [];
  let meetsRequirements = true;

  // Check success rate
  if (summary.successRate < minSuccessRate) {
    issues.push(`Success rate ${summary.successRate.toFixed(1)}% below minimum ${minSuccessRate}%`);
    meetsRequirements = false;
  }

  // Check average response time (Requirement 8.2)
  if (summary.avgResponseTime > maxAvgResponseTime) {
    issues.push(`Average response time ${summary.avgResponseTime}ms exceeds requirement 8.2 (${maxAvgResponseTime}ms)`);
    meetsRequirements = false;
  }

  // Check maximum response time
  if (summary.maxResponseTime > maxResponseTime) {
    issues.push(`Maximum response time ${summary.maxResponseTime}ms exceeds limit (${maxResponseTime}ms)`);
    meetsRequirements = false;
  }

  return {
    summary,
    meetsRequirements,
    issues
  };
}

/**
 * Performance test assertion helpers
 */
export const performanceAssertions = {
  /**
   * Assert response time meets requirement 8.2
   */
  responseTimeWithin3Seconds: (responseTime: number, operation: string = 'Operation') => {
    if (responseTime >= 3000) {
      throw new Error(`${operation} took ${responseTime}ms, violating requirement 8.2 (must be < 3000ms)`);
    }
  },

  /**
   * Assert success rate for concurrent users (requirement 8.3)
   */
  concurrentUserSuccessRate: (successfulUsers: number, totalUsers: number, minRate: number = 0.8) => {
    const successRate = successfulUsers / totalUsers;
    if (successRate < minRate) {
      throw new Error(`Success rate ${(successRate * 100).toFixed(1)}% below minimum ${(minRate * 100)}% for ${totalUsers} concurrent users`);
    }
  },

  /**
   * Assert memory usage is reasonable
   */
  memoryUsageReasonable: (memoryMB: number, maxMemoryMB: number = 200) => {
    if (memoryMB > maxMemoryMB) {
      throw new Error(`Memory usage ${memoryMB.toFixed(1)}MB exceeds limit ${maxMemoryMB}MB`);
    }
  }
};