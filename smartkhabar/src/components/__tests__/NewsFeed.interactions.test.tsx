import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import NewsFeed from '../NewsFeed';
import { PersonalizedFeedResponse, InteractionResponse } from '@/types';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

// Mock window.open
const mockWindowOpen = vi.fn();
global.open = mockWindowOpen;

// Mock navigator.share and navigator.clipboard
Object.defineProperty(navigator, 'share', {
  value: vi.fn(),
  writable: true,
});

Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn(),
  },
  writable: true,
});

const mockSuccessResponse: PersonalizedFeedResponse = {
  success: true,
  data: {
    summaries: [
      {
        id: 'summary-1',
        content: 'Test summary content about technology trends.',
        keyPoints: ['AI advancement', 'Cloud computing'],
        sourceArticles: ['article-1', 'article-2'],
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

const mockInteractionResponse: InteractionResponse = {
  success: true,
  data: {
    success: true,
    updatedPreferences: {
      topics: ['technology', 'business'],
    },
  },
};

describe('NewsFeed Component - Interaction Features', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock successful feed fetch
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSuccessResponse),
    });
  });

  it('should render interaction buttons for each article', async () => {
    render(<NewsFeed userId="test-user" />);
    
    await waitFor(() => {
      expect(screen.getByText('Test summary content about technology trends.')).toBeInTheDocument();
    }, { timeout: 10000 });

    // Check for interaction buttons
    expect(screen.getByRole('button', { name: /read more/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /like/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /share/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /hide source/i })).toBeInTheDocument();
  });

  it('should handle read more interaction', async () => {
    render(<NewsFeed userId="test-user" />);
    
    await waitFor(() => {
      expect(screen.getByText('Test summary content about technology trends.')).toBeInTheDocument();
    });

    // Mock interaction API call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockInteractionResponse),
    });

    const readMoreButton = screen.getByRole('button', { name: /read more/i });
    fireEvent.click(readMoreButton);

    // Should open new window
    expect(mockWindowOpen).toHaveBeenCalledWith('https://example.com/article/article-1', '_blank');

    // Should track interaction
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/interactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: 'test-user',
          articleId: 'summary-1',
          action: 'read_more',
        }),
      });
    });
  });

  it('should handle like interaction', async () => {
    render(<NewsFeed userId="test-user" />);
    
    await waitFor(() => {
      expect(screen.getByText('Test summary content about technology trends.')).toBeInTheDocument();
    });

    // Mock interaction API call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockInteractionResponse),
    });

    const likeButton = screen.getByRole('button', { name: /like/i });
    fireEvent.click(likeButton);

    // Should track interaction
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/interactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: 'test-user',
          articleId: 'summary-1',
          action: 'like',
        }),
      });
    });

    // Button text should change to "Liked"
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /liked/i })).toBeInTheDocument();
    });
  });

  it('should handle share interaction with native share API', async () => {
    const mockShare = vi.fn().mockResolvedValue(undefined);
    navigator.share = mockShare;

    render(<NewsFeed userId="test-user" />);
    
    await waitFor(() => {
      expect(screen.getByText('Test summary content about technology trends.')).toBeInTheDocument();
    });

    // Mock interaction API call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockInteractionResponse),
    });

    const shareButton = screen.getByRole('button', { name: /share/i });
    fireEvent.click(shareButton);

    // Should use native share API
    expect(mockShare).toHaveBeenCalledWith({
      title: 'SmartKhabar News Summary',
      text: 'Test summary content about technology trends....',
      url: window.location.href,
    });

    // Should track interaction
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/interactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: 'test-user',
          articleId: 'summary-1',
          action: 'share',
        }),
      });
    });
  });

  it('should handle share interaction with clipboard fallback', async () => {
    // Mock navigator without share API
    Object.defineProperty(navigator, 'share', {
      value: undefined,
      writable: true,
    });
    
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    navigator.clipboard.writeText = mockWriteText;
    
    // Mock alert
    const mockAlert = vi.fn();
    global.alert = mockAlert;

    render(<NewsFeed userId="test-user" />);
    
    await waitFor(() => {
      expect(screen.getByText('Test summary content about technology trends.')).toBeInTheDocument();
    });

    // Mock interaction API call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockInteractionResponse),
    });

    const shareButton = screen.getByRole('button', { name: /share/i });
    fireEvent.click(shareButton);

    // Should use clipboard fallback
    expect(mockWriteText).toHaveBeenCalledWith('Test summary content about technology trends.');
    expect(mockAlert).toHaveBeenCalledWith('Summary copied to clipboard!');
  });

  it('should handle hide source interaction', async () => {
    render(<NewsFeed userId="test-user" />);
    
    await waitFor(() => {
      expect(screen.getByText('Test summary content about technology trends.')).toBeInTheDocument();
    });

    // Mock interaction API call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockInteractionResponse),
    });

    const hideSourceButton = screen.getByRole('button', { name: /hide source/i });
    fireEvent.click(hideSourceButton);

    // Should track interaction
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/interactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: 'test-user',
          articleId: 'summary-1',
          action: 'hide',
        }),
      });
    });
  });

  it('should disable buttons during interaction loading', async () => {
    render(<NewsFeed userId="test-user" />);
    
    await waitFor(() => {
      expect(screen.getByText('Test summary content about technology trends.')).toBeInTheDocument();
    });

    // Mock slow interaction API call
    mockFetch.mockImplementation(() => new Promise(() => {}));

    const likeButton = screen.getByRole('button', { name: /like/i });
    fireEvent.click(likeButton);

    // Button should be disabled during loading
    expect(likeButton).toBeDisabled();
  });

  it('should call onPreferencesChange when preferences are updated', async () => {
    const mockOnPreferencesChange = vi.fn();
    
    render(<NewsFeed userId="test-user" onPreferencesChange={mockOnPreferencesChange} />);
    
    await waitFor(() => {
      expect(screen.getByText('Test summary content about technology trends.')).toBeInTheDocument();
    });

    // Mock interaction API call with updated preferences
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockInteractionResponse),
    });

    const likeButton = screen.getByRole('button', { name: /like/i });
    fireEvent.click(likeButton);

    await waitFor(() => {
      expect(mockOnPreferencesChange).toHaveBeenCalled();
    });
  });

  it('should handle interaction API errors gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    render(<NewsFeed userId="test-user" />);
    
    await waitFor(() => {
      expect(screen.getByText('Test summary content about technology trends.')).toBeInTheDocument();
    });

    // Mock failed interaction API call
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({
        success: false,
        error: {
          code: 'INTERACTION_ERROR',
          message: 'Failed to track interaction',
        },
      }),
    });

    const likeButton = screen.getByRole('button', { name: /like/i });
    fireEvent.click(likeButton);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to track interaction:', expect.any(Error));
    });

    consoleSpy.mockRestore();
  });
});