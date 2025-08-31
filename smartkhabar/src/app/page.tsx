'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Newspaper, TrendingUp, Clock, Users, Wifi, Bell } from 'lucide-react';
import NewsFeed from '@/components/NewsFeed';
import PersonalizedNewsFeed from '@/components/PersonalizedNewsFeed';
import RealTimeNewsFeed from '@/components/RealTimeNewsFeed';
import UserPreferences from '@/components/UserPreferences';
import EnhancedUserPreferences from '@/components/EnhancedUserPreferences';
import IndiaNewsFeed from '@/components/IndiaNewsFeed';

interface HealthStatus {
  status: string;
  timestamp: string;
  services: {
    database: string;
    newsApi: string;
    cache: string;
  };
}

export default function HomePage() {
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [activeTab, setActiveTab] = useState<'personalized' | 'realtime' | 'preferences' | 'india'>('realtime');
  const [isLoading, setIsLoading] = useState(true);
  const [userPreferences, setUserPreferences] = useState<any>(null);
  const [preferencesUpdated, setPreferencesUpdated] = useState(0);

  // Handle preference updates
  const handlePreferencesUpdate = (newPreferences: any) => {
    setUserPreferences(newPreferences);
    setPreferencesUpdated(prev => prev + 1);
    console.log('Preferences updated:', newPreferences);
  };

  useEffect(() => {
    const fetchHealthStatus = async () => {
      try {
        const response = await fetch('/api/health');
        const data = await response.json();
        setHealthStatus(data);
      } catch (error) {
        console.error('Failed to fetch health status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHealthStatus();
  }, []);

  const tabs = [
    {
      id: 'realtime' as const,
      label: 'Real-time News',
      icon: <Wifi className="w-5 h-5" />,
      description: 'Live breaking news updates'
    },
    {
      id: 'india' as const,
      label: '🇮🇳 India News',
      icon: <span className="w-5 h-5 text-lg">🇮🇳</span>,
      description: 'Latest news from across India'
    },
    {
      id: 'personalized' as const,
      label: 'Personalized Feed',
      icon: <TrendingUp className="w-5 h-5" />,
      description: 'News tailored to your interests'
    },
    {
      id: 'preferences' as const,
      label: 'Preferences',
      icon: <Users className="w-5 h-5" />,
      description: 'Customize your news experience'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Stunning Enhanced Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-700">
        {/* Animated Background Elements */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-blue-600/20 to-purple-600/20" />
          <div className="absolute top-10 left-10 w-32 h-32 bg-white/10 rounded-full blur-xl animate-pulse" />
          <div className="absolute top-20 right-20 w-24 h-24 bg-blue-300/20 rounded-full blur-lg animate-bounce" />
          <div className="absolute bottom-10 left-1/3 w-40 h-40 bg-purple-400/10 rounded-full blur-2xl animate-pulse" />
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="text-center text-white"
          >
            {/* Logo and Title */}
            <motion.div 
              className="flex items-center justify-center mb-6"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, duration: 0.8, ease: "easeOut" }}
            >
              <div className="relative">
                <Newspaper className="w-12 h-12 mr-4 text-blue-200 drop-shadow-lg" />
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full animate-ping" />
              </div>
              <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
                Smart<span className="text-blue-200">Khabar</span>
              </h1>
            </motion.div>
            
            {/* Subtitle */}
            <motion.p 
              className="text-xl md:text-2xl text-blue-100 mb-8 max-w-3xl mx-auto font-light leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.8 }}
            >
              Your intelligent news companion with <span className="font-semibold text-white">real-time updates</span> and <span className="font-semibold text-white">personalized content</span>
            </motion.p>
            
            {/* Feature Pills */}
            <motion.div 
              className="flex flex-wrap justify-center gap-3 mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.8 }}
            >
              {['🚀 Real-time', '🇮🇳 India Focus', '🤖 AI-Powered', '📱 Mobile Ready'].map((feature, index) => (
                <span key={index} className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full text-sm font-medium border border-white/30 hover:bg-white/30 transition-all duration-300">
                  {feature}
                </span>
              ))}
            </motion.div>
            
            {/* System Status */}
            {healthStatus && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.8, duration: 0.6 }}
                className="inline-flex items-center bg-emerald-500/20 text-emerald-100 px-6 py-3 rounded-full text-sm font-medium backdrop-blur-sm border border-emerald-400/30 shadow-lg"
              >
                <div className="w-3 h-3 bg-emerald-400 rounded-full mr-3 animate-pulse shadow-lg" />
                <span className="font-semibold">
                  {healthStatus.status === 'healthy' ? '✨ All Systems Operational' : healthStatus.status}
                </span>
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>

      {/* Stunning Navigation Tabs */}
      <div className="bg-white/80 backdrop-blur-lg shadow-xl border-b border-gray-200/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-2 overflow-x-auto py-4">
            {tabs.map((tab, index) => (
              <motion.button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                className={`relative flex items-center space-x-3 px-6 py-3 rounded-xl font-medium text-sm whitespace-nowrap transition-all duration-300 transform hover:scale-105 ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/25'
                    : 'bg-gray-100/80 text-gray-600 hover:bg-gray-200/80 hover:text-gray-800 hover:shadow-md'
                }`}
              >
                {/* Active Tab Glow Effect */}
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                
                {/* Tab Content */}
                <div className="relative z-10 flex items-center space-x-3">
                  <div className={`p-1 rounded-lg ${activeTab === tab.id ? 'bg-white/20' : 'bg-white/60'}`}>
                    {tab.icon}
                  </div>
                  <span className="font-semibold">{tab.label}</span>
                  
                  {/* Active Indicator */}
                  {activeTab === tab.id && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-2 h-2 bg-white rounded-full shadow-lg"
                    />
                  )}
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      {/* Stunning Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="relative">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200"></div>
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent absolute top-0 left-0"></div>
            </div>
            <motion.span 
              className="mt-6 text-gray-700 font-medium text-lg"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              Loading SmartKhabar...
            </motion.span>
          </div>
        ) : (
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            {/* Enhanced Tab Description */}
            <motion.div 
              className="mb-10 text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              <h2 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-4">
                {tabs.find(tab => tab.id === activeTab)?.label}
              </h2>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
                {tabs.find(tab => tab.id === activeTab)?.description}
              </p>
            </motion.div>

            {/* Stunning Tab Content */}
            {activeTab === 'realtime' && (
              <div className="space-y-8">
                <motion.div 
                  className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/50 rounded-2xl p-6 shadow-lg backdrop-blur-sm"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="p-3 bg-blue-500 rounded-xl shadow-lg">
                        <Bell className="w-6 h-6 text-white" />
                      </div>
                      <div className="ml-4">
                        <span className="text-blue-900 font-bold text-lg">Real-time Updates Active</span>
                        <p className="text-blue-700 text-sm mt-1">
                          Live updates as breaking news happens
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-lg" />
                      <span className="text-green-700 font-semibold text-sm">LIVE</span>
                    </div>
                  </div>
                </motion.div>
                <RealTimeNewsFeed 
                  userId="demo-user" 
                  preferences={{
                    categories: ['top', 'technology', 'business', 'science', 'health', 'sports', 'world', 'politics'],
                    sources: [],
                    autoRefresh: true,
                    notifications: true
                  }}
                  className=""
                />
              </div>
            )}

            {activeTab === 'personalized' && (
              <div className="space-y-8">
                <motion.div 
                  className="bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200/50 rounded-2xl p-6 shadow-lg backdrop-blur-sm"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="p-3 bg-emerald-500 rounded-xl shadow-lg">
                        <TrendingUp className="w-6 h-6 text-white" />
                      </div>
                      <div className="ml-4">
                        <span className="text-emerald-900 font-bold text-lg">AI-Powered Personalization</span>
                        <p className="text-emerald-700 text-sm mt-1">
                          Curated based on your reading preferences and interests
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse shadow-lg" />
                      <span className="text-purple-700 font-semibold text-sm">AI</span>
                    </div>
                  </div>
                </motion.div>
                <PersonalizedNewsFeed 
                  userId="demo-user" 
                  userPreferences={userPreferences}
                  preferencesUpdated={preferencesUpdated}
                  onPreferencesChange={() => setPreferencesUpdated(prev => prev + 1)}
                />
              </div>
            )}

            {activeTab === 'india' && (
              <div className="space-y-8">
                <motion.div 
                  className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200/50 rounded-2xl p-6 shadow-lg backdrop-blur-sm"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="p-3 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl shadow-lg">
                        <span className="text-2xl">🇮🇳</span>
                      </div>
                      <div className="ml-4">
                        <span className="text-orange-900 font-bold text-lg">India News Hub</span>
                        <p className="text-orange-700 text-sm mt-1">
                          Comprehensive coverage from across India with regional filtering
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-orange-500 rounded-full animate-pulse shadow-lg" />
                      <span className="text-orange-700 font-semibold text-sm">INDIA</span>
                    </div>
                  </div>
                </motion.div>
                <IndiaNewsFeed 
                  onArticleClick={(article) => {
                    window.open(article.url, '_blank');
                  }}
                />
              </div>
            )}

            {activeTab === 'preferences' && (
              <div className="space-y-8">
                <motion.div 
                  className="bg-gradient-to-r from-purple-50 to-violet-50 border border-purple-200/50 rounded-2xl p-6 shadow-lg backdrop-blur-sm"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="p-3 bg-purple-500 rounded-xl shadow-lg">
                        <Users className="w-6 h-6 text-white" />
                      </div>
                      <div className="ml-4">
                        <span className="text-purple-900 font-bold text-lg">Customize Your Experience</span>
                        <p className="text-purple-700 text-sm mt-1">
                          Set preferences to get the most relevant news for you
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-indigo-500 rounded-full animate-pulse shadow-lg" />
                      <span className="text-indigo-700 font-semibold text-sm">CUSTOM</span>
                    </div>
                  </div>
                </motion.div>
                <EnhancedUserPreferences 
                  userId="demo-user" 
                  onPreferencesUpdate={handlePreferencesUpdate}
                />
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Stunning Features Section */}
      <div className="relative bg-gradient-to-br from-gray-50 to-blue-50 py-20 mt-16 overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-blue-50/50 to-purple-50/50" />
          <div className="absolute top-20 left-20 w-64 h-64 bg-blue-200/20 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-80 h-80 bg-purple-200/20 rounded-full blur-3xl" />
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.8 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 bg-clip-text text-transparent mb-6">
              Next-Gen News Experience
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Experience the future of intelligent news aggregation with cutting-edge features
            </p>
          </motion.div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: <Bell className="w-10 h-10" />,
                title: "Real-time Alerts",
                description: "Instant notifications for breaking news and trending stories",
                color: "from-blue-500 to-cyan-500",
                bgColor: "from-blue-50 to-cyan-50"
              },
              {
                icon: <TrendingUp className="w-10 h-10" />,
                title: "Smart Personalization",
                description: "AI-powered content curation based on your reading behavior",
                color: "from-emerald-500 to-green-500",
                bgColor: "from-emerald-50 to-green-50"
              },
              {
                icon: <Clock className="w-10 h-10" />,
                title: "Live Updates",
                description: "WebSocket-powered real-time news feed with instant updates",
                color: "from-purple-500 to-violet-500",
                bgColor: "from-purple-50 to-violet-50"
              },
              {
                icon: <Users className="w-10 h-10" />,
                title: "Enhanced Analytics",
                description: "Comprehensive insights into news trends and user engagement",
                color: "from-orange-500 to-red-500",
                bgColor: "from-orange-50 to-red-50"
              }
            ].map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.1 * index + 0.8, duration: 0.6, ease: "easeOut" }}
                whileHover={{ y: -10, scale: 1.05 }}
                className={`relative group text-center p-8 rounded-2xl bg-gradient-to-br ${feature.bgColor} border border-white/50 shadow-lg hover:shadow-2xl transition-all duration-500 backdrop-blur-sm`}
              >
                {/* Hover Glow Effect */}
                <div className={`absolute inset-0 rounded-2xl bg-gradient-to-r ${feature.color} opacity-0 group-hover:opacity-10 transition-opacity duration-500`} />
                
                {/* Icon */}
                <div className={`inline-flex p-4 rounded-2xl bg-gradient-to-r ${feature.color} text-white shadow-lg mb-6 group-hover:scale-110 transition-transform duration-300`}>
                  {feature.icon}
                </div>
                
                {/* Content */}
                <h3 className="text-xl font-bold text-gray-900 mb-4 group-hover:text-gray-800 transition-colors">
                  {feature.title}
                </h3>
                <p className="text-gray-600 leading-relaxed group-hover:text-gray-700 transition-colors">
                  {feature.description}
                </p>
                
                {/* Decorative Element */}
                <div className={`absolute top-4 right-4 w-2 h-2 rounded-full bg-gradient-to-r ${feature.color} opacity-60 group-hover:opacity-100 transition-opacity`} />
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
