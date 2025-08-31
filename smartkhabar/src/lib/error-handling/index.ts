/**
 * Comprehensive error handling system for SmartKhabar
 * Provides centralized error formatting, fallback mechanisms, and graceful degradation
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ErrorResponse, ApiResponse } from '@/types';

// Error codes enum for consistency
export enum ErrorCode {
  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_REQUEST = 'INVALID_REQUEST',
  MISSING_PARAMETERS = 'MISSING_PARAMETERS',
  
  // Authentication/Authorization errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  
  // Resource errors
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  
  // Service errors
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_API_ERROR = 'EXTERNAL_API_ERROR',
  SUMMARIZATION_ERROR = 'SUMMARIZATION_ERROR',
  EMBEDDING_ERROR = 'EMBEDDING_ERROR',
  SEARCH_ERROR = 'SEARCH_ERROR',
  
  // System errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
}

// Error severity levels
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// Base error class with additional context
export class SmartKhabarError extends Error {
  public readonly code: ErrorCode;
  public readonly severity: ErrorSeverity;
  public readonly context?: Record<string, unknown>;
  public readonly timestamp: Date;
  public readonly userMessage?: string;

  constructor(
    code: ErrorCode,
    message: string,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    context?: Record<string, unknown>,
    userMessage?: string
  ) {
    super(message);
    this.name = 'SmartKhabarError';
    this.code = code;
    this.severity = severity;
    this.context = context;
    this.timestamp = new Date();
    this.userMessage = userMessage;
  }
}

// Specific error classes
export class ValidationError extends SmartKhabarError {
  constructor(message: string, details?: unknown, context?: Record<string, unknown>) {
    super(
      ErrorCode.VALIDATION_ERROR,
      message,
      ErrorSeverity.LOW,
      { ...context, details },
      'Please check your input and try again.'
    );
  }
}

export class DatabaseError extends SmartKhabarError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(
      ErrorCode.DATABASE_ERROR,
      message,
      ErrorSeverity.HIGH,
      context,
      'We are experiencing technical difficulties. Please try again later.'
    );
  }
}

export class ExternalAPIError extends SmartKhabarError {
  constructor(service: string, message: string, context?: Record<string, unknown>) {
    super(
      ErrorCode.EXTERNAL_API_ERROR,
      `${service}: ${message}`,
      ErrorSeverity.MEDIUM,
      { ...context, service },
      'External service is temporarily unavailable. Please try again later.'
    );
  }
}

export class SummarizationError extends SmartKhabarError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(
      ErrorCode.SUMMARIZATION_ERROR,
      message,
      ErrorSeverity.MEDIUM,
      context,
      'Unable to generate summary at this time. Please try again.'
    );
  }
}

// Fallback data types
export interface FallbackData {
  type: 'cached_content' | 'default_feed' | 'excerpt' | 'empty_state';
  data: unknown;
  message?: string;
}

// Error handler configuration
export interface ErrorHandlerConfig {
  enableFallbacks: boolean;
  logErrors: boolean;
  includeStackTrace: boolean;
  sanitizeDetails: boolean;
}

const defaultConfig: ErrorHandlerConfig = {
  enableFallbacks: true,
  logErrors: true,
  includeStackTrace: process.env.NODE_ENV === 'development',
  sanitizeDetails: process.env.NODE_ENV === 'production',
};

/**
 * Format error for API response
 */
export function formatErrorResponse(
  error: Error | SmartKhabarError,
  config: Partial<ErrorHandlerConfig> = {}
): ErrorResponse {
  const finalConfig = { ...defaultConfig, ...config };

  let code: ErrorCode;
  let message: string;
  let details: unknown;
  let userMessage: string;

  if (error instanceof SmartKhabarError) {
    code = error.code;
    message = error.userMessage || error.message;
    details = finalConfig.sanitizeDetails ? undefined : error.context;
    userMessage = error.userMessage || 'An error occurred while processing your request.';
  } else if (error instanceof z.ZodError) {
    code = ErrorCode.VALIDATION_ERROR;
    message = 'Invalid request data';
    details = finalConfig.sanitizeDetails ? undefined : error.errors;
    userMessage = 'Please check your input and try again.';
  } else {
    code = ErrorCode.INTERNAL_ERROR;
    message = finalConfig.sanitizeDetails ? 'Internal server error' : error.message;
    details = finalConfig.includeStackTrace ? error.stack : undefined;
    userMessage = 'An unexpected error occurred. Please try again later.';
  }

  // Log error if enabled
  if (finalConfig.logErrors) {
    logError(error, code);
  }

  return {
    error: {
      code,
      message: userMessage,
      details,
    },
  };
}

