import { NextRequest, NextResponse } from 'next/server';
import { createNewsCollectionScheduler } from '@/lib/news-collection/scheduler';

// Global scheduler instance for status monitoring
let globalScheduler: ReturnType<typeof createNewsCollectionScheduler> | null = null;

function getSchedulerInstance() {
  if (!globalScheduler) {
    globalScheduler = createNewsCollectionScheduler();
  }
  return globalScheduler;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'current';
    const limit = parseInt(searchParams.get('limit') || '10');

    const scheduler = getSchedulerInstance();

    switch (action) {
      case 'current':
        const currentStatus = scheduler.getCurrentStatus();
        return NextResponse.json({
          success: true,
          data: {
            currentStatus,
            isRunning: scheduler.isCollectionRunning(),
          },
        });

      case 'history':
        const history = scheduler.getCollectionHistory(limit);
        return NextResponse.json({
          success: true,
          data: {
            history,
            total: history.length,
          },
        });

      case 'stats':
        const stats = scheduler.getCollectionStats();
        return NextResponse.json({
          success: true,
          data: stats,
        });

      default:
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_ACTION',
              message: 'Invalid action parameter. Use: current, history, or stats',
            },
          },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Collection status request failed:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'STATUS_REQUEST_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}

// Manual collection trigger (for testing/admin purposes)
export async function POST(request: NextRequest) {
  try {
    const scheduler = getSchedulerInstance();
    
    if (scheduler.isCollectionRunning()) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'COLLECTION_ALREADY_RUNNING',
            message: 'A collection is already in progress',
          },
        },
        { status: 409 }
      );
    }

    // Parse request body for custom configuration
    const body = await request.json().catch(() => ({}));
    const customConfig = {
      sources: body.sources,
      articlesPerSource: body.articlesPerSource || 10,
      includeHackerNews: body.includeHackerNews !== false,
      customUrls: body.customUrls,
      enableDeduplication: body.enableDeduplication !== false,
    };

    // Create new scheduler with custom config
    const customScheduler = createNewsCollectionScheduler(customConfig);
    const status = await customScheduler.executeCollection();

    return NextResponse.json({
      success: true,
      data: {
        collectionId: status.id,
        articlesCollected: status.articlesCollected,
        sourcesProcessed: status.sourcesProcessed,
        sourcesWithErrors: status.sourcesWithErrors,
        collectionTime: status.metadata.collectionTime,
        errors: status.errors,
      },
    });

  } catch (error) {
    console.error('Manual collection failed:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'MANUAL_COLLECTION_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';