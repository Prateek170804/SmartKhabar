/**
 * Production middleware for SmartKhabar
 * Handles caching, logging, performance monitoring, and security
 */

import { NextRequest, NextResponse } from 'next/server';
import { getLogger, generateRequestId } from '@/lib/monitoring/production-logger';
import { getCDNOptimizer } from '@/lib/cdn/optimization';

export function middleware(request: NextRequest) {
  const startTime = Date.now();
  const requestId = generateRequestId();
  const logger = getLogger();
  const optimizer = getCDNOptimizer();
  
  // Log incoming request
  logger.info('Incoming request', {
    method: request.method,
    url: request.url,
    userAgent: request.headers.get('user-agent'),
    ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
  }, requestId);
  
  // Create response
  const response = NextResponse.next();
  
  // Add request ID to response headers for tracking
  response.headers.set('x-request-id', requestId);
  
  // Add security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Add performance headers
  response.headers.set('X-Response-Time', `${Date.now() - startTime}ms`);
  
  // Handle API routes with specific caching
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const shouldCache = optimizer.shouldCache({
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      url: request.url
    });
    
    if (shouldCache) {
      // Determine cache type based on endpoint
      let cacheType: 'api' | 'dynamic' = 'api';
      
      if (request.nextUrl.pathname.includes('/personalized') ||
          request.nextUrl.pathname.includes('/preferences')) {
        cacheType = 'dynamic';
      }
      
      const cacheHeaders = optimizer.getCacheHeaders(cacheType);
      Object.entries(cacheHeaders).forEach(([key, value]) => {
        if (value) {
          response.headers.set(key, value);
        }
      });
    }
    
    // Add CORS headers for API routes
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  
  // Handle static assets
  if (request.nextUrl.pathname.startsWith('/_next/static/') ||
      request.nextUrl.pathname.startsWith('/_next/image/')) {
    const cacheHeaders = optimizer.getCacheHeaders('static');
    Object.entries(cacheHeaders).forEach(([key, value]) => {
      if (value) {
        response.headers.set(key, value);
      }
    });
  }
  
  // Add compression hint
  if (request.headers.get('accept-encoding')?.includes('gzip')) {
    response.headers.set('Vary', 'Accept-Encoding');
  }
  
  // Log response
  const duration = Date.now() - startTime;
  logger.logApiCall(
    request.method,
    request.nextUrl.pathname,
    response.status,
    duration,
    requestId
  );
  
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};