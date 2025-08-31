/**
 * Production monitoring endpoint
 * Provides comprehensive health and performance metrics for production deployment
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCache } from '@/lib/cache';
import { getConnectionPool } from '@/lib/database/connection-pool';
import { getLogger } from '@/lib/monitoring/production-logger';
import { getCDNOptimizer } from '@/lib/cdn/optimization';
import { getProductionConfig, PerformanceThresholds } from '@/lib/config/production';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const logger = getLogger();
  const requestId = request.headers.get('x-request-id') || 'monitoring';
  
  try {
    logger.info('Production monitoring check started', {}, requestId);
    
    // Collect all metrics
    const [
      cacheStats,
      poolStats,
      loggerStats,
      systemStats
    ] = await Promise.all([
      getCacheMetrics(),
      getDatabaseMetrics(),
      getLoggerMetrics(),
      getSystemMetrics()
    ]);
    
    const duration = Date.now() - startTime;
    const config = getProductionConfig();
    
    // Determine overall health status
    const healthStatus = determineHealthStatus({
      cacheStats,
      poolStats,
      systemStats,
      duration,
      config
    });
    
    const response = {
      status: healthStatus,
      timestamp: new Date().toISOString(),
      duration,
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
      
      // Component health
      components: {
        cache: {
          status: cacheStats.utilizationPercent < 90 ? 'healthy' : 'warning',
          metrics: cacheStats
        },
        database: {
          status: poolStats.utilizationPercent < 80 ? 'healthy' : 'warning',
          metrics: poolStats
        },
        logging: {
          status: loggerStats.bufferSize < loggerStats.maxBufferSize * 0.8 ? 'healthy' : 'warning',
          metrics: loggerStats
        },
        system: {
          status: systemStats.memoryUsage < 0.8 ? 'healthy' : 'warning',
          metrics: systemStats
        }
      },
      
      // Performance metrics
      performance: {
        responseTime: duration,
        thresholds: PerformanceThresholds.API_RESPONSE_TIME,
        status: duration < PerformanceThresholds.API_RESPONSE_TIME.ACCEPTABLE ? 'good' : 'degraded'
      },
      
      // Configuration status
      configuration: {
        caching: config.cache.enabled,
        pooling: config.database.pooling.enabled,
        monitoring: config.monitoring.enabled,
        compression: config.cdn.enableCompression
      }
    };
    
    logger.info('Production monitoring check completed', {
      status: healthStatus,
      duration
    }, requestId);
    
    // Set appropriate cache headers
    const optimizer = getCDNOptimizer();
    const cacheHeaders = optimizer.getCacheHeaders('api');
    
    const nextResponse = NextResponse.json(response);
    Object.entries(cacheHeaders).forEach(([key, value]) => {
      if (value) {
        nextResponse.headers.set(key, value);
      }
    });
    
    return nextResponse;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('Production monitoring check failed', error as Error, {
      duration
    }, requestId);
    
    return NextResponse.json({
      status: 'critical',
      timestamp: new Date().toISOString(),
      duration,
      error: {
        message: 'Monitoring check failed',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      }
    }, { status: 500 });
  }
}

/**
 * Get cache metrics
 */
async function getCacheMetrics() {
  try {
    const cache = getCache();
    return cache.getStats();
  } catch (error) {
    return {
      totalEntries: 0,
      totalSize: 0,
      maxSize: 0,
      utilizationPercent: 0,
      expiredEntries: 0,
      error: 'Cache metrics unavailable'
    };
  }
}

/**
 * Get database connection pool metrics
 */
async function getDatabaseMetrics() {
  try {
    const pool = getConnectionPool();
    return pool.getStats();
  } catch (error) {
    return {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      waitingRequests: 0,
      maxConnections: 0,
      utilizationPercent: 0,
      error: 'Database metrics unavailable'
    };
  }
}

/**
 * Get logger metrics
 */
async function getLoggerMetrics() {
  try {
    const logger = getLogger();
    return logger.getStats();
  } catch (error) {
    return {
      bufferSize: 0,
      maxBufferSize: 0,
      levelCounts: {},
      flushInterval: 0,
      error: 'Logger metrics unavailable'
    };
  }
}

/**
 * Get system metrics
 */
async function getSystemMetrics() {
  try {
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    return {
      memoryUsage: memoryUsage.heapUsed / memoryUsage.heapTotal,
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      external: memoryUsage.external,
      uptime,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch
    };
  } catch (error) {
    return {
      memoryUsage: 0,
      heapUsed: 0,
      heapTotal: 0,
      external: 0,
      uptime: 0,
      error: 'System metrics unavailable'
    };
  }
}

/**
 * Determine overall health status
 */
function determineHealthStatus(metrics: {
  cacheStats: any;
  poolStats: any;
  systemStats: any;
  duration: number;
  config: any;
}): 'healthy' | 'warning' | 'critical' {
  const { cacheStats, poolStats, systemStats, duration, config } = metrics;
  
  // Critical conditions
  if (systemStats.memoryUsage > 0.95) return 'critical';
  if (duration > config.monitoring.alertThresholds.responseTime * 2) return 'critical';
  if (poolStats.utilizationPercent > 95) return 'critical';
  
  // Warning conditions
  if (systemStats.memoryUsage > config.monitoring.alertThresholds.memoryUsage) return 'warning';
  if (duration > config.monitoring.alertThresholds.responseTime) return 'warning';
  if (cacheStats.utilizationPercent > 90) return 'warning';
  if (poolStats.utilizationPercent > 80) return 'warning';
  
  return 'healthy';
}