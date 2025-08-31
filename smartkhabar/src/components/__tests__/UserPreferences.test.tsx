import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import UserPreferences from '../UserPreferences';
import { PreferencesResponse, UserPreferences as UserPreferencesType } from '@/types';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

const mockPreferences: UserPreferencesType = {
  userId: 'test-user',
  topics: ['technology', 'business'],
  tone: 'casual',
  readingTime: 5,
  preferredSources: ['techcrunch'],
  excludedSources: ['cnn'],
  lastUpdated: new Date('2024-01-15T10:00:00Z'),
};

const mockSuccessResponse: PreferencesResponse = {
  success: true,
  data: mockPreferences,
};

describe('UserPreferences Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading state initially', () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves
    
    render(<UserPreferences userId="test-user" />);
    
    // Check for loading elements
    const loadingElements = document.querySelectorAll('.animate-pulse');
    expect(loadingElements.length).toBeGreaterThan(0);
  });

  it('should render preferences form when data loads successfully', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSuccessResponse),
    });

    render(<UserPreferences userId="test-user" />);
    
    await waitFor(() => {
      expect(screen.getByText('News Preferences')).toBeInTheDocument();
    }, { timeout: 10000 });

    await waitFor(() => {
      expect(screen.getByText('Interested Topics')).toBeInTheDocument();
      expect(screen.getByText('Preferred Tone')).toBeInTheDocument();
      expect(screen.getByText('Reading Time')).toBeInTheDocument();
      expect(screen.getByText('News Sources')).toBeInTheDocument();
    }, { timeout: 10000 });
  });

  it('should handle error state', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch preferences',
        },
      }),
    });

    render(<UserPreferences userId="test-user" />);
    
    await waitFor(() => {
      expect(screen.getByText('Unable to load preferences')).toBeInTheDocument();
    }, { timeout: 10000 });
  });

  it('should show selected topics', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSuccessResponse),
    });

    render(<UserPreferences userId="test-user" />);
    
    await waitFor(() => {
      const technologyButton = screen.getByRole('button', { name: /technology/i });
      const businessButton = screen.getByRole('button', { name: /business/i });
      
      expect(technologyButton).toHaveClass('bg-blue-600');
      expect(businessButton).toHaveClass('bg-blue-600');
    }, { timeout: 10000 });
  });

  it('should show selected tone', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSuccessResponse),
    });

    render(<UserPreferences userId="test-user" />);
    
    await waitFor(() => {
      const casualRadio = screen.getByRole('radio', { name: /casual/i });
      expect(casualRadio).toBeChecked();
    }, { timeout: 10000 });
  });

  it('should show reading time slider value', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSuccessResponse),
    });

    render(<UserPreferences userId="test-user" />);
    
    await waitFor(() => {
      expect(screen.getByText('News Preferences')).toBeInTheDocument();
    }, { timeout: 10000 });
    
    // Check for reading time text
    expect(screen.getByText(/5 minutes/)).toBeInTheDocument();
  });

  it('should toggle topic selection', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSuccessResponse),
    });

    render(<UserPreferences userId="test-user" />);
    
    await waitFor(() => {
      const scienceButton = screen.getByRole('button', { name: /science/i });
      expect(scienceButton).not.toHaveClass('bg-blue-600');
      
      fireEvent.click(scienceButton);
      
      // Should show save changes button
      expect(screen.getByText('Save Changes')).toBeInTheDocument();
    }, { timeout: 10000 });
  });

  it('should change tone selection', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSuccessResponse),
    });

    render(<UserPreferences userId="test-user" />);
    
    await waitFor(() => {
      const formalRadio = screen.getByRole('radio', { name: /formal/i });
      fireEvent.click(formalRadio);
      
      // Should show save changes button
      expect(screen.getByText('Save Changes')).toBeInTheDocument();
    }, { timeout: 10000 });
  });

  it('should handle reading time change', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSuccessResponse),
    });

    render(<UserPreferences userId="test-user" />);
    
    await waitFor(() => {
      expect(screen.getByText('News Preferences')).toBeInTheDocument();
    }, { timeout: 10000 });
    
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '10' } });
    
    // Should show save changes button
    expect(screen.getByText('Save Changes')).toBeInTheDocument();
  });

  it('should handle source preferences', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSuccessResponse),
    });

    render(<UserPreferences userId="test-user" />);
    
    await waitFor(() => {
      expect(screen.getByText('News Preferences')).toBeInTheDocument();
    }, { timeout: 10000 });
    
    // Check that source names are displayed
    expect(screen.getByText('TechCrunch')).toBeInTheDocument();
    expect(screen.getByText('CNN')).toBeInTheDocument();
    expect(screen.getByText('BBC')).toBeInTheDocument();
  });

  it('should call onPreferencesUpdate when preferences are saved', async () => {
    const mockOnUpdate = vi.fn();
    
    // Mock initial fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockSuccessResponse),
    });

    render(<UserPreferences userId="test-user" onPreferencesUpdate={mockOnUpdate} />);
    
    await waitFor(() => {
      const scienceButton = screen.getByRole('button', { name: /science/i });
      fireEvent.click(scienceButton);
    }, { timeout: 10000 });

    // Mock save request
    const updatedPreferences = {
      ...mockPreferences,
      topics: [...mockPreferences.topics, 'science'],
    };
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: updatedPreferences,
      }),
    });

    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockOnUpdate).toHaveBeenCalledWith(updatedPreferences);
    }, { timeout: 10000 });
  });

  it('should apply custom className', () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));
    
    const { container } = render(<UserPreferences userId="test-user" className="custom-class" />);
    
    expect(container.firstChild).toHaveClass('custom-class');
  });
});