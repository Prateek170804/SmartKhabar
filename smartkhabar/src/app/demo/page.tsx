'use client';

import React, { useState } from 'react';
import { NewsFeed, UserPreferences } from '@/components';

export default function DemoPage() {
  const [activeTab, setActiveTab] = useState<'feed' | 'preferences'>('feed');
  const [refreshKey, setRefreshKey] = useState(0);

  const handlePreferencesUpdate = () => {
    // Trigger a refresh of the news feed when preferences are updated
    setRefreshKey(prev => prev + 1);
    setActiveTab('feed');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                SmartKhabar
              </h1>
              <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                Your AI News Companion
              </span>
            </div>
            
            {/* Tab Navigation */}
            <nav className="flex space-x-4">
              <button
                data-testid="back-to-feed"
                onClick={() => setActiveTab('feed')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                  activeTab === 'feed'
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                News Feed
              </button>
              <button
                data-testid="preferences-button"
                onClick={() => setActiveTab('preferences')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                  activeTab === 'preferences'
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Preferences
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="py-8">
        {activeTab === 'feed' && (
          <div>
            {/* Demo Info Banner */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                      🚀 SmartKhabar Demo - AI-Powered News Aggregation
                    </h3>
                    <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                      <p>✅ <strong>GNews API:</strong> Collecting real-time news from multiple sources</p>
                      <p>✅ <strong>Hugging Face AI:</strong> Generating personalized summaries with tone adaptation</p>
                      <p>✅ <strong>Neon Database:</strong> Storing {7}+ articles across technology, business, science, and general categories</p>
                      <p>✅ <strong>Smart Personalization:</strong> Content filtered by your preferences and reading time</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <NewsFeed 
              key={refreshKey}
              userId="demo-user" 
              onPreferencesChange={() => setRefreshKey(prev => prev + 1)}
            />
          </div>
        )}
        
        {activeTab === 'preferences' && (
          <UserPreferences 
            userId="demo-user"
            onPreferencesUpdate={handlePreferencesUpdate}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-sm text-gray-500 dark:text-gray-400">
            <p>SmartKhabar - Personalized AI News Companion</p>
            <p className="mt-1">Built with Next.js, React, and Tailwind CSS</p>
          </div>
        </div>
      </footer>
    </div>
  );
}