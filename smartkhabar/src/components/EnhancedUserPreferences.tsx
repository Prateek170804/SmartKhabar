'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { UserPreferences } from '@/types';

interface EnhancedUserPreferencesProps {
  userId?: string;
  className?: string;
  onPreferencesUpdate?: (preferences: UserPreferences) => void;
}

interface PreferencesState {
  preferences: UserPreferences | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  hasChanges: boolean;
  activeSection: 'topics' | 'sources' | 'tone' | 'reading';
}

const TOPIC_CATEGORIES = [
  {
    category: 'News & Current Affairs',
    topics: [
      { id: 'top', name: 'Top Stories', icon: '🔥', color: 'from-red-500 to-orange-500' },
      { id: 'politics', name: 'Politics', icon: '🏛️', color: 'from-blue-500 to-indigo-500' },
      { id: 'world', name: 'World News', icon: '🌍', color: 'from-green-500 to-emerald-500' },
      { id: 'business', name: 'Business', icon: '💼', color: 'from-purple-500 to-violet-500' }
    ]
  },
  {
    category: 'Technology & Science',
    topics: [
      { id: 'technology', name: 'Technology', icon: '💻', color: 'from-cyan-500 to-blue-500' },
      { id: 'science', name: 'Science', icon: '🔬', color: 'from-teal-500 to-cyan-500' },
      { id: 'environment', name: 'Environment', icon: '🌱', color: 'from-green-500 to-teal-500' }
    ]
  },
  {
    category: 'Lifestyle & Entertainment',
    topics: [
      { id: 'sports', name: 'Sports', icon: '⚽', color: 'from-orange-500 to-red-500' },
      { id: 'entertainment', name: 'Entertainment', icon: '🎬', color: 'from-pink-500 to-rose-500' },
      { id: 'health', name: 'Health', icon: '🏥', color: 'from-emerald-500 to-green-500' },
      { id: 'lifestyle', name: 'Lifestyle', icon: '✨', color: 'from-purple-500 to-pink-500' }
    ]
  }
];

const TONE_OPTIONS = [
  { 
    value: 'formal', 
    name: 'Professional', 
    description: 'Structured, detailed, and authoritative',
    icon: '👔',
    color: 'from-slate-500 to-gray-600'
  },
  { 
    value: 'casual', 
    name: 'Conversational', 
    description: 'Friendly, approachable, and easy to read',
    icon: '💬',
    color: 'from-blue-500 to-cyan-500'
  },
  { 
    value: 'fun', 
    name: 'Engaging', 
    description: 'Entertaining, dynamic, and lively',
    icon: '🎉',
    color: 'from-purple-500 to-pink-500'
  }
] as const;

const READING_TIME_OPTIONS = [
  { value: 2, label: 'Quick Read', description: '1-2 minutes', icon: '⚡' },
  { value: 5, label: 'Standard', description: '3-5 minutes', icon: '📖' },
  { value: 10, label: 'In-depth', description: '8-10 minutes', icon: '📚' }
];

