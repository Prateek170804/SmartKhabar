import { NextRequest, NextResponse } from 'next/server';
import { getNeonClient } from '@/lib/database/neon-client'; // Correct import

interface DebugInfo {
  status: string;
  environment: Record<string, string | undefined>;
  database: { status: string; error: string | null };
  memory: { used: string; total: string };
  uptime: string;
  message: string;
  articles?: Array<{ id: string; title: string }>;
}

interface Article {
  id: string;
  title: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { message: 'Debug endpoint not available in production' },
      { status: 403 }
    );
  }

  try {
    const client = getNeonClient(); // Initialize Neon client

    // Database check
    let dbStatus = 'DISCONNECTED';
    let dbError = null;
    if (process.env.DATABASE_URL) {
      await client.query('SELECT 1');
      dbStatus = 'CONNECTED';
    } else {
      dbError = 'DATABASE_URL not set';
    }

    // Memory check
    const memoryUsage = process.memoryUsage();
    const usedMemory = `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`;
    const totalMemory = `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`;

    // Database query for articles (line ~195)
    const articlesResult = await client.query<Article>('SELECT id, title FROM articles');
    const articles = articlesResult.rows;

    const debugInfo: DebugInfo = {
      status: 'OK',
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'NOT SET',
        GNEWS_API_KEY: process.env.GNEWS_API_KEY ? 'SET' : 'NOT SET',
        HUGGINGFACE_API_KEY: process.env.HUGGINGFACE_API_KEY ? 'SET' : 'NOT SET',
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      },
      database: { status: dbStatus, error: dbError },
      memory: { used: usedMemory, total: totalMemory },
      uptime: `${Math.round(process.uptime())} seconds`,
      message: 'Debug information retrieved successfully',
      articles,
    };

    return NextResponse.json(debugInfo, {
      status: 200,
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
    });
  } catch (error: unknown) {
    console.error('Debug API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { message: 'Internal Server Error', error: errorMessage },
      { status: 500 }
    );
  }
}