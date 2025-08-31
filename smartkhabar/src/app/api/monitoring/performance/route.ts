/**
 * Performance monitoring API endpoints
 * Provides access to performance metrics and system health
 */

import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandling } from '@/lib/error-handling/middleware';
import { performanceMonitor, PerformanceAlerts } from '@/lib/monitoring/performance';
import { databaseOptimizer } from '@/lib/monitoring/database-optimizer';

/**
 * GET /api/monitoring/performance
 * Returns current performance statistics
 */
export const GET = withErrorHandling(async (request: NextRequest, context) => {
  const url = new URL(request.url);
  const timeWindow = url.searchParams.get('timeWindow');
  const windowMs = timeWindow ? parseInt(timeWindow) * 1000 : undefined;

  // Get performance statistics
  const stats = performanceMonitor.getPerformanceStats(windowMs);
  const systemMetrics = performanceMonitor.getCurrentSystemMetrics();
  const healthStatus = performanceMonitor.getHealthStatus();
  const alerts = PerformanceAlerts.checkThresholds();
  const dbStats = databaseOptimizer.getStats();

  const response = {
    success: true,
    data: {
      timestamp: new Date().toISOString(),
      timeWindow: windowMs ? `${windowMs / 1000}s` : 'all',
      performance: stats,
      system: systemMetrics,
      health: healthStatus,
      alerts,
      database: dbStats,
    },
  };

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': 'no-cache',
      'x-request-id': context.requestId,
    },
  });
}, {
  enableFallbacks: false,
  logRequests: false, // Don't log monitoring requests to avoid noise
});

/**
 * POST /api/monitoring/performance/reset
 * Reset performance metrics (for testing/debugging)
 */
export const POST = withErrorHandling(async (request: NextRequest, context) => {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Metrics reset not allowed in production',
        },
      },
      { status: 403 }
    );
  }

  performanceMonitor.reset();

  return NextResponse.json({
    success: true,
    data: {
      message: 'Performance metrics reset successfully',
      timestamp: new Date().toISOString(),
    },
  });
}, {
  enableFallbacks: false,
  logRequests: false,
});