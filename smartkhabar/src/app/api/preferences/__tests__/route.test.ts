import { NextRequest } from 'next/server';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET, PUT, POST, DELETE } from '../route';
import { userPreferencesService } from '@/lib/database';
import { UserPreferences } from '@/types';

// Mock dependencies
vi.mock('@/lib/database');

const mockUserPreferencesService = vi.mocked(userPreferencesService);

describe('/api/preferences', () => {
  const mockUserPreferences: UserPreferences = {
    userId: 'test-user-123',
    topics: ['technology', 'business'],
    tone: 'casual',
    readingTime: 5,
    preferredSources: ['techcrunch', 'bbc'],
    excludedSources: ['tabloid-news'],
    lastUpdated: new Date('2024-01-01T00:00:00Z'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET', () => {
    it('should return user preferences successfully', async () => {
      mockUserPreferencesService.getOrCreateUserPreferences.mockResolvedValue(mockUserPreferences);
      
      const request = new NextRequest('http://localhost:3000/api/preferences?userId=test-user-123');
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual({
        ...mockUserPreferences,
        lastUpdated: mockUserPreferences.lastUpdated.toISOString(),
      });
      expect(mockUserPreferencesService.getOrCreateUserPreferences).toHaveBeenCalledWith('test-user-123');
    });

    it('should return validation error for missing userId', async () => {
      const request = new NextRequest('http://localhost:3000/api/preferences');
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
      expect(data.error.message).toBe('Invalid query parameters');
    });

    it('should return validation error for empty userId', async () => {
      const request = new NextRequest('http://localhost:3000/api/preferences?userId=');
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle database error with fallback', async () => {
      mockUserPreferencesService.getOrCreateUserPreferences.mockRejectedValue(
        new Error('Database connection failed')
      );
      
      const request = new NextRequest('http://localhost:3000/api/preferences?userId=test-user-123');
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('DATABASE_ERROR');
      expect(data.fallback).toHaveProperty('type', 'default_feed');
      expect(data.fallback.data).toHaveProperty('preferences');
    });

    it('should handle unknown error', async () => {
      mockUserPreferencesService.getOrCreateUserPreferences.mockRejectedValue(
        new Error('Unknown service error')
      );
      
      const request = new NextRequest('http://localhost:3000/api/preferences?userId=test-user-123');
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('INTERNAL_ERROR');
    });

    it('should set appropriate cache headers', async () => {
      mockUserPreferencesService.getOrCreateUserPreferences.mockResolvedValue(mockUserPreferences);
      
      const request = new NextRequest('http://localhost:3000/api/preferences?userId=test-user-123');
      
      const response = await GET(request);
      
      expect(response.headers.get('Cache-Control')).toBe('private, max-age=300');
    });
  });

  describe('PUT', () => {
    const updateData = {
      userId: 'test-user-123',
      preferences: {
        topics: ['science', 'health'],
        tone: 'formal' as const,
        readingTime: 8,
      },
    };

    const updatedPreferences: UserPreferences = {
      ...mockUserPreferences,
      ...updateData.preferences,
      lastUpdated: new Date('2024-01-02T00:00:00Z'),
    };

    it('should update user preferences successfully', async () => {
      mockUserPreferencesService.updateUserPreferences.mockResolvedValue(updatedPreferences);
      
      const request = new NextRequest('http://localhost:3000/api/preferences', {
        method: 'PUT',
        body: JSON.stringify(updateData),
        headers: { 'Content-Type': 'application/json' },
      });
      
      const response = await PUT(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual({
        ...updatedPreferences,
        lastUpdated: updatedPreferences.lastUpdated.toISOString(),
      });
      expect(mockUserPreferencesService.updateUserPreferences).toHaveBeenCalledWith(
        'test-user-123',
        expect.objectContaining({
          topics: ['science', 'health'],
          tone: 'formal',
          readingTime: 8,
        })
      );
    });

    it('should sanitize topics by trimming and lowercasing', async () => {
      const dirtyUpdateData = {
        userId: 'test-user-123',
        preferences: {
          topics: ['  TECHNOLOGY  ', 'Business', '', '   science   '],
        },
      };

      mockUserPreferencesService.updateUserPreferences.mockResolvedValue(updatedPreferences);
      
      const request = new NextRequest('http://localhost:3000/api/preferences', {
        method: 'PUT',
        body: JSON.stringify(dirtyUpdateData),
        headers: { 'Content-Type': 'application/json' },
      });
      
      const response = await PUT(request);
      
      expect(response.status).toBe(200);
      expect(mockUserPreferencesService.updateUserPreferences).toHaveBeenCalledWith(
        'test-user-123',
        expect.objectContaining({
          topics: ['technology', 'business', 'science'],
        })
      );
    });

    it('should limit topics to 10 items', async () => {
      const manyTopicsData = {
        userId: 'test-user-123',
        preferences: {
          topics: Array.from({ length: 15 }, (_, i) => `topic-${i}`),
        },
      };

      mockUserPreferencesService.updateUserPreferences.mockResolvedValue(updatedPreferences);
      
      const request = new NextRequest('http://localhost:3000/api/preferences', {
        method: 'PUT',
        body: JSON.stringify(manyTopicsData),
        headers: { 'Content-Type': 'application/json' },
      });
      
      const response = await PUT(request);
      
      expect(response.status).toBe(200);
      const updateCall = mockUserPreferencesService.updateUserPreferences.mock.calls[0];
      expect(updateCall[1].topics).toHaveLength(10);
    });

    it('should filter out invalid tone values', async () => {
      const invalidToneData = {
        userId: 'test-user-123',
        preferences: {
          tone: 'invalid-tone',
        },
      };

      mockUserPreferencesService.updateUserPreferences.mockResolvedValue(updatedPreferences);
      
      const request = new NextRequest('http://localhost:3000/api/preferences', {
        method: 'PUT',
        body: JSON.stringify(invalidToneData),
        headers: { 'Content-Type': 'application/json' },
      });
      
      const response = await PUT(request);
      
      expect(response.status).toBe(200);
      const updateCall = mockUserPreferencesService.updateUserPreferences.mock.calls[0];
      expect(updateCall[1]).not.toHaveProperty('tone');
    });

    it('should filter out invalid reading time values', async () => {
      const invalidReadingTimeData = {
        userId: 'test-user-123',
        preferences: {
          readingTime: 25, // Above max of 15
        },
      };

      mockUserPreferencesService.updateUserPreferences.mockResolvedValue(updatedPreferences);
      
      const request = new NextRequest('http://localhost:3000/api/preferences', {
        method: 'PUT',
        body: JSON.stringify(invalidReadingTimeData),
        headers: { 'Content-Type': 'application/json' },
      });
      
      const response = await PUT(request);
      
      expect(response.status).toBe(200);
      const updateCall = mockUserPreferencesService.updateUserPreferences.mock.calls[0];
      expect(updateCall[1]).not.toHaveProperty('readingTime');
    });

    it('should return validation error for invalid request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/preferences', {
        method: 'PUT',
        body: JSON.stringify({ invalid: 'data' }),
        headers: { 'Content-Type': 'application/json' },
      });
      
      const response = await PUT(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle database error', async () => {
      mockUserPreferencesService.updateUserPreferences.mockRejectedValue(
        new Error('Database connection failed')
      );
      
      const request = new NextRequest('http://localhost:3000/api/preferences', {
        method: 'PUT',
        body: JSON.stringify(updateData),
        headers: { 'Content-Type': 'application/json' },
      });
      
      const response = await PUT(request);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('DATABASE_ERROR');
    });

    it('should handle user not found error', async () => {
      mockUserPreferencesService.updateUserPreferences.mockRejectedValue(
        new Error('User not found')
      );
      
      const request = new NextRequest('http://localhost:3000/api/preferences', {
        method: 'PUT',
        body: JSON.stringify(updateData),
        headers: { 'Content-Type': 'application/json' },
      });
      
      const response = await PUT(request);
      const data = await response.json();
      
      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('USER_NOT_FOUND');
    });

    it('should set no-cache headers', async () => {
      mockUserPreferencesService.updateUserPreferences.mockResolvedValue(updatedPreferences);
      
      const request = new NextRequest('http://localhost:3000/api/preferences', {
        method: 'PUT',
        body: JSON.stringify(updateData),
        headers: { 'Content-Type': 'application/json' },
      });
      
      const response = await PUT(request);
      
      expect(response.headers.get('Cache-Control')).toBe('no-cache');
    });
  });

  describe('POST', () => {
    const createData = {
      userId: 'new-user-456',
      topics: ['technology'],
      tone: 'casual' as const,
      readingTime: 5,
      preferredSources: ['techcrunch'],
      excludedSources: [],
    };

    const createdPreferences: UserPreferences = {
      ...createData,
      lastUpdated: new Date('2024-01-01T00:00:00Z'),
    };

    it('should create user preferences successfully', async () => {
      mockUserPreferencesService.createUserPreferences.mockResolvedValue(createdPreferences);
      
      const request = new NextRequest('http://localhost:3000/api/preferences', {
        method: 'POST',
        body: JSON.stringify(createData),
        headers: { 'Content-Type': 'application/json' },
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data).toEqual({
        ...createdPreferences,
        lastUpdated: createdPreferences.lastUpdated.toISOString(),
      });
      expect(mockUserPreferencesService.createUserPreferences).toHaveBeenCalledWith(
        expect.objectContaining(createData)
      );
    });

    it('should return validation error for invalid request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/preferences', {
        method: 'POST',
        body: JSON.stringify({ userId: '' }), // Invalid empty userId
        headers: { 'Content-Type': 'application/json' },
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle user already exists error', async () => {
      mockUserPreferencesService.createUserPreferences.mockRejectedValue(
        new Error('User already exists')
      );
      
      const request = new NextRequest('http://localhost:3000/api/preferences', {
        method: 'POST',
        body: JSON.stringify(createData),
        headers: { 'Content-Type': 'application/json' },
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(409);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('USER_EXISTS');
    });

    it('should handle database error', async () => {
      mockUserPreferencesService.createUserPreferences.mockRejectedValue(
        new Error('Database connection failed')
      );
      
      const request = new NextRequest('http://localhost:3000/api/preferences', {
        method: 'POST',
        body: JSON.stringify(createData),
        headers: { 'Content-Type': 'application/json' },
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('DATABASE_ERROR');
    });
  });

  describe('DELETE', () => {
    it('should delete user preferences successfully', async () => {
      mockUserPreferencesService.deleteUserPreferences.mockResolvedValue(true);
      
      const request = new NextRequest('http://localhost:3000/api/preferences?userId=test-user-123', {
        method: 'DELETE',
      });
      
      const response = await DELETE(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.message).toBe('User preferences deleted successfully');
      expect(data.data.userId).toBe('test-user-123');
      expect(mockUserPreferencesService.deleteUserPreferences).toHaveBeenCalledWith('test-user-123');
    });

    it('should return validation error for missing userId', async () => {
      const request = new NextRequest('http://localhost:3000/api/preferences', {
        method: 'DELETE',
      });
      
      const response = await DELETE(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle user not found', async () => {
      mockUserPreferencesService.deleteUserPreferences.mockResolvedValue(false);
      
      const request = new NextRequest('http://localhost:3000/api/preferences?userId=nonexistent-user', {
        method: 'DELETE',
      });
      
      const response = await DELETE(request);
      const data = await response.json();
      
      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('USER_NOT_FOUND');
    });

    it('should handle database error', async () => {
      mockUserPreferencesService.deleteUserPreferences.mockRejectedValue(
        new Error('Database connection failed')
      );
      
      const request = new NextRequest('http://localhost:3000/api/preferences?userId=test-user-123', {
        method: 'DELETE',
      });
      
      const response = await DELETE(request);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('DATABASE_ERROR');
    });

    it('should set no-cache headers', async () => {
      mockUserPreferencesService.deleteUserPreferences.mockResolvedValue(true);
      
      const request = new NextRequest('http://localhost:3000/api/preferences?userId=test-user-123', {
        method: 'DELETE',
      });
      
      const response = await DELETE(request);
      
      expect(response.headers.get('Cache-Control')).toBe('no-cache');
    });
  });
});