/**
 * Create API response with error and optional fallback
 */
export function createErrorResponse<T>(
  error: Error | SmartKhabarError,
  fallback?: FallbackData,
  config?: Partial<ErrorHandlerConfig>
): ApiResponse<T> {
  const errorResponse = formatErrorResponse(error, config);
  
  return {
    success: false,
    error: errorResponse.error,
    fallback,
  };
}

/**
 * Create Next.js response with proper status code
 */
export function createNextErrorResponse<T>(
  error: Error | SmartKhabarError,
  fallback?: FallbackData,
  config?: Partial<ErrorHandlerConfig>
): NextResponse {
  const response = createErrorResponse<T>(error, fallback, config);
  const statusCode = getStatusCodeForError(error);
  
  return NextResponse.json(response, { status: statusCode });
}

/**
 * Get appropriate HTTP status code for error
 */
export function getStatusCodeForError(error: Error | SmartKhabarError): number {
  if (error instanceof SmartKhabarError) {
    switch (error.code) {
      case ErrorCode.VALIDATION_ERROR:
      case ErrorCode.INVALID_REQUEST:
      case ErrorCode.MISSING_PARAMETERS:
        return 400;
      case ErrorCode.UNAUTHORIZED:
        return 401;
      case ErrorCode.FORBIDDEN:
        return 403;
      case ErrorCode.NOT_FOUND:
        return 404;
      case ErrorCode.ALREADY_EXISTS:
        return 409;
      case ErrorCode.RATE_LIMIT_EXCEEDED:
        return 429;
      case ErrorCode.SERVICE_UNAVAILABLE:
        return 503;
      case ErrorCode.TIMEOUT_ERROR:
        return 504;
      default:
        return 500;
    }
  }
  
  if (error instanceof z.ZodError) {
    return 400;
  }
  
  return 500;
}

/**
 * Log error with appropriate level
 */
export function logError(error: Error | SmartKhabarError, code?: ErrorCode): void {
  const timestamp = new Date().toISOString();
  const errorCode = code || (error instanceof SmartKhabarError ? error.code : ErrorCode.INTERNAL_ERROR);
  
  const logData = {
    timestamp,
    code: errorCode,
    message: error.message,
    stack: error.stack,
    ...(error instanceof SmartKhabarError && {
      severity: error.severity,
      context: error.context,
    }),
  };

  // In production, you might want to send this to a logging service
  if (process.env.NODE_ENV === 'development') {
    console.error('SmartKhabar Error:', logData);
  } else {
    // Send to logging service (e.g., Sentry, LogRocket, etc.)
    console.error(JSON.stringify(logData));
  }
}

/**
 * Wrap async function with error handling
 */
export function withErrorHandling<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  config?: Partial<ErrorHandlerConfig>
) {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      if (config?.logErrors !== false) {
        logError(error as Error);
      }
      throw error;
    }
  };
}

/**
 * Retry mechanism with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  maxDelay: number = 10000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        break;
      }
      
      // Calculate delay with exponential backoff and jitter
      const delay = Math.min(
        baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
        maxDelay
      );
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

/**
 * Circuit breaker pattern for external services
 */
export class CircuitBreaker {
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private readonly threshold: number = 5,
    private readonly timeout: number = 60000, // 1 minute
    private readonly resetTimeout: number = 30000 // 30 seconds
  ) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'half-open';
      } else {
        throw new SmartKhabarError(
          ErrorCode.SERVICE_UNAVAILABLE,
          'Service is temporarily unavailable due to repeated failures',
          ErrorSeverity.HIGH
        );
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }
  
  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.threshold) {
      this.state = 'open';
    }
  }
  
  getState(): string {
    return this.state;
  }
}