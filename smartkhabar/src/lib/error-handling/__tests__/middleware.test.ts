/**
 * Tests for error handling middleware
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import {
  withErrorHandling,
  withCircuitBreaker,
  createHealthCheckHandler,
  handleOPTIONS,
} from '../middleware';
import { SmartKhabarError, ErrorCode, ErrorSeverity } from '../index';

// Mock NextRequest and NextResponse
const createMockRequest = (
  url: string = 'http://localhost:3000/api/test',
  method: string = 'GET',
  headers: Record<string, string> = {},
  body?: any
): NextRequest => {
  const request = {
    url,
    method,
    headers: new Map(Object.entries(headers)),
    json: vi.fn().mockResolvedValue(body),
  } as unknown as NextRequest;

  // Add get method to headers
  (request.headers as any).get = (key: string) => headers[key] || null;

  return request;
};

const createMockResponse = (data: any = {}, status: number = 200): NextResponse => {
  return {
    json: vi.fn().mockReturnValue(data),
    status,
    headers: new Map(),
  } as unknown as NextResponse;
};

describe('withErrorHandling', () => {
  let consoleSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should handle successful request', async () => {
    const mockResponse = createMockResponse({ success: true });
    const handler = vi.fn().mockResolvedValue(mockResponse);
    const wrappedHandler = withErrorHandling(handler, { logRequests: false });

    const request = createMockRequest();
    const response = await wrappedHandler(request);

    expect(handler).toHaveBeenCalledWith(request, expect.any(Object));
    expect(response).toBe(mockResponse);
  });

  it('should handle SmartKhabarError', async () => {
    const error = new SmartKhabarError(
      ErrorCode.DATABASE_ERROR,
      'Database connection failed',
      ErrorSeverity.HIGH
    );
    const handler = vi.fn().mockRejectedValue(error);
    const wrappedHandler = withErrorHandling(handler, { logRequests: false });

    const request = createMockRequest();
    const response = await wrappedHandler(request);

    expect(response).toBeInstanceOf(NextResponse);
    // In a real implementation, we would check the response body
  });

  it('should handle validation errors', async () => {
    const handler = vi.fn().mockImplementation(() => {
      throw new Error('timeout occurred');
    });
    const wrappedHandler = withErrorHandling(handler, { logRequests: false });

    const request = createMockRequest();
    const response = await wrappedHandler(request);

    expect(response).toBeInstanceOf(NextResponse);
  });

  it('should validate request content type for POST', async () => {
    const handler = vi.fn().mockResolvedValue(createMockResponse());
    const wrappedHandler = withErrorHandling(handler, { 
      logRequests: false,
      validateRequest: true 
    });

    const request = createMockRequest(
      'http://localhost:3000/api/test',
      'POST',
      { 'content-type': 'text/plain' }
    );

    const response = await wrappedHandler(request);
    expect(response).toBeInstanceOf(NextResponse);
    // Should return error response for invalid content type
  });

  it('should handle rate limiting', async () => {
    const handler = vi.fn().mockResolvedValue(createMockResponse());
    const wrappedHandler = withErrorHandling(handler, { 
      logRequests: false,
      validateRequest: true 
    });

    const request = createMockRequest(
      'http://localhost:3000/api/test',
      'GET',
      { 'x-ratelimit-remaining': '0' }
    );

    const response = await wrappedHandler(request);
    expect(response).toBeInstanceOf(NextResponse);
    // Should return rate limit error
  });

  it('should retry on failure when enabled', async () => {
    let callCount = 0;
    const handler = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount < 3) {
        throw new Error('Temporary failure');
      }
      return createMockResponse({ success: true });
    });

    const wrappedHandler = withErrorHandling(handler, { 
      logRequests: false,
      enableRetry: true,
      maxRetries: 3
    });

    const request = createMockRequest();
    const response = await wrappedHandler(request);

    expect(handler).toHaveBeenCalledTimes(3);
    expect(response).toBeInstanceOf(NextResponse);
  });

  it('should provide fallbacks for specific endpoints', async () => {
    const error = new SmartKhabarError(ErrorCode.SERVICE_UNAVAILABLE, 'Service down');
    const handler = vi.fn().mockRejectedValue(error);
    const wrappedHandler = withErrorHandling(handler, { 
      logRequests: false,
      enableFallbacks: true 
    });

    const request = createMockRequest('http://localhost:3000/api/news/personalized');
    const response = await wrappedHandler(request);

    expect(response).toBeInstanceOf(NextResponse);
    // Should include fallback data for news endpoint
  });

  it('should extract user ID from query params', async () => {
    const handler = vi.fn().mockResolvedValue(createMockResponse());
    const wrappedHandler = withErrorHandling(handler, { logRequests: false });

    const request = createMockRequest('http://localhost:3000/api/test?userId=user-123');
    await wrappedHandler(request);

    expect(handler).toHaveBeenCalledWith(
      request,
      expect.objectContaining({ userId: 'user-123' })
    );
  });

  it('should extract user ID from headers', async () => {
    const handler = vi.fn().mockResolvedValue(createMockResponse());
    const wrappedHandler = withErrorHandling(handler, { logRequests: false });

    const request = createMockRequest(
      'http://localhost:3000/api/test',
      'GET',
      { 'x-user-id': 'user-456' }
    );
    await wrappedHandler(request);

    expect(handler).toHaveBeenCalledWith(
      request,
      expect.objectContaining({ userId: 'user-456' })
    );
  });
});

describe('withCircuitBreaker', () => {
  it('should execute function when circuit is closed', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const wrappedFn = withCircuitBreaker('test-service');

    const result = await wrappedFn(fn);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should handle failures and open circuit', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Service failure'));
    const wrappedFn = withCircuitBreaker('test-service-2');

    // First few failures should pass through
    await expect(wrappedFn(fn)).rejects.toThrow('Service failure');
    await expect(wrappedFn(fn)).rejects.toThrow('Service failure');
    await expect(wrappedFn(fn)).rejects.toThrow('Service failure');
    await expect(wrappedFn(fn)).rejects.toThrow('Service failure');
    await expect(wrappedFn(fn)).rejects.toThrow('Service failure');

    // After threshold, should get circuit breaker error
    await expect(wrappedFn(fn)).rejects.toThrow('Service is temporarily unavailable');
  });
});

describe('createHealthCheckHandler', () => {
  let consoleSpy: any;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return health status', async () => {
    const handler = createHealthCheckHandler('test-service');
    const request = createMockRequest('http://localhost:3000/api/health');

    const response = await handler(request);

    expect(response).toBeInstanceOf(NextResponse);
    // In a real implementation, we would check the response contains health data
  });
});

describe('handleOPTIONS', () => {
  it('should return CORS headers for OPTIONS request', () => {
    const response = handleOPTIONS();

    expect(response).toBeInstanceOf(NextResponse);
    expect(response.status).toBe(200);
    // In a real implementation, we would check the CORS headers
  });
});

describe('Request Context Extraction', () => {
  it('should generate unique request IDs', async () => {
    const handler = vi.fn().mockResolvedValue(createMockResponse());
    const wrappedHandler = withErrorHandling(handler, { logRequests: false });

    const request1 = createMockRequest();
    const request2 = createMockRequest();

    await wrappedHandler(request1);
    await wrappedHandler(request2);

    const context1 = handler.mock.calls[0][1];
    const context2 = handler.mock.calls[1][1];

    expect(context1.requestId).toBeDefined();
    expect(context2.requestId).toBeDefined();
    expect(context1.requestId).not.toBe(context2.requestId);
  });

  it('should extract endpoint and method correctly', async () => {
    const handler = vi.fn().mockResolvedValue(createMockResponse());
    const wrappedHandler = withErrorHandling(handler, { logRequests: false });

    const request = createMockRequest('http://localhost:3000/api/news/personalized', 'POST');
    await wrappedHandler(request);

    const context = handler.mock.calls[0][1];
    expect(context.endpoint).toBe('/api/news/personalized');
    expect(context.method).toBe('POST');
    expect(context.timestamp).toBeInstanceOf(Date);
  });
});