/**
 * Health check endpoint for error handling system
 * Provides status of circuit breakers and error rates
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHealthCheckHandler } from '@/lib/error-handling/middleware';

/**
 * GET /api/health/error-handling
 * Returns health status of error handling components
 */
export const GET = createHealthCheckHandler('error-handling');