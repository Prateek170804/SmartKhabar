import { NextRequest, NextResponse } from 'next/server';
import { getAuthService } from '@/lib/auth/auth-service';
import { getLogger } from '@/lib/monitoring/production-logger';

export async function GET(request: NextRequest) {
  const logger = getLogger();
  const requestId = `me_${Date.now()}`;
  
  try {
    const authService = getAuthService();
    const user = await authService.getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      }, { status: 401 });
    }

    logger.info('User profile retrieved', { userId: user.id }, requestId);

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          preferences: user.preferences,
          subscription: user.subscription,
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt
        }
      }
    });

  } catch (error) {
    logger.error('Failed to get user profile', error as Error, {}, requestId);
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'PROFILE_ERROR',
        message: 'Failed to retrieve user profile'
      }
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const logger = getLogger();
  const requestId = `update_profile_${Date.now()}`;
  
  try {
    const authService = getAuthService();
    const user = await authService.getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      }, { status: 401 });
    }

    const body = await request.json();
    const { preferences } = body;

    if (!preferences) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Preferences are required'
        }
      }, { status: 400 });
    }

    logger.info('Updating user preferences', { userId: user.id }, requestId);

    const updatedUser = await authService.updatePreferences(user.id, preferences);

    logger.info('User preferences updated', { userId: user.id }, requestId);

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name,
          avatar: updatedUser.avatar,
          preferences: updatedUser.preferences,
          subscription: updatedUser.subscription
        }
      },
      message: 'Preferences updated successfully'
    });

  } catch (error) {
    logger.error('Failed to update user preferences', error as Error, {}, requestId);
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'UPDATE_ERROR',
        message: 'Failed to update preferences'
      }
    }, { status: 500 });
  }
}