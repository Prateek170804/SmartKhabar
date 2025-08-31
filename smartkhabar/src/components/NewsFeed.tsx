'use client';

import React, { useState, useEffect } from 'react';
import { Summary, InteractionResponse } from '@/types';

interface NewsFeedProps {
  userId?: string;
  className?: string;
  onPreferencesChange?: () => void;
  userPreferences?: any;
  preferencesUpdated?: number;
}

interface NewsFeedState {
  summaries: Summary[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  hiddenSources: Set<string>;
  likedArticles: Set<string>;
  interactionLoading: Set<string>;
}

export default function NewsFeed({ 
  userId = 'default-user', 
  className = '',
  onPreferencesChange,
  userPreferences,
  preferencesUpdated = 0
}: NewsFeedProps) {
  const [state, setState] = useState<NewsFeedState>({
    summaries: [],
    loading: true,
    error: null,
    lastUpdated: null,
    hiddenSources: new Set(),
    likedArticles: new Set(),
    interactionLoading: new Set(),
  });

  const fetchPersonalizedFeed = async () => {
    if (!userId) return;
    
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      // Build personalized query based on user preferences
      let apiUrl = `/api/news/personalized/simple?userId=${userId}&limit=25`;
      
      if (userPreferences && userPreferences.topics && userPreferences.topics.length > 0) {
        const categories = userPreferences.topics.join(',');
        apiUrl += `&categories=${encodeURIComponent(categories)}`;
      }
      
      // Try personalized endpoint first
      let response = await fetch(apiUrl);
      let data = await response.json();
      
      if (!data.success || !data.articles || data.articles.length === 0) {
        // Fallback to free news with user's preferred categories
        let fallbackUrl = '/api/news/free?limit=25';
        if (userPreferences && userPreferences.topics && userPreferences.topics.length > 0) {
          // Use first preferred category for fallback
          fallbackUrl += `&category=${encodeURIComponent(userPreferences.topics[0])}`;
        }
        response = await fetch(fallbackUrl);
        data = await response.json();
      }
      
      if (data.success && data.articles) {
        // Convert articles to summaries format
        const summaries = data.articles.map((article: any) => ({
          id: article.id || `article-${Date.now()}-${Math.random()}`,
          content: article.summary || article.description || article.content?.substring(0, 200) + '...',
          category: article.category || 'General',
          publishedAt: article.publishedAt || article.pubDate || new Date().toISOString(),
          sourceArticles: [article.url || article.link || '#'],
          readingTime: Math.ceil((article.summary || article.description || '').length / 200) || 2,
          title: article.title || article.headline || 'No Title Available',
          source: article.source || 'Unknown Source'
        }));
        
        setState(prev => ({
          ...prev,
          summaries,
          loading: false,
          lastUpdated: new Date(),
          error: null,
        }));
      } else {
        throw new Error(data.error || 'No articles available');
      }
    } catch (error) {
      console.error('Error fetching personalized feed:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to load news',
        loading: false
      }));
    }
  };

  useEffect(() => {
    fetchPersonalizedFeed();
  }, [userId, preferencesUpdated]);

  // Also refetch when preferences change
  useEffect(() => {
    if (userPreferences) {
      console.log('User preferences changed, refetching personalized feed:', userPreferences);
      fetchPersonalizedFeed();
    }
  }, [userPreferences]);

  const handleRefresh = () => {
    fetchPersonalizedFeed();
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  const trackInteraction = async (articleId: string, action: 'read_more' | 'hide' | 'like' | 'share') => {
    try {
      setState(prev => ({
        ...prev,
        interactionLoading: new Set([...prev.interactionLoading, articleId])
      }));

      const response = await fetch('/api/interactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          articleId,
          action,
        }),
      });

      const data: InteractionResponse = await response.json();
      
      if (!response.ok) {
        throw new Error(data.success === false ? data.error.message : 'Failed to track interaction');
      }

      // Update local state based on action
      if (action === 'like') {
        setState(prev => ({
          ...prev,
          likedArticles: new Set([...prev.likedArticles, articleId])
        }));
      }

      // Notify parent component if preferences were updated
      if (data.success && data.data.updatedPreferences && onPreferencesChange) {
        onPreferencesChange();
      }
    } catch (error) {
      console.error('Failed to track interaction:', error);
    } finally {
      setState(prev => ({
        ...prev,
        interactionLoading: new Set([...prev.interactionLoading].filter(id => id !== articleId))
      }));
    }
  };

  const handleReadMore = (summary: Summary) => {
    // Try to get the actual article URL from the summary data
    let articleUrl = null;
    
    if (summary.sourceArticles && summary.sourceArticles.length > 0) {
      articleUrl = summary.sourceArticles[0];
    }
    
    if (articleUrl && articleUrl !== '#') {
      window.open(articleUrl, '_blank', 'noopener,noreferrer');
      trackInteraction(summary.id, 'read_more');
    } else {
      // Show a message if no URL is available
      alert('Article URL not available. This is a demo version.');
    }
  };

  const handleHideSource = (summary: Summary) => {
    // Extract source from summary metadata (this would need to be added to the Summary type)
    // For now, we'll use a placeholder approach
    const sourceName = 'source-placeholder'; // This should come from summary metadata
    
    setState(prev => ({
      ...prev,
      hiddenSources: new Set([...prev.hiddenSources, sourceName])
    }));
    
    trackInteraction(summary.id, 'hide');
  };

  const handleLike = (summary: Summary) => {
    trackInteraction(summary.id, 'like');
  };

  const handleShare = (summary: Summary) => {
    if (navigator.share) {
      navigator.share({
        title: 'SmartKhabar News Summary',
        text: summary.content.substring(0, 100) + '...',
        url: window.location.href,
      });
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(summary.content);
      alert('Summary copied to clipboard!');
    }
    trackInteraction(summary.id, 'share');
  };

  if (state.loading) {
    return (
      <div className={`w-full max-w-4xl mx-auto p-4 ${className}`} data-testid="news-feed">
        {/* Personalization Status */}
        {userPreferences && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse"></div>
              <span className="text-blue-800 font-medium text-sm">
                Loading personalized content for: {userPreferences.topics?.join(', ') || 'your preferences'}
              </span>
            </div>
          </div>
        )}
        
        <div data-testid="loading-indicator" className="space-y-6">
          {[...Array(3)].map((_, index) => (
            <div key={index} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 animate-pulse">
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-4 w-3/4"></div>
              <div className="space-y-2 mb-4">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/6"></div>
              </div>
              <div className="flex justify-between items-center">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className={`w-full max-w-4xl mx-auto p-4 ${className}`} data-testid="news-feed">
        <div data-testid="error-message" className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
          <div className="text-red-600 dark:text-red-400 mb-4">
            <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <h3 className="text-lg font-semibold mb-2">Unable to load news feed</h3>
            <p className="text-sm text-red-500 dark:text-red-300 mb-4">{state.error}</p>
          </div>
          <button
            data-testid="retry-button"
            onClick={handleRefresh}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md transition-colors duration-200"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (state.summaries.length === 0) {
    return (
      <div className={`w-full max-w-4xl mx-auto p-4 ${className}`} data-testid="news-feed">
        <div data-testid="fallback-content" className="bg-gray-50 dark:bg-gray-800 rounded-lg p-8 text-center">
          <div className="text-gray-400 dark:text-gray-500 mb-4">
            <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9.5a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-400 mb-2">No news available</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              We couldn't find any personalized news for you right now.
            </p>
          </div>
          <button
            data-testid="refresh-button"
            onClick={handleRefresh}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors duration-200"
          >
            Refresh Feed
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full max-w-4xl mx-auto p-4 ${className}`} data-testid="news-feed">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            {userId === 'demo-user' ? 'SmartKhabar Demo - AI News Feed' : 'Your Personalized News'}
          </h1>
          {state.lastUpdated && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Last updated {formatTimeAgo(state.lastUpdated)}
            </p>
          )}
        </div>
        <button
          data-testid="refresh-button"
          onClick={handleRefresh}
          disabled={state.loading}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-md transition-colors duration-200 text-sm font-medium"
        >
          <svg className={`w-4 h-4 ${state.loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Personalization Status */}
      {userPreferences && (
        <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-3 animate-pulse"></div>
              <div>
                <h3 className="text-green-800 font-semibold text-sm">
                  🎯 Personalized Feed Active
                </h3>
                <p className="text-green-700 text-xs mt-1">
                  Showing content based on your preferences: {userPreferences.topics?.join(', ') || 'default topics'}
                </p>
              </div>
            </div>
            <div className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
              {state.summaries.length} articles
            </div>
          </div>
        </div>
      )}

      {/* API Usage Info for Demo */}
      {userId === 'demo-user' && state.summaries.length > 0 && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-sm font-semibold text-green-800 dark:text-green-200">
              Live API Integration Active
            </h3>
          </div>
          <div className="text-sm text-green-700 dark:text-green-300 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <strong>📡 GNews API:</strong> Fetched {state.summaries.length} articles from multiple sources
            </div>
            <div>
              <strong>🤖 Hugging Face AI:</strong> Generated personalized summaries with tone adaptation
            </div>
            <div>
              <strong>🗄️ Neon Database:</strong> Real-time data storage and retrieval
            </div>
          </div>
        </div>
      )}

      {/* News Feed */}
      <div className="space-y-6">
        {state.summaries.map((summary) => (
          <article
            key={summary.id}
            data-testid="news-article"
            className="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 p-6"
          >
            {/* Summary Content */}
            <div className="mb-4">
              <div className="prose dark:prose-invert max-w-none">
                <p data-testid="article-summary" className="text-gray-800 dark:text-gray-200 leading-relaxed">
                  {summary.content}
                </p>
              </div>
            </div>

            {/* Key Points */}
            {summary.keyPoints && summary.keyPoints.length > 0 && (
              <div className="mb-4" data-testid="article-key-points">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Key Points:
                </h4>
                <ul className="space-y-1">
                  {summary.keyPoints.map((point, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Footer */}
            <div className="flex flex-col gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              {/* Article Info */}
              <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1" data-testid="article-timestamp">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {summary.estimatedReadingTime} min read
                </span>
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  {summary.tone}
                </span>
                <span className="text-xs" data-testid="article-source">
                  {summary.sourceArticles.length} source{summary.sourceArticles.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Interaction Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    data-testid="read-more-button"
                    onClick={() => handleReadMore(summary)}
                    disabled={state.interactionLoading.has(summary.id)}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors duration-200 disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Read More
                  </button>

                  <button
                    data-testid="like-button"
                    onClick={() => handleLike(summary)}
                    disabled={state.interactionLoading.has(summary.id)}
                    className={`flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors duration-200 disabled:opacity-50 ${
                      state.likedArticles.has(summary.id)
                        ? 'text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 active liked'
                        : 'text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                    }`}
                  >
                    <svg className={`w-4 h-4 ${state.likedArticles.has(summary.id) ? 'fill-current' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    {state.likedArticles.has(summary.id) ? 'Liked' : 'Like'}
                  </button>

                  <button
                    onClick={() => handleShare(summary)}
                    disabled={state.interactionLoading.has(summary.id)}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors duration-200 disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                    </svg>
                    Share
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    data-testid="hide-source-button"
                    onClick={() => handleHideSource(summary)}
                    disabled={state.interactionLoading.has(summary.id)}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors duration-200 disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                    </svg>
                    Hide Source
                  </button>

                  {/* Source Links */}
                  <div className="text-xs text-gray-400 dark:text-gray-500">
                    Published {formatTimeAgo(new Date())}
                  </div>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}