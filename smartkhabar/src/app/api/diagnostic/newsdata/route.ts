import { NextRequest, NextResponse } from 'next/server';
import { NewsDataClient } from '@/lib/news-collection/newsdata-client';
import { config } from '@/lib/config';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const test = searchParams.get('test') || 'basic';
    
    // Check if API key is available
    if (!config.newsdata.apiKey) {
      return NextResponse.json({
        success: false,
        error: 'NewsData API key not configured',
        config: {
          hasApiKey: false,
          apiKeyLength: 0,
          environment: process.env.NODE_ENV
        }
      }, { status: 500 });
    }
    
    const newsDataClient = new NewsDataClient(config.newsdata.apiKey);
    
    let testResult;
    const startTime = Date.now();
    
    try {
      switch (test) {
        case 'breaking':
          testResult = await newsDataClient.getLatestNews({
            language: 'en',
            size: 3,
            prioritydomain: 'top'
          });
          break;
        case 'category':
          testResult = await newsDataClient.getLatestNews({
            language: 'en',
            size: 3,
            category: 'business'
          });
          break;
        default:
          testResult = await newsDataClient.getLatestNews({
            language: 'en',
            size: 3
          });
      }
      
      const duration = Date.now() - startTime;
      
      return NextResponse.json({
        success: true,
        test: test,
        duration: duration,
        config: {
          hasApiKey: true,
          apiKeyLength: config.newsdata.apiKey.length,
          apiKeyPrefix: config.newsdata.apiKey.substring(0, 10),
          environment: process.env.NODE_ENV,
          baseUrl: config.newsdata.baseUrl
        },
        result: {
          status: testResult.status,
          totalResults: testResult.totalResults,
          articlesReturned: testResult.results.length,
          firstArticleTitle: testResult.results[0]?.title?.substring(0, 50) + '...',
          firstArticleSource: testResult.results[0]?.source_id,
          firstArticleDate: testResult.results[0]?.pubDate
        }
      });
      
    } catch (apiError: any) {
      const duration = Date.now() - startTime;
      
      return NextResponse.json({
        success: false,
        test: test,
        duration: duration,
        error: apiError.message,
        config: {
          hasApiKey: true,
          apiKeyLength: config.newsdata.apiKey.length,
          apiKeyPrefix: config.newsdata.apiKey.substring(0, 10),
          environment: process.env.NODE_ENV,
          baseUrl: config.newsdata.baseUrl
        }
      }, { status: 503 });
    }
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      config: {
        hasApiKey: !!config.newsdata.apiKey,
        apiKeyLength: config.newsdata.apiKey?.length || 0,
        environment: process.env.NODE_ENV
      }
    }, { status: 500 });
  }
}