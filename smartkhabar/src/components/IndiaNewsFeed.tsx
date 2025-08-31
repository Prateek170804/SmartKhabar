'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NewsArticle } from '@/types';

interface IndiaNewsFeedProps {
  initialArticles?: NewsArticle[];
  onArticleClick?: (article: NewsArticle) => void;
  className?: string;
}

interface IndiaNewsData {
  articles?: NewsArticle[];
  totalCollected: number;
}

export default function IndiaNewsFeed({ 
  initialArticles = [], 
  onArticleClick,
  className = '' 
}: IndiaNewsFeedProps) {
  const [articles, setArticles] = useState<NewsArticle[]>(initialArticles);
  const [newsData, setNewsData] = useState<IndiaNewsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Fetch India news
  const fetchIndiaNews = useCallback(async (pageNum = 1, append = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: '50',
        page: pageNum.toString(),
        enableScraping: 'true',
        enableSummary: 'true'
      });

      const response = await fetch(`/api/news/india?${params}`);
      const data = await response.json();

      if (data.success) {
        setNewsData(data.data);
        
        if (data.data.articles) {
          if (append) {
            // Append new articles to existing ones
            setArticles(prev => {
              const existingIds = new Set(prev.map(article => article.id));
              const newArticles = data.data.articles.filter((article: NewsArticle) => !existingIds.has(article.id));
              return [...prev, ...newArticles];
            });
          } else {
            // Replace articles for initial load
            setArticles(data.data.articles);
          }
          
          // Check if there are more articles to load
          setHasMore(data.data.articles.length === 50);
        }
      } else {
        throw new Error(data.error?.message || 'Failed to fetch India news');
      }
    } catch (err) {
      setError((err as Error).message);
      console.error('India news fetch error:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Load more articles
  const loadMoreArticles = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    
    const nextPage = page + 1;
    setPage(nextPage);
    await fetchIndiaNews(nextPage, true);
  }, [page, hasMore, loadingMore, fetchIndiaNews]);

  // Fetch news on component mount
  useEffect(() => {
    fetchIndiaNews(1, false);
  }, []);

  // Get category color
  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      politics: 'bg-red-100 text-red-800',
      business: 'bg-green-100 text-green-800',
      technology: 'bg-blue-100 text-blue-800',
      sports: 'bg-orange-100 text-orange-800',
      entertainment: 'bg-purple-100 text-purple-800',
      health: 'bg-pink-100 text-pink-800',
      science: 'bg-indigo-100 text-indigo-800',
      environment: 'bg-emerald-100 text-emerald-800',
      breaking: 'bg-red-200 text-red-900',
      default: 'bg-gray-100 text-gray-800'
    };
    return colors[category] || colors.default;
  };

  // Format time ago
  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  return (
    <div className={`india-news-feed ${className}`}>
      {/* Stunning Header */}
      <motion.div 
        className="mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="relative bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 rounded-2xl p-8 shadow-2xl overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/20 to-transparent" />
            <div className="absolute top-4 right-4 w-32 h-32 bg-white/10 rounded-full blur-xl" />
            <div className="absolute bottom-4 left-4 w-24 h-24 bg-white/10 rounded-full blur-lg" />
          </div>
          
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <motion.div
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="text-6xl drop-shadow-lg"
              >
                🇮🇳
              </motion.div>
              <div className="text-white">
                <h2 className="text-4xl font-bold mb-2 drop-shadow-lg">
                  India News Hub
                </h2>
                <p className="text-orange-100 text-lg font-medium">
                  Latest news from across India
                </p>
              </div>
            </div>
            
            {/* Refresh Button */}
            <button
              onClick={() => fetchIndiaNews(1, false)}
              disabled={loading}
              className="bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-xl font-medium transition-all duration-300 backdrop-blur-sm border border-white/30 disabled:opacity-50"
            >
              <div className="flex items-center gap-2">
                <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {loading ? 'Loading...' : 'Refresh'}
              </div>
            </button>
          </div>
        </div>
      </motion.div>

      {/* Stats Dashboard */}
      {newsData && (
        <motion.div 
          className="mb-8 p-6 bg-gradient-to-r from-orange-50 via-red-50 to-pink-50 rounded-2xl border border-orange-200/50 shadow-xl backdrop-blur-sm"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <motion.div 
                className="text-center p-4 bg-white/60 rounded-xl shadow-lg backdrop-blur-sm border border-white/50"
                whileHover={{ scale: 1.05, y: -5 }}
                transition={{ duration: 0.3 }}
              >
                <div className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent mb-2">
                  {newsData.totalCollected}
                </div>
                <div className="text-sm font-semibold text-gray-700">📰 Total Articles</div>
              </motion.div>
              
              <motion.div 
                className="text-center p-4 bg-white/60 rounded-xl shadow-lg backdrop-blur-sm border border-white/50"
                whileHover={{ scale: 1.05, y: -5 }}
                transition={{ duration: 0.3 }}
              >
                <div className="text-4xl mb-2">🇮🇳</div>
                <div className="text-sm font-semibold text-gray-700">India Focus</div>
              </motion.div>
            </div>
            
            <div className="text-right">
              <div className="text-sm text-gray-600 mb-1">Last Updated</div>
              <div className="text-lg font-semibold text-gray-800">
                {new Date().toLocaleTimeString('en-IN', { 
                  hour: '2-digit', 
                  minute: '2-digit',
                  timeZone: 'Asia/Kolkata'
                })} IST
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
            <span className="text-gray-600">Loading India news...</span>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2">
            <span className="text-red-500">⚠️</span>
            <span className="text-red-700 font-medium">Error loading India news</span>
          </div>
          <p className="text-red-600 text-sm mt-1">{error}</p>
          <button
            onClick={() => fetchIndiaNews(1, false)}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Articles Grid */}
      {!loading && articles.length > 0 && (
        <div className="space-y-6">
          <AnimatePresence>
            {articles.map((article, index) => (
              <motion.article
                key={article.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-xl shadow-sm border-2 border-orange-100 hover:shadow-lg hover:border-orange-200 transition-all duration-300 cursor-pointer"
                onClick={() => onArticleClick?.(article)}
              >
                <div className="p-6">
                  {/* Article Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 flex-1">
                      <span className="text-2xl">📰</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(article.category)}`}>
                            {article.category}
                          </span>
                          {article.region && article.region !== 'national' && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {article.region}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600">
                          {article.source} • {formatTimeAgo(new Date(article.publishedAt))}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Article Content */}
                  <h3 className="text-xl font-bold text-gray-900 mb-3 line-clamp-2 hover:text-orange-600 transition-colors">
                    {article.headline}
                  </h3>
                  <p className="text-gray-700 mb-4 line-clamp-3">
                    {article.content}
                  </p>
                  
                  {/* Article Tags */}
                  {article.tags && article.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {article.tags.slice(0, 5).map(tag => (
                        <span
                          key={tag}
                          className="px-2 py-1 bg-gray-100 text-gray-600 rounded-md text-xs"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  {/* Article Footer */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>🇮🇳 India News</span>
                      {article.language && (
                        <span>🗣️ {article.language.toUpperCase()}</span>
                      )}
                    </div>
                    <button className="text-orange-600 hover:text-orange-700 font-medium text-sm">
                      Read More →
                    </button>
                  </div>
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* No Articles State */}
      {!loading && articles.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🇮🇳</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            No India news found
          </h3>
          <p className="text-gray-600 mb-4">
            Check back later for new articles from across India.
          </p>
          <button
            onClick={() => fetchIndiaNews(1, false)}
            className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
          >
            Refresh News
          </button>
        </div>
      )}

      {/* Load More Button */}
      {!loading && articles.length > 0 && hasMore && (
        <div className="text-center mt-8">
          <button
            onClick={loadMoreArticles}
            disabled={loadingMore}
            className="px-6 py-3 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-lg hover:from-orange-700 hover:to-red-700 transition-all duration-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingMore ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Loading More...
              </div>
            ) : (
              'Load More India News'
            )}
          </button>
        </div>
      )}
    </div>
  );
}