import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Simple in-memory preferences store for demonstration - DIVERSE CATEGORIES
const defaultPreferences = {
  categories: ['top', 'technology', 'business', 'science', 'health', 'sports', 'world'],
  keywords: ['breaking news', 'innovation', 'research', 'health', 'sports', 'global'],
  sources: ['bbc', 'cnn', 'reuters', 'associated-press'],
  readingTime: 'medium',
  tone: 'neutral',
  language: 'en'
};

// Query parameters schema
const GetPreferencesQuerySchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
});

/**
 * GET /api/preferences/simple
 * Simple preferences endpoint that returns default preferences
 */
export async function GET(request: NextRequest) {
  try {
    // Parse and validate query parameters
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    
    const { userId } = GetPreferencesQuerySchema.parse(queryParams);

    // Return default preferences for any user
    const response = {
      success: true,
      preferences: {
        ...defaultPreferences,
        userId,
        lastUpdated: new Date().toISOString()
      }
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=300',
      },
    });

  } catch (error) {
    console.error('Simple preferences API error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'PREFERENCES_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/preferences/simple
 * Simple preferences update endpoint (alias for PUT)
 */
export async function POST(request: NextRequest) {
  return PUT(request);
}

/**
 * PUT /api/preferences/simple
 * Simple preferences update endpoint
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'User ID is required',
          },
        },
        { status: 400 }
      );
    }

    // For demo purposes, just return success
    const response = {
      success: true,
      preferences: {
        ...defaultPreferences,
        ...body.preferences,
        userId,
        lastUpdated: new Date().toISOString()
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Simple preferences update error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'UPDATE_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}