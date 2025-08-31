/**
 * Error handling middleware for API routes
 * Provides consistent error handling across all endpoints
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { 
  SmartKhabarError, 
  ErrorCode, 
  ErrorSeverity,
  createNextErrorResponse,
  withRetry,
  CircuitBreaker,
  logError
} from './index';
import { FallbackData } from '@/types';

// Request context for error handling
export interface RequestContext {
  userId?: string;
  endpoint: string;
  method: string;
  timestamp: Date;
  requestId: string;
}

// Middleware configuration
export interface MiddlewareConfig {
  enableRetry: boolean;
  maxRetries: number;
  enableCircuitBreaker: boolean;
  enableFallbacks: boolean;
  logRequests: boolean;
  validateRequest: boolean;
}

const defaultConfig: MiddlewareConfig = {
  enableRetry: true,
  maxRetries: 3,
  enableCircuitBreaker: true,
  enableFallbacks: true,
  logRequests: true,
  validateRequest: true,
};

// Circuit breakers for different services
const circuitBreakers = new Map<string, CircuitBreaker>();

/**
 * Get or create circuit breaker for a service
 */
function getCircuitBreaker(serviceName: string): CircuitBreaker {
  if (!circuitBreakers.has(serviceName)) {
    circuitBreakers.set(serviceName, new CircuitBreaker());
  }
  return circuitBreakers.get(serviceName)!;
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Extract request context
 */
function extractRequestContext(request: NextRequest): RequestContext {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId') || 
                 request.headers.get('x-user-id') || 
                 undefined;

  return {
    userId,
    endpoint: url.pathname,
    method: request.method,
    timestamp: new Date(),
    requestId: generateRequestId(),
  };
}

/**
 * Validate request based on method and endpoint
 */
function validateRequest(request: NextRequest, context: RequestContext): void {
  // Check for required headers
  const contentType = request.headers.get('content-type');
  
  if (['POST', 'PUT', 'PATCH'].includes(context.method)) {
    if (!contentType || !contentType.includes('application/json')) {
      throw new SmartKhabarError(
        ErrorCode.INVALID_REQUEST,
        'Content-Type must be application/json for this request',
        ErrorSeverity.LOW,
        { method: context.method, contentType }
      );
    }
  }

  // Check for rate limiting headers (if implemented)
  const rateLimitRemaining = request.headers.get('x-ratelimit-remaining');
  if (rateLimitRemaining === '0') {
    throw new SmartKhabarError(
      ErrorCode.RATE_LIMIT_EXCEEDED,
      'Rate limit exceeded. Please try again later.',
      ErrorSeverity.MEDIUM,
      { endpoint: context.endpoint }
    );
  }
}

/**
 * Log request details
 */
function logRequest(context: RequestContext, duration?: number, error?: Error): void {
  const logData = {
    requestId: context.requestId,
    endpoint: context.endpoint,
    method: context.method,
    userId: context.userId,
    timestamp: context.timestamp.toISOString(),
    duration,
    error: error ? {
      message: error.message,
      code: error instanceof SmartKhabarError ? error.code : 'UNKNOWN',
    } : undefined,
  };

  if (process.env.NODE_ENV === 'development') {
    console.log('API Request:', logData);
  } else {
    // Send to logging service
    console.log(JSON.stringify(logData));
  }
}

/**
 * Main error handling middleware
 */
export function withErrorHandling<T>(
  handler: (request: NextRequest, context: RequestContext) => Promise<NextResponse>,
  config: Partial<MiddlewareConfig> = {}
) {
  const finalConfig = { ...defaultConfig, ...config };

  return async (request: NextRequest): Promise<NextResponse> => {
    const startTime = Date.now();
    const context = extractRequestContext(request);
    let error: Error | undefined;

    try {
      // Validate request if enabled
      if (finalConfig.validateRequest) {
        validateRequest(request, context);
      }

      // Execute handler with retry if enabled
      let response: NextResponse;
      
      if (finalConfig.enableRetry) {
        response = await withRetry(
          () => handler(request, context),
          finalConfig.maxRetries
        );
      } else {
        response = await handler(request, context);
      }

      // Log successful request
      if (finalConfig.logRequests) {
        logRequest(context, Date.now() - startTime);
      }

      return response;

    } catch (err) {
      error = err as Error;
      
      // Log error request
      if (finalConfig.logRequests) {
        logRequest(context, Date.now() - startTime, error);
      }

      // Handle different types of errors
      return handleError(error, context, finalConfig);
    }
  };
}

/**
 * Handle specific error types and create appropriate responses
 */
function handleError(
  error: Error,
  context: RequestContext,
  config: MiddlewareConfig
): NextResponse {
  // Handle validation errors
  if (error instanceof z.ZodError) {
    return createNextErrorResponse(
      new SmartKhabarError(
        ErrorCode.VALIDATION_ERROR,
        'Request validation failed',
        ErrorSeverity.LOW,
        { errors: error.errors, endpoint: context.endpoint }
      )
    );
  }

  // Handle SmartKhabar errors
  if (error instanceof SmartKhabarError) {
    const fallback = config.enableFallbacks ? 
      getFallbackForError(error, context) : 
      undefined;
    
    return createNextErrorResponse(error, fallback);
  }

  // Handle timeout errors
  if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
    const timeoutError = new SmartKhabarError(
      ErrorCode.TIMEOUT_ERROR,
      'Request timed out',
      ErrorSeverity.MEDIUM,
      { endpoint: context.endpoint, originalError: error.message }
    );
    
    const fallback = config.enableFallbacks ? 
      getFallbackForError(timeoutError, context) : 
      undefined;
    
    return createNextErrorResponse(timeoutError, fallback);
  }

  // Handle network errors
  if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
    const networkError = new SmartKhabarError(
      ErrorCode.SERVICE_UNAVAILABLE,
      'External service unavailable',
      ErrorSeverity.HIGH,
      { endpoint: context.endpoint, originalError: error.message }
    );
    
    const fallback = config.enableFallbacks ? 
      getFallbackForError(networkError, context) : 
      undefined;
    
    return createNextErrorResponse(networkError, fallback);
  }

  // Handle generic errors
  const genericError = new SmartKhabarError(
    ErrorCode.INTERNAL_ERROR,
    'An unexpected error occurred',
    ErrorSeverity.HIGH,
    { 
      endpoint: context.endpoint, 
      originalError: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }
  );

  const fallback = config.enableFallbacks ? 
    getFallbackForError(genericError, context) : 
    undefined;

  return createNextErrorResponse(genericError, fallback);
}

