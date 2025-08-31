'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Summary, InteractionResponse, UserPreferences } from '@/types';

interface PersonalizedNewsFeedProps {
  userId?: string;
  className?: string;
  onPreferencesChange?: () => void;
  userPreferences?: UserPreferences;
  preferencesUpdated?: number;
}

interface PersonalizedFeedState {
  summaries: Summary[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  lastUpdated: Date | null;
  hiddenSources: Set<string>;
  likedArticles: Set<string>;
  bookmarkedArticles: Set<string>;
  interactionLoading: Set<string>;
  personalizedScore: number;
  feedStats: {
    totalArticles: number;
    personalizedArticles: number;
    topCategories: string[];
    readingTime: number;
  };
  viewMode: 'card' | 'list' | 'magazine';
  sortBy: 'relevance' | 'time' | 'popularity';
  page: number;
  hasMore: boolean;
}

const PERSONALIZATION_TIPS = [
  "💡 Like articles to improve your feed",
  "🎯 Update your preferences for better content",
  "📚 Bookmark articles to read later",
  "🔍 Your feed learns from your interactions",
  "⭐ Rate articles to enhance personalization"
];

export default function PersonalizedNewsFeed({ 
  userId = 'demo-user', 
  className = '',
  onPreferencesChange,
  userPreferences,
  preferencesUpdated = 0
}: PersonalizedNewsFeedProps) {
  const [state, setState] = useState<PersonalizedFeedState>({
    summaries: [],
    loading: true,
    loadingMore: false,
    error: null,
    lastUpdated: null,
    hiddenSources: new Set(),
    likedArticles: new Set(),
    bookmarkedArticles: new Set(),
    interactionLoading: new Set(),
    personalizedScore: 0,
    feedStats: {
      totalArticles: 0,
      personalizedArticles: 0,
      topCategories: [],
      readingTime: 0
    },
    viewMode: 'card',
    sortBy: 'relevance',
    page: 1,
    hasMore: true
  });

  const [currentTip, setCurrentTip] = useState(0);

  // Rotate personalization tips
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTip((prev) => (prev + 1) % PERSONALIZATION_TIPS.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchPersonalizedFeed = useCallback(async () => {
    if (!userId) return;
    
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      // Build personalized query based on user preferences
      let apiUrl = `/api/news/personalized/simple?userId=${userId}&limit=30`;
      
      if (userPreferences?.topics && userPreferences.topics.length > 0) {
        const categories = userPreferences.topics.join(',');
        apiUrl += `&categories=${encodeURIComponent(categories)}`;
      }
      
      if (userPreferences?.preferredSources && userPreferences.preferredSources.length > 0) {
        const sources = userPreferences.preferredSources.join(',');
        apiUrl += `&sources=${encodeURIComponent(sources)}`;
      }
      
      // Try personalized endpoint first
      let response = await fetch(apiUrl);
      let data = await response.json();
      
      if (!data.success || !data.articles || data.articles.length === 0) {
        // Fallback to free news with user's preferred categories
        let fallbackUrl = '/api/news/free?limit=30';
        if (userPreferences?.topics && userPreferences.topics.length > 0) {
          fallbackUrl += `&category=${encodeURIComponent(userPreferences.topics[0])}`;
        }
        response = await fetch(fallbackUrl);
        data = await response.json();
      }
      
      if (data.success && data.articles) {
        // Convert articles to summaries format with enhanced metadata
        const summaries = data.articles.map((article: any, index: number) => ({
          id: article.id || `article-${Date.now()}-${index}`,
          content: article.summary || article.description || article.content?.substring(0, 300) + '...',
          keyPoints: article.keyPoints || [],
          category: article.category || 'General',
          publishedAt: article.publishedAt || article.pubDate || new Date().toISOString(),
          sourceArticles: [article.url || article.link || '#'],
          estimatedReadingTime: Math.ceil((article.summary || article.description || '').length / 200) || 3,
          tone: userPreferences?.tone || 'casual',
          title: article.title || article.headline || 'No Title Available',
          source: article.source || 'Unknown Source',
          imageUrl: article.image || article.urlToImage,
          relevanceScore: Math.random() * 0.3 + 0.7, // Simulate relevance score
          sentiment: article.sentiment || 'neutral',
          tags: article.tags || []
        }));

        // Calculate personalization metrics
        const personalizedArticles = summaries.filter((s: any) => 
          userPreferences?.topics?.some(topic => 
            s.category.toLowerCase().includes(topic.toLowerCase())
          )
        ).length;

        const topCategories = [...new Set(summaries.map((s: any) => s.category as string))] as string[];
        const topCategoriesSliced = topCategories.slice(0, 3);
        const totalReadingTime = summaries.reduce((acc: number, s: any) => acc + s.estimatedReadingTime, 0);
        const personalizedScore = Math.round((personalizedArticles / summaries.length) * 100);

        setState(prev => ({
          ...prev,
          summaries,
          loading: false,
          lastUpdated: new Date(),
          error: null,
          personalizedScore,
          feedStats: {
            totalArticles: summaries.length,
            personalizedArticles,
            topCategories: topCategoriesSliced,
            readingTime: totalReadingTime
          }
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
  }, [userId, userPreferences]);

  useEffect(() => {
    fetchPersonalizedFeed();
  }, [fetchPersonalizedFeed, preferencesUpdated]);

  const trackInteraction = async (articleId: string, action: 'read_more' | 'hide' | 'like' | 'share' | 'bookmark') => {
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
      } else if (action === 'bookmark') {
        setState(prev => ({
          ...prev,
          bookmarkedArticles: new Set([...prev.bookmarkedArticles, articleId])
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
    const articleUrl = summary.sourceArticles?.[0];
    if (articleUrl && articleUrl !== '#') {
      window.open(articleUrl, '_blank', 'noopener,noreferrer');
      trackInteraction(summary.id, 'read_more');
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return 'text-green-600 bg-green-100';
      case 'negative': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getRelevanceColor = (score: number) => {
    if (score >= 0.8) return 'bg-green-500';
    if (score >= 0.6) return 'bg-yellow-500';
    return 'bg-gray-400';
  };

  if (state.loading) {
    return (
      <div className={`w-full max-w-6xl mx-auto p-6 ${className}`}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-2xl p-6 text-white">
            <div className="flex items-center gap-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
              <div>
                <h2 className="text-2xl font-bold">Personalizing Your Feed</h2>
                <p className="text-blue-100">
                  {userPreferences?.topics ? 
                    `Curating content for: ${userPreferences.topics.join(', ')}` : 
                    'Loading your personalized news experience...'
                  }
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-xl shadow-lg p-6 animate-pulse"
            >
              <div className="h-4 bg-gray-200 rounded mb-4 w-3/4"></div>
              <div className="space-y-2 mb-4">
                <div className="h-3 bg-gray-200 rounded w-full"></div>
                <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                <div className="h-3 bg-gray-200 rounded w-4/6"></div>
              </div>
              <div className="flex justify-between items-center">
                <div className="h-3 bg-gray-200 rounded w-20"></div>
                <div className="h-3 bg-gray-200 rounded w-16"></div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className={`w-full max-w-6xl mx-auto p-6 ${className}`}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-red-50 border border-red-200 rounded-xl p-8 text-center"
        >
          <div className="text-red-500 mb-4">
            <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <h3 className="text-xl font-bold mb-2">Unable to Load Your Feed</h3>
            <p className="text-red-600 mb-6">{state.error}</p>
          </div>
          <button
            onClick={fetchPersonalizedFeed}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Try Again
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`w-full max-w-6xl mx-auto p-6 ${className}`}>
      {/* Enhanced Header with Personalization Stats */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-2xl p-6 text-white shadow-2xl">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-2">
                🎯 Your Personalized Feed
              </h1>
              <p className="text-indigo-100 mb-4">
                {state.personalizedScore}% personalized • {state.feedStats.totalArticles} articles • {state.feedStats.readingTime} min read
              </p>
              
              {/* Personalization Score Bar */}
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">Personalization:</span>
                <div className="flex-1 bg-white/20 rounded-full h-2 max-w-xs">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${state.personalizedScore}%` }}
                    transition={{ duration: 1, delay: 0.5 }}
                    className="bg-white rounded-full h-2"
                  />
                </div>
                <span className="text-sm font-bold">{state.personalizedScore}%</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              {/* View Mode Toggle */}
              <div className="flex bg-white/20 rounded-lg p-1">
                {(['card', 'list', 'magazine'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setState(prev => ({ ...prev, viewMode: mode }))}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                      state.viewMode === mode 
                        ? 'bg-white text-indigo-600' 
                        : 'text-white hover:bg-white/10'
                    }`}
                  >
                    {mode === 'card' ? '📱' : mode === 'list' ? '📋' : '📰'} {mode}
                  </button>
                ))}
              </div>

              <button
                onClick={fetchPersonalizedFeed}
                disabled={state.loading}
                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                <svg className={`w-4 h-4 ${state.loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Personalization Insights */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
              <span className="text-white font-bold">{state.feedStats.personalizedArticles}</span>
            </div>
            <div>
              <h3 className="font-semibold text-green-800">Personalized Articles</h3>
              <p className="text-green-600 text-sm">Matched to your interests</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white text-lg">📚</span>
            </div>
            <div>
              <h3 className="font-semibold text-blue-800">Top Categories</h3>
              <p className="text-blue-600 text-sm">{state.feedStats.topCategories.join(', ')}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center">
              <span className="text-white text-lg">💡</span>
            </div>
            <div>
              <h3 className="font-semibold text-purple-800">Smart Tip</h3>
              <AnimatePresence mode="wait">
                <motion.p
                  key={currentTip}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="text-purple-600 text-sm"
                >
                  {PERSONALIZATION_TIPS[currentTip]}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Articles Grid/List */}
      <AnimatePresence>
        {state.viewMode === 'card' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {state.summaries.map((summary, index) => (
              <motion.article
                key={summary.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group"
              >
                {/* Article Image */}
                {(summary as any).imageUrl && (
                  <div className="relative h-48 overflow-hidden">
                    <img
                      src={(summary as any).imageUrl}
                      alt={(summary as any).title || 'Article image'}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-3 right-3 flex gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSentimentColor((summary as any).sentiment || 'neutral')}`}>
                        {(summary as any).sentiment || 'neutral'}
                      </span>
                      <div className="flex items-center gap-1 bg-black/50 text-white px-2 py-1 rounded-full text-xs">
                        <div className={`w-2 h-2 rounded-full ${getRelevanceColor((summary as any).relevanceScore || 0.5)}`}></div>
                        {Math.round(((summary as any).relevanceScore || 0.5) * 100)}%
                      </div>
                    </div>
                  </div>
                )}

                <div className="p-6">
                  {/* Category and Time */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs font-medium">
                      {(summary as any).category}
                    </span>
                    <span className="text-gray-500 text-xs">
                      {formatTimeAgo((summary as any).publishedAt)}
                    </span>
                  </div>

                  {/* Title */}
                  {(summary as any).title && (
                    <h3 className="font-bold text-gray-900 mb-3 line-clamp-2 group-hover:text-indigo-600 transition-colors">
                      {(summary as any).title}
                    </h3>
                  )}

                  {/* Content */}
                  <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                    {summary.content}
                  </p>

                  {/* Tags */}
                  {(summary as any).tags && (summary as any).tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {(summary as any).tags.slice(0, 3).map((tag: string, tagIndex: number) => (
                        <span key={tagIndex} className="px-2 py-1 bg-gray-100 text-gray-600 rounded-md text-xs">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => trackInteraction(summary.id, 'like')}
                        disabled={state.interactionLoading.has(summary.id)}
                        className={`p-2 rounded-full transition-colors ${
                          state.likedArticles.has(summary.id)
                            ? 'text-red-500 bg-red-50'
                            : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                        }`}
                      >
                        <svg className="w-4 h-4" fill={state.likedArticles.has(summary.id) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                      </button>

                      <button
                        onClick={() => trackInteraction(summary.id, 'bookmark')}
                        disabled={state.interactionLoading.has(summary.id)}
                        className={`p-2 rounded-full transition-colors ${
                          state.bookmarkedArticles.has(summary.id)
                            ? 'text-yellow-500 bg-yellow-50'
                            : 'text-gray-400 hover:text-yellow-500 hover:bg-yellow-50'
                        }`}
                      >
                        <svg className="w-4 h-4" fill={state.bookmarkedArticles.has(summary.id) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                        </svg>
                      </button>
                    </div>

                    <button
                      onClick={() => handleReadMore(summary)}
                      className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium text-sm transition-colors"
                    >
                      Read More
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </button>
                  </div>
                </div>
              </motion.article>
            ))}
          </motion.div>
        )}

        {state.viewMode === 'list' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {state.summaries.map((summary, index) => (
              <motion.article
                key={summary.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-6 flex gap-6"
              >
                {(summary as any).imageUrl && (
                  <div className="w-32 h-24 flex-shrink-0">
                    <img
                      src={(summary as any).imageUrl}
                      alt={(summary as any).title || 'Article image'}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  </div>
                )}
                
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs font-medium">
                      {(summary as any).category}
                    </span>
                    <span className="text-gray-500 text-xs">
                      {formatTimeAgo((summary as any).publishedAt)}
                    </span>
                    <div className="flex items-center gap-1">
                      <div className={`w-2 h-2 rounded-full ${getRelevanceColor((summary as any).relevanceScore || 0.5)}`}></div>
                      <span className="text-xs text-gray-500">{Math.round(((summary as any).relevanceScore || 0.5) * 100)}% match</span>
                    </div>
                  </div>
                  
                  {(summary as any).title && (
                    <h3 className="font-bold text-gray-900 mb-2 hover:text-indigo-600 transition-colors cursor-pointer">
                      {(summary as any).title}
                    </h3>
                  )}
                  
                  <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                    {summary.content}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => trackInteraction(summary.id, 'like')}
                        className={`flex items-center gap-1 text-sm ${
                          state.likedArticles.has(summary.id) ? 'text-red-500' : 'text-gray-500 hover:text-red-500'
                        }`}
                      >
                        <svg className="w-4 h-4" fill={state.likedArticles.has(summary.id) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                        Like
                      </button>
                      
                      <button
                        onClick={() => trackInteraction(summary.id, 'bookmark')}
                        className={`flex items-center gap-1 text-sm ${
                          state.bookmarkedArticles.has(summary.id) ? 'text-yellow-500' : 'text-gray-500 hover:text-yellow-500'
                        }`}
                      >
                        <svg className="w-4 h-4" fill={state.bookmarkedArticles.has(summary.id) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                        </svg>
                        Save
                      </button>
                    </div>
                    
                    <button
                      onClick={() => handleReadMore(summary)}
                      className="text-indigo-600 hover:text-indigo-800 font-medium text-sm"
                    >
                      Read More →
                    </button>
                  </div>
                </div>
              </motion.article>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Load More Button */}
      {state.summaries.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center mt-12"
        >
          <button
            onClick={() => {
              setState(prev => ({ ...prev, page: prev.page + 1 }));
              fetchPersonalizedFeed();
            }}
            disabled={state.loadingMore}
            className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-8 py-3 rounded-xl font-medium transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50"
          >
            {state.loadingMore ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Loading More...
              </div>
            ) : (
              'Load More Personalized Content'
            )}
          </button>
        </motion.div>
      )}
    </div>
  );
}