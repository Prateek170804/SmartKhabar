'use client';

import React, { useState, useEffect } from 'react';
import type { UserPreferences, PreferencesResponse } from '@/types';

interface UserPreferencesProps {
  userId?: string;
  className?: string;
  onPreferencesUpdate?: (preferences: UserPreferences) => void;
}

interface UserPreferencesState {
  preferences: UserPreferences | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  hasChanges: boolean;
}

const AVAILABLE_TOPICS = [
  'top',          // General/Top news
  'technology',
  'business',
  'science',
  'health',
  'sports',
  'entertainment',
  'politics',
  'world',
  'environment',
  'food',         // Supported by NewsData.io
  'education',    // Custom category
  'lifestyle',    // Custom category
  'travel',       // Custom category
  'automotive'    // Custom category
];

const AVAILABLE_SOURCES = [
  { id: 'cnn', name: 'CNN' },
  { id: 'bbc', name: 'BBC' },
  { id: 'techcrunch', name: 'TechCrunch' },
  { id: 'hackernews', name: 'Hacker News' },
];

const TONE_OPTIONS = [
  { value: 'formal', label: 'Formal', description: 'Professional and structured' },
  { value: 'casual', label: 'Casual', description: 'Conversational and friendly' },
  { value: 'fun', label: 'Fun', description: 'Engaging and entertaining' },
] as const;