export default function EnhancedUserPreferences({ 
  userId = 'demo-user', 
  className = '',
  onPreferencesUpdate 
}: EnhancedUserPreferencesProps) {
  const [state, setState] = useState<PreferencesState>({
    preferences: null,
    loading: true,
    saving: false,
    error: null,
    hasChanges: false,
    activeSection: 'topics'
  });

  const [formData, setFormData] = useState<Partial<UserPreferences>>({
    topics: [],
    preferredSources: [],
    excludedSources: [],
    tone: 'casual',
    readingTime: 5
  });

  const fetchPreferences = async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const response = await fetch(`/api/preferences/simple?userId=${encodeURIComponent(userId)}`);
      const data = await response.json();
      
      if (data.success && data.preferences) {
        const preferences = {
          userId: 'demo-user',
          topics: data.preferences.categories || [],
          preferredSources: data.preferences.sources || [],
          excludedSources: [],
          tone: data.preferences.tone || 'casual',
          readingTime: data.preferences.readingTime === 'short' ? 3 : 
                      data.preferences.readingTime === 'long' ? 10 : 5,
          lastUpdated: new Date(),
        };
        
        setState(prev => ({
          ...prev,
          preferences,
          loading: false,
          error: null,
        }));
        setFormData(preferences);
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load preferences',
      }));
    }
  };

  const savePreferences = async () => {
    try {
      setState(prev => ({ ...prev, saving: true, error: null }));

      const response = await fetch('/api/preferences/simple', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          categories: formData.topics || [],
          sources: formData.preferredSources || [],
          tone: formData.tone || 'casual',
          readingTime: formData.readingTime === 3 ? 'short' : 
                      formData.readingTime === 10 ? 'long' : 'medium',
        }),
      });

      const data = await response.json();
      
      if (data.success && data.preferences) {
        const preferences = {
          userId: 'demo-user',
          topics: data.preferences.categories || [],
          preferredSources: data.preferences.sources || [],
          excludedSources: [],
          tone: data.preferences.tone || 'casual',
          readingTime: data.preferences.readingTime === 'short' ? 3 : 
                      data.preferences.readingTime === 'long' ? 10 : 5,
          lastUpdated: new Date(),
        };
        
        setState(prev => ({
          ...prev,
          preferences,
          saving: false,
          hasChanges: false,
          error: null,
        }));
        setFormData(preferences);
        onPreferencesUpdate?.(preferences);
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        saving: false,
        error: error instanceof Error ? error.message : 'Failed to save preferences',
      }));
    }
  };

  useEffect(() => {
    fetchPreferences();
  }, [userId]);

  const handleTopicToggle = (topicId: string) => {
    const currentTopics = formData.topics || [];
    const newTopics = currentTopics.includes(topicId)
      ? currentTopics.filter(t => t !== topicId)
      : [...currentTopics, topicId];
    
    setFormData(prev => ({ ...prev, topics: newTopics }));
    setState(prev => ({ ...prev, hasChanges: true }));
  };

  const handleToneChange = (tone: 'formal' | 'casual' | 'fun') => {
    setFormData(prev => ({ ...prev, tone }));
    setState(prev => ({ ...prev, hasChanges: true }));
  };

  const handleReadingTimeChange = (readingTime: number) => {
    setFormData(prev => ({ ...prev, readingTime }));
    setState(prev => ({ ...prev, hasChanges: true }));
  };

  const sections = [
    { id: 'topics', name: 'Topics', icon: '📰', description: 'Choose your interests' },
    { id: 'tone', name: 'Tone', icon: '🎭', description: 'Set content style' },
    { id: 'reading', name: 'Reading', icon: '⏱️', description: 'Adjust reading time' }
  ] as const;

  if (state.loading) {
    return (
      <div className={`max-w-4xl mx-auto p-6 ${className}`}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-xl p-8"
        >
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading Your Preferences</h3>
            <p className="text-gray-600">Setting up your personalized experience...</p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`max-w-6xl mx-auto p-6 ${className}`}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h2 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-4">
          Customize Your News Experience
        </h2>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Tailor SmartKhabar to match your interests and reading preferences
        </p>
      </motion.div>

      <div className="grid lg:grid-cols-4 gap-8">
        {/* Navigation Sidebar */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-1"
        >
          <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Settings</h3>
            <nav className="space-y-2">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setState(prev => ({ ...prev, activeSection: section.id }))}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200 ${
                    state.activeSection === section.id
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <span className="text-lg">{section.icon}</span>
                  <div>
                    <div className="font-medium">{section.name}</div>
                    <div className={`text-xs ${state.activeSection === section.id ? 'text-indigo-100' : 'text-gray-500'}`}>
                      {section.description}
                    </div>
                  </div>
                </button>
              ))}
            </nav>

            {/* Save Button */}
            {state.hasChanges && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={savePreferences}
                disabled={state.saving}
                className="w-full mt-6 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-3 rounded-xl font-medium hover:from-green-600 hover:to-emerald-700 transition-all duration-200 shadow-lg disabled:opacity-50"
              >
                {state.saving ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Saving...
                  </div>
                ) : (
                  '💾 Save Changes'
                )}
              </motion.button>
            )}
          </div>
        </motion.div>

        {/* Content Area */}
        <div className="lg:col-span-3">
          <AnimatePresence mode="wait">
            {/* Topics Section */}
            {state.activeSection === 'topics' && (
              <motion.div
                key="topics"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-white rounded-2xl shadow-lg p-8"
              >
                <div className="mb-8">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Choose Your Interests</h3>
                  <p className="text-gray-600">Select topics you'd like to see in your personalized feed</p>
                </div>

                <div className="space-y-8">
                  {TOPIC_CATEGORIES.map((category, categoryIndex) => (
                    <motion.div
                      key={category.category}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: categoryIndex * 0.1 }}
                    >
                      <h4 className="text-lg font-semibold text-gray-800 mb-4">{category.category}</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {category.topics.map((topic, topicIndex) => {
                          const isSelected = formData.topics?.includes(topic.id) || false;
                          return (
                            <motion.button
                              key={topic.id}
                              onClick={() => handleTopicToggle(topic.id)}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: (categoryIndex * 0.1) + (topicIndex * 0.05) }}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              className={`relative p-4 rounded-xl border-2 transition-all duration-300 ${
                                isSelected
                                  ? `bg-gradient-to-r ${topic.color} text-white border-transparent shadow-lg`
                                  : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-100'
                              }`}
                            >
                              <div className="text-2xl mb-2">{topic.icon}</div>
                              <div className="font-medium text-sm">{topic.name}</div>
                              
                              {isSelected && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className="absolute -top-2 -right-2 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-lg"
                                >
                                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                </motion.div>
                              )}
                            </motion.button>
                          );
                        })}
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Selected Topics Summary */}
                {formData.topics && formData.topics.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-8 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200"
                  >
                    <h5 className="font-semibold text-blue-900 mb-2">Selected Topics ({formData.topics.length})</h5>
                    <div className="flex flex-wrap gap-2">
                      {formData.topics.map(topicId => {
                        const topic = TOPIC_CATEGORIES.flatMap(cat => cat.topics).find(t => t.id === topicId);
                        return topic ? (
                          <span key={topicId} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                            <span>{topic.icon}</span>
                            {topic.name}
                          </span>
                        ) : null;
                      })}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* Tone Section */}
            {state.activeSection === 'tone' && (
              <motion.div
                key="tone"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-white rounded-2xl shadow-lg p-8"
              >
                <div className="mb-8">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Content Tone</h3>
                  <p className="text-gray-600">Choose how you'd like your news to be presented</p>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                  {TONE_OPTIONS.map((option, index) => {
                    const isSelected = formData.tone === option.value;
                    return (
                      <motion.button
                        key={option.value}
                        onClick={() => handleToneChange(option.value)}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={`relative p-6 rounded-2xl border-2 transition-all duration-300 text-left ${
                          isSelected
                            ? `bg-gradient-to-r ${option.color} text-white border-transparent shadow-xl`
                            : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-100'
                        }`}
                      >
                        <div className="text-3xl mb-3">{option.icon}</div>
                        <h4 className="text-lg font-bold mb-2">{option.name}</h4>
                        <p className={`text-sm ${isSelected ? 'text-white/90' : 'text-gray-600'}`}>
                          {option.description}
                        </p>
                        
                        {isSelected && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg"
                          >
                            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </motion.div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* Reading Time Section */}
            {state.activeSection === 'reading' && (
              <motion.div
                key="reading"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-white rounded-2xl shadow-lg p-8"
              >
                <div className="mb-8">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Reading Preferences</h3>
                  <p className="text-gray-600">Set your preferred article length and reading time</p>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                  {READING_TIME_OPTIONS.map((option, index) => {
                    const isSelected = formData.readingTime === option.value;
                    return (
                      <motion.button
                        key={option.value}
                        onClick={() => handleReadingTimeChange(option.value)}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={`relative p-6 rounded-2xl border-2 transition-all duration-300 text-center ${
                          isSelected
                            ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white border-transparent shadow-xl'
                            : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-100'
                        }`}
                      >
                        <div className="text-3xl mb-3">{option.icon}</div>
                        <h4 className="text-lg font-bold mb-2">{option.label}</h4>
                        <p className={`text-sm ${isSelected ? 'text-white/90' : 'text-gray-600'}`}>
                          {option.description}
                        </p>
                        
                        {isSelected && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg"
                          >
                            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </motion.div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>

                {/* Reading Time Visualization */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="mt-8 p-6 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200"
                >
                  <h5 className="font-semibold text-purple-900 mb-4">Your Reading Experience</h5>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h6 className="font-medium text-purple-800 mb-2">Article Length</h6>
                      <p className="text-purple-700 text-sm">
                        {formData.readingTime === 2 && "Short, concise summaries with key points"}
                        {formData.readingTime === 5 && "Balanced articles with context and details"}
                        {formData.readingTime === 10 && "Comprehensive coverage with full analysis"}
                      </p>
                    </div>
                    <div>
                      <h6 className="font-medium text-purple-800 mb-2">Perfect For</h6>
                      <p className="text-purple-700 text-sm">
                        {formData.readingTime === 2 && "Quick updates during busy schedules"}
                        {formData.readingTime === 5 && "Daily news consumption and staying informed"}
                        {formData.readingTime === 10 && "Deep dives and thorough understanding"}
                      </p>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Error Message */}
      {state.error && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-6 right-6 bg-red-500 text-white px-6 py-4 rounded-xl shadow-lg max-w-sm"
        >
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div>
              <h6 className="font-medium">Error</h6>
              <p className="text-sm text-red-100">{state.error}</p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}