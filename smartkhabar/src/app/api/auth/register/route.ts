import { NextRequest, NextResponse } from 'next/server';
import { getAuthService } from '@/lib/auth/auth-service';
import { getLogger } from '@/lib/monitoring/production-logger';

export async function POST(request: NextRequest) {
  const logger = getLogger();
  const requestId = `register_${Date.now()}`;
  
  try {
    const body = await request.json();
    const { email, password, name } = body;

    // Validation
    if (!email || !password || !name) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email, password, and name are required'
        }
      }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Password must be at least 6 characters long'
        }
      }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Please provide a valid email address'
        }
      }, { status: 400 });
    }

    logger.info('User registration attempt', { email, name }, requestId);

    const authService = getAuthService();
    await authService.initializeUserTables();
    
    const { user, token } = await authService.register(email, password, name);

    logger.info('User registered successfully', { userId: user.id, email }, requestId);

    // Set HTTP-only cookie for token
    const response = NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          preferences: user.preferences,
          subscription: user.subscription
        },
        token
      },
      message: 'Registration successful'
    });

    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 // 7 days
    });

    return response;

  } catch (error) {
    logger.error('User registration failed', error as Error, {}, requestId);
    
    const errorMessage = (error as Error).message;
    
    if (errorMessage.includes('already exists')) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'USER_EXISTS',
          message: 'An account with this email already exists'
        }
      }, { status: 409 });
    }

    return NextResponse.json({
      success: false,
      error: {
        code: 'REGISTRATION_FAILED',
        message: 'Registration failed. Please try again.'
      }
    }, { status: 500 });
  }
}