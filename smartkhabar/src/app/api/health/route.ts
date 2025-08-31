import { NextResponse } from 'next/server';
import { validateEnvironment } from '@/utils';

export async function GET() {
  try {
    const envCheck = validateEnvironment();
    
    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: {
        isValid: envCheck.isValid,
        missing: envCheck.missing,
      },
      services: {
        database: 'pending', // Will be updated when database is configured
        vectorStore: 'pending', // Will be updated when FAISS is configured
        llm: 'pending', // Will be updated when LLM services are configured
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        message: 'Health check failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}