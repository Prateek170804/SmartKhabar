'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Wifi, WifiOff, RefreshCw, Clock, Newspaper, TrendingUp, Zap } from 'lucide-react';

interface Article {
  id: string;
  headline: string;
  content: string;
  source: string;
  publishedAt: string;
  url: string;
  imageUrl?: string;
  category: string;
  priority?: 'high' | 'medium' | 'low';
}

interface NewsUpdate {
  type: 'breaking' | 'update' | 'personalized';
  article: Article;
  timestamp: string;
  priority: 'high' | 'medium' | 'low';
}

interface RealTimeNewsFeedProps {
  userId?: string;
  preferences?: {
    categories: string[];
    sources: string[];
    autoRefresh: boolean;
    notifications: boolean;
  };
  className?: string;
}

export default function RealTimeNewsFeed({ 
  userId, 
  preferences = { categories: ['general'], sources: [], autoRefresh: true, notifications: true },
  className = '' 
}: RealTimeNewsFeedProps) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [notifications, setNotifications] = useState<NewsUpdate[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setConnectionStatus('connecting');
    
    // Use secure WebSocket in production
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws`;
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setConnectionStatus('connected');
        reconnectAttempts.current = 0;
        
        // Authenticate if user is logged in
        if (userId) {
          const token = localStorage.getItem('auth_token');
          if (token) {
            ws.send(JSON.stringify({
              type: 'authenticate',
              token
            }));
          }
        }

        // Subscribe to preferred categories
        ws.send(JSON.stringify({
          type: 'subscribe',
          filters: {
            categories: preferences.categories,
            sources: preferences.sources,
            userId
          }
        }));

        // Request initial breaking news
        ws.send(JSON.stringify({ type: 'get_breaking' }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleWebSocketMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        setConnectionStatus('disconnected');
        wsRef.current = null;
        
        // Attempt to reconnect
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connectWebSocket();
          }, delay);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('disconnected');
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionStatus('disconnected');
    }
  }, [userId, preferences]);

  const handleWebSocketMessage = useCallback((message: any) => {
    switch (message.type) {
      case 'connected':
        console.log('WebSocket connected:', message.connectionId);
        break;

      case 'authenticated':
        console.log('WebSocket authenticated for user:', message.user.name);
        break;

      case 'breaking_news':
        setArticles(message.articles);
        setIsLoading(false);
        setLastUpdate(new Date());
        break;

      case 'news_update':
        const update = message.update as NewsUpdate;
        
        // Add to articles if not already present
        setArticles(prev => {
          const exists = prev.some(article => article.id === update.article.id);
          if (!exists) {
            return [update.article, ...prev].slice(0, 100); // Keep only latest 100 for better experience
          }
          return prev;
        });

        // Add to notifications
        if (preferences.notifications) {
          setNotifications(prev => [update, ...prev].slice(0, 10));
          
          // Show browser notification for high priority
          if (update.priority === 'high' && 'Notification' in window && Notification.permission === 'granted') {
            new Notification(`Breaking: ${update.article.headline}`, {
              body: update.article.content.substring(0, 100) + '...',
              icon: '/favicon.ico',
              tag: update.article.id
            });
          }
        }
        
        setLastUpdate(new Date());
        break;

      case 'breaking_alert':
        const alert = message.update as NewsUpdate;
        
        // Show prominent notification for breaking alerts
        setNotifications(prev => [alert, ...prev]);
        setShowNotifications(true);
        
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(`🚨 BREAKING: ${alert.article.headline}`, {
            body: alert.article.content.substring(0, 100) + '...',
            icon: '/favicon.ico',
            tag: 'breaking-' + alert.article.id,
            requireInteraction: true
          });
        }
        break;

      case 'pong':
        // Keep connection alive
        break;

      default:
        console.log('Unknown message type:', message.type);
    }
  }, [preferences.notifications]);

  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }, []);

  const refreshNews = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'get_breaking' }));
    } else {
      // Fallback to HTTP request
      fetchNewsHTTP();
    }
  }, []);

  const fetchNewsHTTP = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Try multiple endpoints for better reliability - increased limit to 30
      let response = await fetch('/api/news/breaking-simple?limit=30');
      let data = await response.json();
      
      if (!data.success || !data.articles || data.articles.length === 0) {
        // Fallback to free news endpoint
        response = await fetch('/api/news/free?limit=30');
        data = await response.json();
      }
      
      if (data.success && data.articles) {
        const processedArticles = data.articles.map((article: any, index: number) => ({
          id: article.id || `http-${Date.now()}-${Math.random()}`,
          headline: article.title || article.headline || 'No Title Available',
          content: article.summary || article.description || article.content?.substring(0, 250) + '...' || 'No content available',
          source: article.source || 'News Source',
          publishedAt: article.publishedAt || article.pubDate || new Date().toISOString(),
          url: article.url || article.link || '#',
          imageUrl: article.imageUrl || article.image,
          category: article.category || 'General',
          priority: index < 3 ? 'high' : index < 10 ? 'medium' : 'low' // Make first 3 high priority, next 7 medium
        }));
        
        setArticles(processedArticles);
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error('Error fetching news via HTTP:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'medium': return 'text-orange-600 bg-orange-50';
      default: return 'text-blue-600 bg-blue-50';
    }
  };

  useEffect(() => {
    connectWebSocket();
    requestNotificationPermission();

    // Fallback: fetch initial data via HTTP
    fetchNewsHTTP();

    // Ping WebSocket every 30 seconds to keep connection alive
    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      clearInterval(pingInterval);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectWebSocket, requestNotificationPermission, fetchNewsHTTP]);

  return (
    <div className={`bg-white rounded-2xl shadow-2xl overflow-hidden ${className}`}>
      {/* Stunning Enhanced Header */}
      <div className="relative bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-700 text-white p-6 overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl animate-pulse" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-300/20 rounded-full blur-xl animate-bounce" />
          <div className="absolute top-1/2 left-1/2 w-40 h-40 bg-purple-400/10 rounded-full blur-3xl animate-pulse" />
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <motion.div 
                className="flex items-center space-x-3"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
              >
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <Zap className="w-8 h-8 text-yellow-300 drop-shadow-lg" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold drop-shadow-lg">Live News Feed</h2>
                  <p className="text-blue-100 text-sm font-medium">Real-time breaking news</p>
                </div>
              </motion.div>
              
              <motion.div 
                className="flex items-center space-x-3"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
              >
                {isConnected ? (
                  <div className="flex items-center space-x-2 bg-green-500/20 px-4 py-2 rounded-xl backdrop-blur-sm border border-green-400/30">
                    <Wifi className="w-5 h-5 text-green-300" />
                    <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse shadow-lg"></div>
                    <span className="text-green-100 font-semibold text-sm">CONNECTED</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2 bg-red-500/20 px-4 py-2 rounded-xl backdrop-blur-sm border border-red-400/30">
                    <WifiOff className="w-5 h-5 text-red-300" />
                    <span className="text-red-100 font-semibold text-sm">OFFLINE</span>
                  </div>
                )}
                
                <div className={`px-4 py-2 rounded-xl font-bold text-sm backdrop-blur-sm border shadow-lg ${
                  connectionStatus === 'connected' ? 'bg-emerald-500/30 text-emerald-100 border-emerald-400/30' :
                  connectionStatus === 'connecting' ? 'bg-yellow-500/30 text-yellow-100 border-yellow-400/30' :
                  'bg-red-500/30 text-red-100 border-red-400/30'
                }`}>
                  {connectionStatus === 'connected' ? '🟢 LIVE' : 
                   connectionStatus === 'connecting' ? '🟡 CONNECTING' : '🔴 OFFLINE'}
                </div>
              </motion.div>
            </div>
            
            <motion.div 
              className="flex items-center space-x-3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-3 bg-white/20 hover:bg-white/30 rounded-xl transition-all duration-300 backdrop-blur-sm border border-white/30 shadow-lg hover:scale-105"
              >
                <Bell className="w-6 h-6" />
                {notifications.length > 0 && (
                  <motion.span 
                    className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold shadow-lg"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    {notifications.length}
                  </motion.span>
                )}
              </button>
              
              <button
                onClick={refreshNews}
                disabled={isLoading}
                className="p-3 bg-white/20 hover:bg-white/30 rounded-xl transition-all duration-300 disabled:opacity-50 backdrop-blur-sm border border-white/30 shadow-lg hover:scale-105"
              >
                <RefreshCw className={`w-6 h-6 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </motion.div>
          </div>
          
          {/* Enhanced Live Stats */}
          <motion.div 
            className="flex flex-wrap items-center gap-4 text-sm"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
          >
            <div className="flex items-center space-x-2 bg-white/10 px-3 py-2 rounded-lg backdrop-blur-sm">
              <TrendingUp className="w-4 h-4 text-green-300" />
              <span className="text-blue-100 font-medium">Real-time Updates</span>
            </div>
            
            {preferences.autoRefresh && isConnected && (
              <div className="flex items-center space-x-2 bg-white/10 px-3 py-2 rounded-lg backdrop-blur-sm">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-lg"></div>
                <span className="text-blue-100 font-medium">Auto-refreshing</span>
              </div>
            )}
            
            <div className="flex items-center space-x-2 bg-white/10 px-3 py-2 rounded-lg backdrop-blur-sm">
              <Clock className="w-4 h-4 text-blue-300" />
              <span className="text-blue-100 font-medium">Updated: {lastUpdate.toLocaleTimeString()}</span>
            </div>
            
            <div className="flex items-center space-x-2 bg-white/10 px-3 py-2 rounded-lg backdrop-blur-sm">
              <Newspaper className="w-4 h-4 text-purple-300" />
              <span className="text-blue-100 font-medium">{articles.length} Articles</span>
            </div>
          </motion.div>
        </div>
      </div>



      {/* Notifications Panel */}
      <AnimatePresence>
        {showNotifications && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-gray-200 bg-yellow-50"
          >
            <div className="p-4">
              <h3 className="font-semibold text-gray-900 mb-2">Recent Updates</h3>
              {notifications.length === 0 ? (
                <p className="text-gray-600 text-sm">No new notifications</p>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {notifications.map((notification, index) => (
                    <div key={index} className={`p-2 rounded text-sm ${getPriorityColor(notification.priority)}`}>
                      <div className="font-medium">{notification.article.headline}</div>
                      <div className="text-xs opacity-75">
                        {formatTimeAgo(notification.timestamp)} • {notification.article.source}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Articles Count Display */}
      <div className="px-4 py-2 bg-blue-50 border-b border-blue-100">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-blue-800">
            📰 {articles.length} Live Articles Available
          </span>
          <span className="text-xs text-blue-600">
            {articles.filter(a => a.priority === 'high').length} Breaking • {articles.filter(a => a.priority === 'medium').length} Trending
          </span>
        </div>
      </div>

      {/* Articles List */}
      <div className="max-h-[800px] overflow-y-auto">
        {isLoading && articles.length === 0 ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 text-lg">Loading latest news...</p>
            <p className="text-gray-500 text-sm mt-2">Fetching real-time updates...</p>
          </div>
        ) : articles.length === 0 ? (
          <div className="p-8 text-center text-gray-600">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <Bell className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-lg font-medium mb-2">No news articles available</p>
            <p className="text-sm text-gray-500 mb-4">We're working to get you the latest updates</p>
            <button
              onClick={refreshNews}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Refresh News Feed
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            <AnimatePresence>
              {articles.map((article, index) => (
                <motion.article
                  key={article.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.05 }}
                  className={`relative group hover:shadow-md transition-all duration-200 ${
                    article.priority === 'high' 
                      ? 'bg-gradient-to-r from-red-50 to-orange-50 border-l-4 border-red-500' 
                      : article.priority === 'medium'
                      ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500'
                      : 'bg-white hover:bg-gray-50 border-l-4 border-gray-200'
                  } p-4 border-b border-gray-100`}
                >
                  <div className="flex space-x-4">
                    {/* Article Image */}
                    <div className="flex-shrink-0">
                      {article.imageUrl ? (
                        <img
                          src={article.imageUrl}
                          alt={article.headline}
                          className="w-24 h-24 object-cover rounded-xl shadow-sm group-hover:shadow-md transition-shadow"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-24 h-24 bg-gradient-to-br from-gray-200 to-gray-300 rounded-xl flex items-center justify-center">
                          <Newspaper className="w-8 h-8 text-gray-500" />
                        </div>
                      )}
                    </div>
                    
                    {/* Article Content */}
                    <div className="flex-1 min-w-0">
                      {/* Header with Priority Badge */}
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2 mb-1">
                          {article.priority === 'high' && (
                            <span className="inline-flex items-center px-2 py-1 bg-red-100 text-red-800 text-xs font-bold rounded-full animate-pulse">
                              🚨 BREAKING
                            </span>
                          )}
                          {article.priority === 'medium' && (
                            <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                              📈 TRENDING
                            </span>
                          )}
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            article.category === 'technology' ? 'bg-purple-100 text-purple-800' :
                            article.category === 'business' ? 'bg-green-100 text-green-800' :
                            article.category === 'sports' ? 'bg-orange-100 text-orange-800' :
                            article.category === 'health' ? 'bg-pink-100 text-pink-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {article.category.toUpperCase()}
                          </span>
                        </div>
                      </div>
                      
                      {/* Article Title */}
                      <h3 className={`font-bold mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors ${
                        article.priority === 'high' ? 'text-xl text-gray-900' : 'text-lg text-gray-800'
                      }`}>
                        <a
                          href={article.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline"
                        >
                          {article.headline}
                        </a>
                      </h3>
                      
                      {/* Article Summary */}
                      <p className="text-gray-600 text-sm line-clamp-3 mb-3 leading-relaxed">
                        {article.content}
                      </p>
                      
                      {/* Article Meta */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3 text-xs text-gray-500">
                          <span className="font-semibold text-gray-700">{article.source}</span>
                          <span>•</span>
                          <span className="flex items-center">
                            <Clock className="w-3 h-3 mr-1" />
                            {formatTimeAgo(article.publishedAt)}
                          </span>
                        </div>
                        
                        <button
                          onClick={() => window.open(article.url, '_blank')}
                          className="text-blue-600 hover:text-blue-800 text-xs font-medium hover:underline transition-colors"
                        >
                          Read Full Article →
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Hover Effect Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent to-blue-50 opacity-0 group-hover:opacity-20 transition-opacity pointer-events-none rounded-lg"></div>
                </motion.article>
              ))}
            </AnimatePresence>
            
            {/* Load More Button */}
            {articles.length >= 20 && (
              <div className="p-4 text-center border-t border-gray-200 bg-gray-50">
                <button
                  onClick={refreshNews}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  Load More Articles
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}