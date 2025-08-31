/**
 * Tests for error handling system
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import {
  SmartKhabarError,
  ValidationError,
  DatabaseError,
  ExternalAPIError,
  SummarizationError,
  ErrorCode,
  ErrorSeverity,
  formatErrorResponse,
  createErrorResponse,
  getStatusCodeForError,
  withRetry,
  CircuitBreaker,
} from '../index';

describe('SmartKhabarError', () => {
  it('should create error with all properties', () => {
    const context = { userId: 'test-user' };
    const error = new SmartKhabarError(
      ErrorCode.DATABASE_ERROR,
      'Database connection failed',
      ErrorSeverity.HIGH,
      context,
      'Please try again later'
    );

    expect(error.code).toBe(ErrorCode.DATABASE_ERROR);
    expect(error.message).toBe('Database connection failed');
    expect(error.severity).toBe(ErrorSeverity.HIGH);
    expect(error.context).toEqual(context);
    expect(error.userMessage).toBe('Please try again later');
    expect(error.timestamp).toBeInstanceOf(Date);
  });

  it('should use default severity', () => {
    const error = new SmartKhabarError(
      ErrorCode.INTERNAL_ERROR,
      'Something went wrong'
    );

    expect(error.severity).toBe(ErrorSeverity.MEDIUM);
  });
});

describe('Specific Error Classes', () => {
  it('should create ValidationError correctly', () => {
    const details = { field: 'email', message: 'Invalid format' };
    const error = new ValidationError('Validation failed', details);

    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(error.severity).toBe(ErrorSeverity.LOW);
    expect(error.context?.details).toEqual(details);
    expect(error.userMessage).toBe('Please check your input and try again.');
  });

  it('should create DatabaseError correctly', () => {
    const error = new DatabaseError('Connection timeout');

    expect(error.code).toBe(ErrorCode.DATABASE_ERROR);
    expect(error.severity).toBe(ErrorSeverity.HIGH);
    expect(error.userMessage).toBe('We are experiencing technical difficulties. Please try again later.');
  });

  it('should create ExternalAPIError correctly', () => {
    const error = new ExternalAPIError('NewsAPI', 'Rate limit exceeded');

    expect(error.code).toBe(ErrorCode.EXTERNAL_API_ERROR);
    expect(error.message).toBe('NewsAPI: Rate limit exceeded');
    expect(error.context?.service).toBe('NewsAPI');
  });

  it('should create SummarizationError correctly', () => {
    const error = new SummarizationError('Model unavailable');

    expect(error.code).toBe(ErrorCode.SUMMARIZATION_ERROR);
    expect(error.severity).toBe(ErrorSeverity.MEDIUM);
  });
});

describe('formatErrorResponse', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should format SmartKhabarError correctly', () => {
    const error = new SmartKhabarError(
      ErrorCode.DATABASE_ERROR,
      'Database failed',
      ErrorSeverity.HIGH,
      { table: 'users' },
      'Service temporarily unavailable'
    );

    const response = formatErrorResponse(error, { logErrors: false });

    expect(response.error.code).toBe(ErrorCode.DATABASE_ERROR);
    expect(response.error.message).toBe('Service temporarily unavailable');
    expect(response.error.details).toEqual({ table: 'users' });
  });

  it('should format ZodError correctly', () => {
    const schema = z.object({ name: z.string() });
    let zodError: z.ZodError;
    
    try {
      schema.parse({ name: 123 });
    } catch (error) {
      zodError = error as z.ZodError;
    }

    const response = formatErrorResponse(zodError!, { logErrors: false });

    expect(response.error.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(response.error.message).toBe('Please check your input and try again.');
    expect(response.error.details).toBeDefined();
  });

  it('should format generic Error correctly', () => {
    const error = new Error('Something went wrong');
    const response = formatErrorResponse(error, { 
      logErrors: false,
      sanitizeDetails: false,
      includeStackTrace: true
    });

    expect(response.error.code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(response.error.message).toBe('An unexpected error occurred. Please try again later.');
    expect(response.error.details).toBeDefined();
  });

  it('should sanitize details in production', () => {
    const error = new SmartKhabarError(
      ErrorCode.INTERNAL_ERROR,
      'Internal error',
      ErrorSeverity.HIGH,
      { sensitive: 'data' }
    );

    const response = formatErrorResponse(error, { 
      logErrors: false,
      sanitizeDetails: true 
    });

    expect(response.error.details).toBeUndefined();
  });
});

describe('createErrorResponse', () => {
  it('should create error response with fallback', () => {
    const error = new DatabaseError('Connection failed');
    const fallback = {
      type: 'cached_content' as const,
      data: { cached: true },
    };

    const response = createErrorResponse(error, fallback, { logErrors: false });

    expect(response.success).toBe(false);
    expect(response.error.code).toBe(ErrorCode.DATABASE_ERROR);
    expect(response.fallback).toEqual(fallback);
  });
});

describe('getStatusCodeForError', () => {
  it('should return correct status codes for SmartKhabarError', () => {
    expect(getStatusCodeForError(new SmartKhabarError(ErrorCode.VALIDATION_ERROR, 'test'))).toBe(400);
    expect(getStatusCodeForError(new SmartKhabarError(ErrorCode.UNAUTHORIZED, 'test'))).toBe(401);
    expect(getStatusCodeForError(new SmartKhabarError(ErrorCode.FORBIDDEN, 'test'))).toBe(403);
    expect(getStatusCodeForError(new SmartKhabarError(ErrorCode.NOT_FOUND, 'test'))).toBe(404);
    expect(getStatusCodeForError(new SmartKhabarError(ErrorCode.ALREADY_EXISTS, 'test'))).toBe(409);
    expect(getStatusCodeForError(new SmartKhabarError(ErrorCode.RATE_LIMIT_EXCEEDED, 'test'))).toBe(429);
    expect(getStatusCodeForError(new SmartKhabarError(ErrorCode.SERVICE_UNAVAILABLE, 'test'))).toBe(503);
    expect(getStatusCodeForError(new SmartKhabarError(ErrorCode.TIMEOUT_ERROR, 'test'))).toBe(504);
    expect(getStatusCodeForError(new SmartKhabarError(ErrorCode.INTERNAL_ERROR, 'test'))).toBe(500);
  });

  it('should return 400 for ZodError', () => {
    const schema = z.string();
    try {
      schema.parse(123);
    } catch (error) {
      expect(getStatusCodeForError(error as z.ZodError)).toBe(400);
    }
  });

  it('should return 500 for generic Error', () => {
    const error = new Error('Generic error');
    expect(getStatusCodeForError(error)).toBe(500);
  });
});

describe('withRetry', () => {
  it('should succeed on first attempt', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await withRetry(fn, 3);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and eventually succeed', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success');

    const result = await withRetry(fn, 3, 10); // Short delay for testing

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should throw after max retries', async () => {
    const error = new Error('persistent failure');
    const fn = vi.fn().mockRejectedValue(error);

    await expect(withRetry(fn, 2, 10)).rejects.toThrow('persistent failure');
    expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });
});

describe('CircuitBreaker', () => {
  it('should allow requests when closed', async () => {
    const circuitBreaker = new CircuitBreaker(3, 60000, 30000);
    const fn = vi.fn().mockResolvedValue('success');

    const result = await circuitBreaker.execute(fn);

    expect(result).toBe('success');
    expect(circuitBreaker.getState()).toBe('closed');
  });

  it('should open after threshold failures', async () => {
    const circuitBreaker = new CircuitBreaker(2, 60000, 30000);
    const fn = vi.fn().mockRejectedValue(new Error('failure'));

    // First two failures
    await expect(circuitBreaker.execute(fn)).rejects.toThrow('failure');
    await expect(circuitBreaker.execute(fn)).rejects.toThrow('failure');

    expect(circuitBreaker.getState()).toBe('open');

    // Third attempt should be rejected by circuit breaker
    await expect(circuitBreaker.execute(fn)).rejects.toThrow('Service is temporarily unavailable');
  });

  it('should reset to closed after successful execution in half-open state', async () => {
    const circuitBreaker = new CircuitBreaker(1, 60000, 0); // Immediate reset
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('failure'))
      .mockResolvedValue('success');

    // Cause failure to open circuit
    await expect(circuitBreaker.execute(fn)).rejects.toThrow('failure');
    expect(circuitBreaker.getState()).toBe('open');

    // Wait for reset timeout (0ms in test)
    await new Promise(resolve => setTimeout(resolve, 1));

    // Should succeed and close circuit
    const result = await circuitBreaker.execute(fn);
    expect(result).toBe('success');
    expect(circuitBreaker.getState()).toBe('closed');
  });
});