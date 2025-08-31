import { NextRequest, NextResponse } from 'next/server';
import { getLogger } from '@/lib/monitoring/production-logger';

export async function POST(request: NextRequest) {
  const logger = getLogger();
  const requestId = `logout_${Date.now()}`;
  
  try {
    logger.info('User logout', {}, requestId);

    // Clear the auth cookie
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    });

    response.cookies.set('auth-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0 // Expire immediately
    });

    return response;

  } catch (error) {
    logger.error('Logout failed', error as Error, {}, requestId);
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'LOGOUT_ERROR',
        message: 'Logout failed'
      }
    }, { status: 500 });
  }
}