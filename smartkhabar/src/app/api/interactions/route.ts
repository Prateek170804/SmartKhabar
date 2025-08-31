import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { userInteractionService } from '@/lib/database';
import { interactionLearner } from '@/lib/personalization/interaction-learner';
import { userPreferencesService } from '@/lib/database';
import {
  UserInteractionSchema,
  validateUserInteraction,
  InteractionResponse,
  ErrorResponse,
} from '@/types';

// Request validation schema
const InteractionRequestSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  articleId: z.string().min(1, 'Article ID is required'),
  action: z.enum(['read_more', 'hide', 'like', 'share']),
});

// Analytics request schema for batch operations
const AnalyticsRequestSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  interactions: z.array(InteractionRequestSchema).min(1, 'At least one interaction is required'),
});

/**
 * POST /api/interactions
 * Track user interactions and update preferences based on learning
 */
export async function POST(request: NextRequest): Promise<NextResponse<InteractionResponse>> {
  try {
    const body = await request.json();
    
    // Check if this is a batch analytics request or single interaction
    const isBatchRequest = 'interactions' in body;
    
    if (isBatchRequest) {
      return await handleBatchInteractions(body);
    } else {
      return await handleSingleInteraction(body);
    }
  } catch (error) {
    console.error('Error in interactions API:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors,
          },
        },
        { status: 400 }
      );
    }

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_JSON',
            message: 'Invalid JSON in request body',
          },
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to process interaction',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * Handle single interaction tracking
 */
async function handleSingleInteraction(body: unknown): Promise<NextResponse<InteractionResponse>> {
  // Validate request data
  const validatedData = InteractionRequestSchema.parse(body);
  
  // Create interaction object with timestamp
  const interaction = validateUserInteraction({
    ...validatedData,
    timestamp: new Date(),
  });

  try {
    // Record the interaction in database
    await userInteractionService.recordInteraction({
      userId: interaction.userId,
      articleId: interaction.articleId,
      action: interaction.action,
    });

    // Track interaction for learning (this also stores it)
    await interactionLearner.trackInteraction(interaction);

    // Get current user preferences
    const currentPreferences = await userPreferencesService.getOrCreateUserPreferences(
      interaction.userId
    );

    // Update preferences based on interactions (if enough data exists)
    const learningResult = await interactionLearner.updatePreferencesFromInteractions(
      interaction.userId,
      currentPreferences
    );

    // If preferences were updated, save them
    let updatedPreferences = undefined;
    if (learningResult.changes.length > 0) {
      updatedPreferences = await userPreferencesService.updateUserPreferences(
        interaction.userId,
        {
          topics: learningResult.updatedPreferences.topics,
          preferredSources: learningResult.updatedPreferences.preferredSources,
          excludedSources: learningResult.updatedPreferences.excludedSources,
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          success: true,
          updatedPreferences: updatedPreferences ? {
            topics: updatedPreferences.topics,
            preferredSources: updatedPreferences.preferredSources,
            excludedSources: updatedPreferences.excludedSources,
          } : undefined,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error processing single interaction:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'PROCESSING_ERROR',
          message: 'Failed to process interaction',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * Handle batch interaction analytics
 */
async function handleBatchInteractions(body: unknown): Promise<NextResponse<InteractionResponse>> {
  // Validate batch request data
  const validatedData = AnalyticsRequestSchema.parse(body);
  
  try {
    const processedInteractions = [];
    
    // Process each interaction in the batch
    for (const interactionData of validatedData.interactions) {
      const interaction = validateUserInteraction({
        ...interactionData,
        timestamp: new Date(),
      });

      // Record the interaction
      await userInteractionService.recordInteraction({
        userId: interaction.userId,
        articleId: interaction.articleId,
        action: interaction.action,
      });

      // Track for learning
      await interactionLearner.trackInteraction(interaction);
      
      processedInteractions.push(interaction);
    }

    // Get current user preferences
    const currentPreferences = await userPreferencesService.getOrCreateUserPreferences(
      validatedData.userId
    );

    // Update preferences based on all interactions
    const learningResult = await interactionLearner.updatePreferencesFromInteractions(
      validatedData.userId,
      currentPreferences
    );

    // If preferences were updated, save them
    let updatedPreferences = undefined;
    if (learningResult.changes.length > 0) {
      updatedPreferences = await userPreferencesService.updateUserPreferences(
        validatedData.userId,
        {
          topics: learningResult.updatedPreferences.topics,
          preferredSources: learningResult.updatedPreferences.preferredSources,
          excludedSources: learningResult.updatedPreferences.excludedSources,
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          success: true,
          updatedPreferences: updatedPreferences ? {
            topics: updatedPreferences.topics,
            preferredSources: updatedPreferences.preferredSources,
            excludedSources: updatedPreferences.excludedSources,
          } : undefined,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error processing batch interactions:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'BATCH_PROCESSING_ERROR',
          message: 'Failed to process batch interactions',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/interactions
 * Get user interaction statistics and analytics
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const statsType = searchParams.get('type') || 'basic';

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_USER_ID',
            message: 'User ID is required',
          },
        },
        { status: 400 }
      );
    }

    if (statsType === 'detailed') {
      // Get detailed interaction analytics
      const [stats, insights] = await Promise.all([
        interactionLearner.getUserInteractionStats(userId),
        interactionLearner.analyzeInteractions(userId),
      ]);

      return NextResponse.json(
        {
          success: true,
          data: {
            userId,
            basicStats: stats,
            learningInsights: insights,
            timestamp: new Date(),
          },
        },
        { status: 200 }
      );
    } else {
      // Get basic interaction statistics
      const stats = await userInteractionService.getUserInteractionStats(userId);

      return NextResponse.json(
        {
          success: true,
          data: {
            userId,
            ...stats,
            timestamp: new Date(),
          },
        },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error('Error fetching interaction analytics:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'ANALYTICS_ERROR',
          message: 'Failed to fetch interaction analytics',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}