import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { userPreferencesService } from '@/lib/database';
import { 
  PreferencesResponse, 
  UserPreferencesSchema, 
  UserPreferences 
} from '@/types';
import { 
  SmartKhabarError,
  ErrorCode,
  ErrorSeverity,
  DatabaseError,
  ValidationError
} from '@/lib/error-handling';
import { withErrorHandling, withCircuitBreaker } from '@/lib/error-handling/middleware';
import { DatabaseFallback } from '@/lib/error-handling/fallbacks';

// Query parameters schema for GET request
const GetPreferencesQuerySchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
});

// Request body schema for PUT request (more permissive for sanitization)
const UpdatePreferencesBodySchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  preferences: z.object({
    topics: z.array(z.string()).optional(),
    tone: z.string().optional(),
    readingTime: z.number().optional(),
    preferredSources: z.array(z.string()).optional(),
    excludedSources: z.array(z.string()).optional(),
  }),
});

/**
 * GET /api/preferences
 * Retrieves user preferences by user ID
 */
export const GET = withErrorHandling(async (request: NextRequest, context) => {
  // Parse and validate query parameters
  const url = new URL(request.url);
  const queryParams = Object.fromEntries(url.searchParams.entries());
  
  const { userId } = GetPreferencesQuerySchema.parse(queryParams);

  // Get user preferences with circuit breaker and fallback
  const userPreferences = await withCircuitBreaker('user-preferences')(async () => {
    try {
      return await userPreferencesService.getOrCreateUserPreferences(userId);
    } catch (error) {
      // Try to get cached preferences first
      const cachedPreferences = DatabaseFallback.getCachedData<UserPreferences>(`preferences-${userId}`);
      if (cachedPreferences) {
        return cachedPreferences;
      }
      
      throw new DatabaseError(
        'Failed to retrieve user preferences',
        { userId, originalError: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  });

  // Cache the preferences for future fallback use
  DatabaseFallback.cacheData(`preferences-${userId}`, userPreferences);

  const response: PreferencesResponse = {
    success: true,
    data: userPreferences,
  };

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': 'private, max-age=300', // Cache for 5 minutes
      'x-request-id': context.requestId,
    },
  });
}, {
  enableFallbacks: true,
  enableCircuitBreaker: true,
});

/**
 * PUT /api/preferences
 * Updates user preferences
 */
export const PUT = withErrorHandling(async (request: NextRequest, context) => {
  // Parse and validate request body
  const body = await request.json();
  const { userId, preferences } = UpdatePreferencesBodySchema.parse(body);

  // Sanitize preferences data
  const sanitizedPreferences = sanitizePreferences(preferences);

  // Update user preferences with circuit breaker
  const updatedPreferences = await withCircuitBreaker('user-preferences')(async () => {
    try {
      return await userPreferencesService.updateUserPreferences(userId, sanitizedPreferences);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw new SmartKhabarError(
          ErrorCode.NOT_FOUND,
          'User preferences not found',
          ErrorSeverity.LOW,
          { userId },
          'User must be created before updating preferences'
        );
      }
      
      throw new DatabaseError(
        'Failed to update user preferences',
        { userId, preferences: sanitizedPreferences, originalError: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  });

  // Cache the updated preferences
  DatabaseFallback.cacheData(`preferences-${userId}`, updatedPreferences);

  const response: PreferencesResponse = {
    success: true,
    data: updatedPreferences,
  };

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': 'no-cache', // Don't cache PUT responses
      'x-request-id': context.requestId,
    },
  });
}, {
  enableFallbacks: true,
  enableCircuitBreaker: true,
});

/**
 * Sanitize and validate preference updates
 */
function sanitizePreferences(preferences: {
  topics?: string[];
  tone?: string;
  readingTime?: number;
  preferredSources?: string[];
  excludedSources?: string[];
}) {
  const sanitized: Partial<Omit<UserPreferences, 'userId' | 'lastUpdated'>> = {};

  // Sanitize topics
  if (preferences.topics !== undefined) {
    sanitized.topics = preferences.topics
      .filter(topic => typeof topic === 'string' && topic.trim().length > 0)
      .map(topic => topic.trim().toLowerCase())
      .slice(0, 10); // Limit to 10 topics
  }

  // Sanitize tone
  if (preferences.tone !== undefined) {
    const validTones = ['formal', 'casual', 'fun'] as const;
    if (validTones.includes(preferences.tone as any)) {
      sanitized.tone = preferences.tone as 'formal' | 'casual' | 'fun';
    }
  }

  // Sanitize reading time
  if (preferences.readingTime !== undefined) {
    const readingTime = Number(preferences.readingTime);
    if (!isNaN(readingTime) && readingTime >= 1 && readingTime <= 15) {
      sanitized.readingTime = Math.round(readingTime);
    }
  }

  // Sanitize preferred sources
  if (preferences.preferredSources !== undefined) {
    sanitized.preferredSources = preferences.preferredSources
      .filter(source => typeof source === 'string' && source.trim().length > 0)
      .map(source => source.trim().toLowerCase())
      .slice(0, 20); // Limit to 20 sources
  }

  // Sanitize excluded sources
  if (preferences.excludedSources !== undefined) {
    sanitized.excludedSources = preferences.excludedSources
      .filter(source => typeof source === 'string' && source.trim().length > 0)
      .map(source => source.trim().toLowerCase())
      .slice(0, 20); // Limit to 20 sources
  }

  return sanitized;
}

/**
 * POST /api/preferences
 * Creates new user preferences (alternative to PUT for creation)
 */
export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validatedData = UserPreferencesSchema.omit({ lastUpdated: true }).parse(body);

    // Sanitize preferences data
    const sanitizedPreferences = sanitizePreferences(validatedData);

    // Create user preferences
    const newPreferences = await userPreferencesService.createUserPreferences({
      ...validatedData,
      ...sanitizedPreferences,
    });

    const response: PreferencesResponse = {
      success: true,
      data: newPreferences,
    };

    return NextResponse.json(response, {
      status: 201,
      headers: {
        'Cache-Control': 'no-cache',
      },
    });

  } catch (error) {
    console.error('Error creating user preferences:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: error.errors,
          },
        },
        { status: 400 }
      );
    }

    // Check if user already exists
    if (error instanceof Error && error.message.includes('already exists')) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'USER_EXISTS',
            message: 'User preferences already exist',
            details: 'Use PUT method to update existing preferences',
          },
        },
        { status: 409 }
      );
    }

    // Check if it's a database error
    if (error instanceof Error && error.message.includes('Database')) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: 'Failed to create user preferences',
            details: error.message,
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create user preferences',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/preferences
 * Deletes user preferences
 */
export async function DELETE(request: NextRequest) {
  try {
    // Parse and validate query parameters
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    
    const { userId } = GetPreferencesQuerySchema.parse(queryParams);

    // Delete user preferences
    const deleted = await userPreferencesService.deleteUserPreferences(userId);

    if (!deleted) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User preferences not found',
            details: 'No preferences found for the specified user',
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          message: 'User preferences deleted successfully',
          userId,
        },
      },
      {
        headers: {
          'Cache-Control': 'no-cache',
        },
      }
    );

  } catch (error) {
    console.error('Error deleting user preferences:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: error.errors,
          },
        },
        { status: 400 }
      );
    }

    // Check if it's a database error
    if (error instanceof Error && error.message.includes('Database')) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: 'Failed to delete user preferences',
            details: error.message,
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete user preferences',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}