export default function UserPreferences({ 
  userId = 'default-user', 
  className = '',
  onPreferencesUpdate 
}: UserPreferencesProps) {
  const [state, setState] = useState<UserPreferencesState>({
    preferences: null,
    loading: true,
    saving: false,
    error: null,
    hasChanges: false,
  });

  const [formData, setFormData] = useState<Partial<UserPreferences>>({});

  const fetchPreferences = async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const response = await fetch(`/api/preferences/simple?userId=${encodeURIComponent(userId)}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.success === false ? data.error?.message || data.error : 'Failed to fetch preferences');
      }
      
      if (data.success && data.preferences) {
        // Convert simple API format to component format
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
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      }));
    }
  };

  const savePreferences = async () => {
    if (!formData || !state.hasChanges) return;

    try {
      setState(prev => ({ ...prev, saving: true, error: null }));
      
      // Convert component format to simple API format
      const apiPreferences = {
        categories: formData.topics || [],
        sources: formData.preferredSources || [],
        tone: formData.tone || 'casual',
        readingTime: formData.readingTime && formData.readingTime <= 3 ? 'short' :
                    formData.readingTime && formData.readingTime >= 10 ? 'long' : 'medium',
        keywords: [], // Default empty for now
        language: 'en'
      };
      
      const response = await fetch('/api/preferences/simple', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          preferences: apiPreferences,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.success === false ? data.error?.message || data.error : 'Failed to save preferences');
      }
      
      if (data.success && data.preferences) {
        // Convert back to component format
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

  const handleTopicToggle = (topic: string) => {
    const currentTopics = formData.topics || [];
    const newTopics = currentTopics.includes(topic)
      ? currentTopics.filter(t => t !== topic)
      : [...currentTopics, topic];
    
    setFormData(prev => ({ ...prev, topics: newTopics }));
    setState(prev => ({ ...prev, hasChanges: true }));
  };

  const handleSourceToggle = (sourceId: string, type: 'preferred' | 'excluded') => {
    const currentPreferred = formData.preferredSources || [];
    const currentExcluded = formData.excludedSources || [];
    
    let newPreferred = [...currentPreferred];
    let newExcluded = [...currentExcluded];
    
    if (type === 'preferred') {
      if (currentPreferred.includes(sourceId)) {
        newPreferred = currentPreferred.filter(s => s !== sourceId);
      } else {
        newPreferred = [...currentPreferred, sourceId];
        newExcluded = currentExcluded.filter(s => s !== sourceId);
      }
    } else {
      if (currentExcluded.includes(sourceId)) {
        newExcluded = currentExcluded.filter(s => s !== sourceId);
      } else {
        newExcluded = [...currentExcluded, sourceId];
        newPreferred = currentPreferred.filter(s => s !== sourceId);
      }
    }
    
    setFormData(prev => ({ 
      ...prev, 
      preferredSources: newPreferred,
      excludedSources: newExcluded 
    }));
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

  const resetChanges = () => {
    if (state.preferences) {
      setFormData(state.preferences);
      setState(prev => ({ ...prev, hasChanges: false }));
    }
  };

  useEffect(() => {
    fetchPreferences();
  }, [userId]);

  if (state.loading) {
    return (
      <div className={`w-full max-w-2xl mx-auto p-6 ${className}`}>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded mb-6 w-1/3"></div>
          <div className="space-y-6">
            <div>
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-3 w-1/4"></div>
              <div className="grid grid-cols-2 gap-2">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
                ))}
              </div>
            </div>
            <div>
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-3 w-1/4"></div>
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className={`w-full max-w-2xl mx-auto p-6 ${className}`}>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
          <div className="text-red-600 dark:text-red-400 mb-4">
            <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <h3 className="text-lg font-semibold mb-2">Unable to load preferences</h3>
            <p className="text-sm text-red-500 dark:text-red-300 mb-4">{state.error}</p>
          </div>
          <button
            onClick={fetchPreferences}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md transition-colors duration-200"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full max-w-2xl mx-auto p-6 ${className}`}>
      <div data-testid="preferences-form" className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            News Preferences
          </h2>
          {state.hasChanges && (
            <div className="flex gap-2">
              <button
                onClick={resetChanges}
                className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              >
                Reset
              </button>
              <button
                data-testid="save-preferences-header"
                onClick={savePreferences}
                disabled={state.saving}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-md transition-colors duration-200 text-sm font-medium"
              >
                {state.saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>

        <div className="space-y-8">
          {/* Topics Section */}
          <div data-testid="topic-selector">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              Interested Topics
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Select topics you'd like to see in your personalized feed
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {AVAILABLE_TOPICS.map((topic) => (
                <button
                  key={topic}
                  data-testid={`topic-${topic}`}
                  onClick={() => handleTopicToggle(topic)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                    formData.topics?.includes(topic)
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {topic.charAt(0).toUpperCase() + topic.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Tone Section */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              Preferred Tone
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Choose how you'd like your news summaries to be written
            </p>
            <div className="space-y-2" data-testid="tone-selector">
              {TONE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="flex items-center p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <input
                    type="radio"
                    name="tone"
                    value={option.value}
                    checked={formData.tone === option.value}
                    onChange={() => handleToneChange(option.value)}
                    className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <div className="ml-3">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {option.label}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {option.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Reading Time Section */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              Reading Time
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              How long should your summaries be? ({formData.readingTime || 5} minutes)
            </p>
            <div className="px-3">
              <input
                data-testid="reading-time-slider"
                type="range"
                min="1"
                max="15"
                value={formData.readingTime || 5}
                onChange={(e) => handleReadingTimeChange(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
              />
              <input
                data-testid="reading-time-input"
                type="hidden"
                value={formData.readingTime || 5}
                readOnly
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span>1 min</span>
                <span>15 min</span>
              </div>
            </div>
          </div>

          {/* Sources Section */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              News Sources
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Customize which sources you prefer or want to exclude
            </p>
            <div className="space-y-3">
              {AVAILABLE_SOURCES.map((source) => (
                <div
                  key={source.id}
                  className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {source.name}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSourceToggle(source.id, 'preferred')}
                      className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                        formData.preferredSources?.includes(source.id)
                          ? 'bg-green-600 text-white hover:bg-green-700'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      Prefer
                    </button>
                    <button
                      onClick={() => handleSourceToggle(source.id, 'excluded')}
                      className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                        formData.excludedSources?.includes(source.id)
                          ? 'bg-red-600 text-white hover:bg-red-700'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      Exclude
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Save Button at Bottom */}
        {state.hasChanges && (
          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <div className="flex justify-end gap-3">
              <button
                onClick={resetChanges}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                data-testid="save-preferences"
                onClick={savePreferences}
                disabled={state.saving}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-2 rounded-md transition-colors duration-200 font-medium"
              >
                {state.saving ? 'Saving...' : 'Save Preferences'}
              </button>
            </div>
          </div>
        )}
        
        {/* Success Message */}
        {!state.hasChanges && !state.loading && !state.error && (
          <div data-testid="preferences-saved" className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
            <p className="text-sm text-green-600 dark:text-green-400">
              Preferences saved successfully!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}