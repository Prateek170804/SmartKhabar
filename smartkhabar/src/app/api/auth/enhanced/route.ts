import { NextRequest, NextResponse } from 'next/server';
import { enhancedAuthService } from '@/lib/auth/enhanced-auth-service';
import { analytics } from '@/lib/analytics/comprehensive-analytics';
import { getLogger } from '@/lib/monitoring/production-logger';

const logger = getLogger();

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let body: any;
  
  try {
    body = await request.json();
    const { action, ...data } = body;
    
    const userAgent = request.headers.get('user-agent') || undefined;
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';

    let result;
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    switch (action) {
      case 'register':
        const { email, password, name, preferences } = data;
        
        if (!email || !password || !name) {
          return NextResponse.json({
            success: false,
            error: 'Missing required fields'
          }, { status: 400 });
        }

        result = await enhancedAuthService.register({
          email,
          password,
          name,
          preferences
        });

        // Track registration
        await analytics.trackUserRegistration(result.user.id, sessionId, 'email');
        
        logger.info('User registered successfully', { 
          userId: result.user.id, 
          email: result.user.email 
        });

        break;

      case 'login':
        const { email: loginEmail, password: loginPassword } = data;
        
        if (!loginEmail || !loginPassword) {
          return NextResponse.json({
            success: false,
            error: 'Missing email or password'
          }, { status: 400 });
        }

        result = await enhancedAuthService.login(loginEmail, loginPassword);

        // Track login
        await analytics.trackUserLogin(result.user.id, sessionId, 'email');
        
        logger.info('User logged in successfully', { 
          userId: result.user.id, 
          email: result.user.email 
        });

        break;

      case 'refresh':
        const { token } = data;
        
        if (!token) {
          return NextResponse.json({
            success: false,
            error: 'Missing token'
          }, { status: 400 });
        }

        const user = await enhancedAuthService.getUserFromToken(token);
        
        if (!user) {
          return NextResponse.json({
            success: false,
            error: 'Invalid token'
          }, { status: 401 });
        }

        result = {
          user,
          token // Return the same token since we don't have expiry
        };

        break;

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 });
    }

    // Track API performance
    await analytics.trackAPIPerformance({
      endpoint: '/api/auth/enhanced',
      method: 'POST',
      responseTime: Date.now() - startTime,
      statusCode: 200,
      userAgent,
      userId: result.user.id
    });

    return NextResponse.json({
      success: true,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        preferences: result.user.preferences,
        subscription: result.user.subscription
      },
      token: result.token,
      sessionId
    });

  } catch (error: any) {
    logger.error('Enhanced auth error', error, { action: body?.action });

    // Track API performance for errors
    await analytics.trackAPIPerformance({
      endpoint: '/api/auth/enhanced',
      method: 'POST',
      responseTime: Date.now() - startTime,
      statusCode: 500,
      userAgent: request.headers.get('user-agent') || undefined
    });

    return NextResponse.json({
      success: false,
      error: error.message || 'Authentication failed'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const user = await enhancedAuthService.extractUserFromRequest(request);
    
    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'Not authenticated'
      }, { status: 401 });
    }

    // Get user analytics
    const userAnalytics = await analytics.getUserEngagementStats(user.id);

    // Track API performance
    await analytics.trackAPIPerformance({
      endpoint: '/api/auth/enhanced',
      method: 'GET',
      responseTime: Date.now() - startTime,
      statusCode: 200,
      userAgent: request.headers.get('user-agent') || undefined,
      userId: user.id
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        preferences: user.preferences,
        subscription: user.subscription,
        analytics: userAnalytics
      }
    });

  } catch (error: any) {
    logger.error('Get user profile error', error);

    await analytics.trackAPIPerformance({
      endpoint: '/api/auth/enhanced',
      method: 'GET',
      responseTime: Date.now() - startTime,
      statusCode: 500,
      userAgent: request.headers.get('user-agent') || undefined
    });

    return NextResponse.json({
      success: false,
      error: 'Failed to get user profile'
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const user = await enhancedAuthService.extractUserFromRequest(request);
    
    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'Not authenticated'
      }, { status: 401 });
    }

    const body = await request.json();
    const { preferences, subscription } = body;

    let updatedUser = user;

    if (preferences) {
      updatedUser = await enhancedAuthService.updatePreferences(user.id, preferences);
      
      // Track preference update
      await analytics.trackUserEvent({
        userId: user.id,
        sessionId: 'unknown',
        event: 'preferences_updated',
        properties: {
          updatedFields: Object.keys(preferences),
          preferences
        }
      });
    }

    if (subscription) {
      updatedUser = await enhancedAuthService.updateSubscription(user.id, subscription);
      
      // Track subscription update
      await analytics.trackUserEvent({
        userId: user.id,
        sessionId: 'unknown',
        event: 'subscription_updated',
        properties: {
          oldPlan: user.subscription.plan,
          newPlan: subscription.plan,
          subscription
        }
      });
    }

    // Track API performance
    await analytics.trackAPIPerformance({
      endpoint: '/api/auth/enhanced',
      method: 'PUT',
      responseTime: Date.now() - startTime,
      statusCode: 200,
      userAgent: request.headers.get('user-agent') || undefined,
      userId: user.id
    });

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        preferences: updatedUser.preferences,
        subscription: updatedUser.subscription
      }
    });

  } catch (error: any) {
    logger.error('Update user profile error', error);

    await analytics.trackAPIPerformance({
      endpoint: '/api/auth/enhanced',
      method: 'PUT',
      responseTime: Date.now() - startTime,
      statusCode: 500,
      userAgent: request.headers.get('user-agent') || undefined
    });

    return NextResponse.json({
      success: false,
      error: 'Failed to update user profile'
    }, { status: 500 });
  }
}