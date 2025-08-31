import { NextRequest, NextResponse } from 'next/server';
import { getAuthService } from '@/lib/auth/auth-service';
import { getLogger } from '@/lib/monitoring/production-logger';

export async function POST(request: NextRequest) {
  const logger = getLogger();
  const requestId = `login_${Date.now()}`;
  
  try {
    const body = await request.json();
    const { email, password } = body;

    // Validation
    if (!email || !password) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email and password are required'
        }
      }, { status: 400 });
    }

    logger.info('User login attempt', { email }, requestId);

    const authService = getAuthService();
    const { user, token } = await authService.login(email, password);

    logger.info('User logged in successfully', { userId: user.id, email }, requestId);

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
      message: 'Login successful'
    });

    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 // 7 days
    });

    return response;

  } catch (error) {
    logger.error('User login failed', error as Error, {}, requestId);
    
    const errorMessage = (error as Error).message;
    
    if (errorMessage.includes('Invalid email or password')) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password'
        }
      }, { status: 401 });
    }

    return NextResponse.json({
      success: false,
      error: {
        code: 'LOGIN_FAILED',
        message: 'Login failed. Please try again.'
      }
    }, { status: 500 });
  }
}