import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import NewsFeed from '../NewsFeed';
import { PersonalizedFeedResponse } from '@/types';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

const mockSuccessResponse: PersonalizedFeedResponse = {
  success: true,
  data: {
    summaries: [
      {
        id: 'summary-1',
        content: 'Test summary content about technology.',
        keyPoints: ['AI advancement', 'Cloud computing'],
        sourceArticles: ['article-1'],
        estimatedReadingTime: 3,
        tone: 'casual',
      },
    ],
    lastUpdated: new Date('2024-01-15T10:00:00Z'),
    userPreferences: {
      userId: 'test-user',
      topics: ['technology'],
      tone: 'casual',
      readingTime: 5,
      preferredSources: [],
      excludedSources: [],
      lastUpdated: new Date('2024-01-15T09:00:00Z'),
    },
  },
};

describe('NewsFeed Component - Basic Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading state initially', () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves
    
    render(<NewsFeed userId="test-user" />);
    
    // Check for loading elements
    const loadingElements = document.querySelectorAll('.animate-pulse');
    expect(loadingElements.length).toBeGreaterThan(0);
  });

  it('should render news summaries when data loads successfully', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSuccessResponse),
    });

    render(<NewsFeed userId="test-user" />);
    
    await waitFor(() => {
      expect(screen.getByText('Your Personalized News')).toBeInTheDocument();
    }, { timeout: 10000 });

    await waitFor(() => {
      expect(screen.getByText('Test summary content about technology.')).toBeInTheDocument();
    }, { timeout: 10000 });
  });

  it('should handle error state', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch news',
        },
      }),
    });

    render(<NewsFeed userId="test-user" />);
    
    await waitFor(() => {
      expect(screen.getByText('Unable to load news feed')).toBeInTheDocument();
    }, { timeout: 10000 });
  });

  it('should handle empty state', async () => {
    const emptyResponse: PersonalizedFeedResponse = {
      success: true,
      data: {
        summaries: [],
        lastUpdated: new Date('2024-01-15T10:00:00Z'),
        userPreferences: {
          userId: 'test-user',
          topics: [],
          tone: 'casual',
          readingTime: 5,
          preferredSources: [],
          excludedSources: [],
          lastUpdated: new Date('2024-01-15T09:00:00Z'),
        },
      },
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(emptyResponse),
    });

    render(<NewsFeed userId="test-user" />);
    
    await waitFor(() => {
      expect(screen.getByText('No news available')).toBeInTheDocument();
    }, { timeout: 10000 });
  });

  it('should apply custom className', () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));
    
    const { container } = render(<NewsFeed userId="test-user" className="custom-class" />);
    
    expect(container.firstChild).toHaveClass('custom-class');
  });
});