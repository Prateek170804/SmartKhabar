import { NextRequest, NextResponse } from 'next/server';
import { NewsDataClient } from '@/lib/news-collection/newsdata-client';
import { config } from '@/lib/config';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '5');
    
    if (!config.newsdata.apiKey) {
      return NextResponse.json({
        success: false,
        error: 'API key not configured'
      }, { status: 500 });
    }
    
    const newsDataClient = new NewsDataClient(config.newsdata.apiKey);
    
    const response = await newsDataClient.getLatestNews({
      language: 'en',
      size: limit,
      prioritydomain: 'top'
    });
    
    const articles = response.results.map(article => ({
      id: article.article_id,
      headline: article.title,
      content: article.content || article.description,
      source: article.source_id,
      publishedAt: new Date(article.pubDate),
      url: article.link
    }));
    
    return NextResponse.json({
      success: true,
      articles,
      source: 'newsdata',
      count: articles.length,
      realTime: true
    });
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error',
      articles: []
    }, { status: 500 });
  }
}