/**
 * Get appropriate fallback data for error
 */
function getFallbackForError(error: SmartKhabarError, context: RequestContext): FallbackData | undefined {
  const endpoint = context.endpoint;

  // News feed endpoints
  if (endpoint.includes('/news/personalized')) {
    return {
      type: 'default_feed',
      data: {
        summaries: [],
        message: 'Unable to load personalized content. Please try again later.',
      },
      message: 'Personalized feed unavailable',
    };
  }

  // Summary endpoints
  if (endpoint.includes('/articles/summary')) {
    return {
      type: 'excerpt',
      data: {
        message: 'Summary generation is temporarily unavailable.',
      },
      message: 'Summary service unavailable',
    };
  }

  // Preferences endpoints
  if (endpoint.includes('/preferences')) {
    return {
      type: 'default_feed',
      data: {
        preferences: {
          userId: context.userId || 'unknown',
          topics: ['general'],
          tone: 'casual',
          readingTime: 5,
          preferredSources: [],
          excludedSources: [],
          lastUpdated: new Date(),
        },
        message: 'Using default preferences.',
      },
      message: 'Preferences service unavailable',
    };
  }

  return undefined;
}

/**
 * Middleware for service-specific circuit breakers
 */
export function withCircuitBreaker(serviceName: string) {
  return function<T>(
    fn: () => Promise<T>
  ): Promise<T> {
    const circuitBreaker = getCircuitBreaker(serviceName);
    return circuitBreaker.execute(fn);
  };
}

/**
 * Health check middleware
 */
export function createHealthCheckHandler(serviceName: string) {
  return withErrorHandling(async (request: NextRequest, context: RequestContext) => {
    const circuitBreaker = getCircuitBreaker(serviceName);
    const health = {
      service: serviceName,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      circuitBreakerState: circuitBreaker.getState(),
      requestId: context.requestId,
    };

    return NextResponse.json(health);
  });
}

/**
 * Middleware to add request ID to response headers
 */
export function addRequestIdHeader(response: NextResponse, requestId: string): NextResponse {
  response.headers.set('x-request-id', requestId);
  return response;
}

/**
 * Middleware for CORS handling with error support
 */
export function withCORS(
  handler: (request: NextRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const response = await handler(request);
      
      // Add CORS headers
      response.headers.set('Access-Control-Allow-Origin', '*');
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id');
      
      return response;
    } catch (error) {
      // Even error responses should have CORS headers
      const errorResponse = createNextErrorResponse(error as Error);
      errorResponse.headers.set('Access-Control-Allow-Origin', '*');
      errorResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      errorResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id');
      
      return errorResponse;
    }
  };
}

/**
 * OPTIONS handler for CORS preflight
 */
export function handleOPTIONS(): NextResponse {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-id',
    },
  });
}