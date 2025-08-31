import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  UserPreferencesService,
  UserInteractionService,
  DatabaseHealthService,
  DatabaseError,
} from '../database';
import { supabase } from '../supabase';
import { config } from '../config';
import { UserPreferences, UserInteraction } from '../../types';

// Mock Supabase
vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
  TABLES: {
    USER_PREFERENCES: 'user_preferences',
    USER_INTERACTIONS: 'user_interactions',
    ARTICLES: 'articles',
    ARTICLE_CHUNKS: 'article_chunks',
  },
}));

describe('UserPreferencesService', () => {
  let service: UserPreferencesService;
  let mockSupabaseChain: any;

  beforeEach(() => {
    service = new UserPreferencesService();
    mockSupabaseChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
    };
    
    (supabase.from as any).mockReturnValue(mockSupabaseChain);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getUserPreferences', () => {
    it('should return user preferences when found', async () => {
      const mockPreferences = {
        userId: 'user123',
        topics: ['technology'],
        tone: 'casual',
        readingTime: 5,
        preferredSources: ['bbc-news'],
        excludedSources: [],
        lastUpdated: '2024-01-01T00:00:00.000Z',
      };

      mockSupabaseChain.single.mockResolvedValue({
        data: mockPreferences,
        error: null,
      });

      const result = await service.getUserPreferences('user123');

      expect(result).toEqual({
        ...mockPreferences,
        lastUpdated: new Date('2024-01-01T00:00:00.000Z'),
      });
      expect(supabase.from).toHaveBeenCalledWith('user_preferences');
      expect(mockSupabaseChain.eq).toHaveBeenCalledWith('userId', 'user123');
    });

    it('should return null when user not found', async () => {
      mockSupabaseChain.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      const result = await service.getUserPreferences('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw DatabaseError on database error', async () => {
      mockSupabaseChain.single.mockResolvedValue({
        data: null,
        error: { code: 'DB_ERROR', message: 'Database error' },
      });

      await expect(service.getUserPreferences('user123')).rejects.toThrow(DatabaseError);
    });
  });

  describe('createUserPreferences', () => {
    it('should create new user preferences', async () => {
      const inputPreferences = {
        userId: 'user123',
        topics: ['technology'],
        tone: 'casual' as const,
        readingTime: 5,
        preferredSources: ['bbc-news'],
        excludedSources: [],
      };

      const mockCreatedPreferences = {
        ...inputPreferences,
        lastUpdated: '2024-01-01T00:00:00.000Z',
      };

      mockSupabaseChain.single.mockResolvedValue({
        data: mockCreatedPreferences,
        error: null,
      });

      const result = await service.createUserPreferences(inputPreferences);

      expect(result).toEqual({
        ...mockCreatedPreferences,
        lastUpdated: new Date('2024-01-01T00:00:00.000Z'),
      });
      expect(mockSupabaseChain.insert).toHaveBeenCalled();
    });

    it('should throw DatabaseError on creation failure', async () => {
      const inputPreferences = {
        userId: 'user123',
        topics: ['technology'],
        tone: 'casual' as const,
        readingTime: 5,
        preferredSources: ['bbc-news'],
        excludedSources: [],
      };

      mockSupabaseChain.single.mockResolvedValue({
        data: null,
        error: { code: 'DB_ERROR', message: 'Creation failed' },
      });

      await expect(service.createUserPreferences(inputPreferences)).rejects.toThrow(DatabaseError);
    });
  });

  describe('updateUserPreferences', () => {
    it('should update user preferences', async () => {
      const updates = {
        topics: ['science', 'technology'],
        tone: 'formal' as const,
      };

      const mockUpdatedPreferences = {
        userId: 'user123',
        topics: ['science', 'technology'],
        tone: 'formal',
        readingTime: 5,
        preferredSources: ['bbc-news'],
        excludedSources: [],
        lastUpdated: '2024-01-01T00:00:00.000Z',
      };

      mockSupabaseChain.single.mockResolvedValue({
        data: mockUpdatedPreferences,
        error: null,
      });

      const result = await service.updateUserPreferences('user123', updates);

      expect(result).toEqual({
        ...mockUpdatedPreferences,
        lastUpdated: new Date('2024-01-01T00:00:00.000Z'),
      });
      expect(mockSupabaseChain.update).toHaveBeenCalled();
      expect(mockSupabaseChain.eq).toHaveBeenCalledWith('userId', 'user123');
    });
  });

  describe('getOrCreateUserPreferences', () => {
    it('should return existing preferences if found', async () => {
      const mockPreferences = {
        userId: 'user123',
        topics: ['technology'],
        tone: 'casual',
        readingTime: 5,
        preferredSources: ['bbc-news'],
        excludedSources: [],
        lastUpdated: '2024-01-01T00:00:00.000Z',
      };

      // Mock getUserPreferences to return existing preferences
      vi.spyOn(service, 'getUserPreferences').mockResolvedValue({
        ...mockPreferences,
        lastUpdated: new Date('2024-01-01T00:00:00.000Z'),
      } as UserPreferences);

      const result = await service.getOrCreateUserPreferences('user123');

      expect(result.userId).toBe('user123');
      expect(service.getUserPreferences).toHaveBeenCalledWith('user123');
    });

    it('should create new preferences if not found', async () => {
      // Mock getUserPreferences to return null
      vi.spyOn(service, 'getUserPreferences').mockResolvedValue(null);
      
      const mockCreatedPreferences = {
        userId: 'user123',
        ...config.defaultPreferences,
        lastUpdated: new Date(),
      };

      vi.spyOn(service, 'createUserPreferences').mockResolvedValue(mockCreatedPreferences as UserPreferences);

      const result = await service.getOrCreateUserPreferences('user123');

      expect(result.userId).toBe('user123');
      expect(service.createUserPreferences).toHaveBeenCalledWith({
        userId: 'user123',
        ...config.defaultPreferences,
      });
    });
  });

  describe('deleteUserPreferences', () => {
    it('should delete user preferences successfully', async () => {
      mockSupabaseChain.eq.mockResolvedValue({
        error: null,
      });

      const result = await service.deleteUserPreferences('user123');

      expect(result).toBe(true);
      expect(mockSupabaseChain.delete).toHaveBeenCalled();
      expect(mockSupabaseChain.eq).toHaveBeenCalledWith('userId', 'user123');
    });

    it('should throw DatabaseError on deletion failure', async () => {
      mockSupabaseChain.eq.mockResolvedValue({
        error: { code: 'DB_ERROR', message: 'Deletion failed' },
      });

      await expect(service.deleteUserPreferences('user123')).rejects.toThrow(DatabaseError);
    });
  });
});

describe('UserInteractionService', () => {
  let service: UserInteractionService;
  let mockSupabaseChain: any;

  beforeEach(() => {
    service = new UserInteractionService();
    mockSupabaseChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      insert: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
    };
    
    (supabase.from as any).mockReturnValue(mockSupabaseChain);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('recordInteraction', () => {
    it('should record user interaction successfully', async () => {
      const inputInteraction = {
        userId: 'user123',
        articleId: 'article456',
        action: 'read_more' as const,
      };

      const mockRecordedInteraction = {
        ...inputInteraction,
        timestamp: '2024-01-01T00:00:00.000Z',
      };

      mockSupabaseChain.single.mockResolvedValue({
        data: mockRecordedInteraction,
        error: null,
      });

      const result = await service.recordInteraction(inputInteraction);

      expect(result).toEqual({
        ...mockRecordedInteraction,
        timestamp: new Date('2024-01-01T00:00:00.000Z'),
      });
      expect(mockSupabaseChain.insert).toHaveBeenCalled();
    });

    it('should throw DatabaseError on recording failure', async () => {
      const inputInteraction = {
        userId: 'user123',
        articleId: 'article456',
        action: 'read_more' as const,
      };

      mockSupabaseChain.single.mockResolvedValue({
        data: null,
        error: { code: 'DB_ERROR', message: 'Recording failed' },
      });

      await expect(service.recordInteraction(inputInteraction)).rejects.toThrow(DatabaseError);
    });
  });

  describe('getUserInteractions', () => {
    it('should fetch user interactions with pagination', async () => {
      const mockInteractions = [
        {
          userId: 'user123',
          articleId: 'article1',
          action: 'read_more',
          timestamp: '2024-01-01T00:00:00.000Z',
        },
        {
          userId: 'user123',
          articleId: 'article2',
          action: 'like',
          timestamp: '2024-01-01T01:00:00.000Z',
        },
      ];

      mockSupabaseChain.range.mockResolvedValue({
        data: mockInteractions,
        error: null,
      });

      const result = await service.getUserInteractions('user123', 10, 0);

      expect(result).toHaveLength(2);
      expect(result[0].timestamp).toBeInstanceOf(Date);
      expect(mockSupabaseChain.eq).toHaveBeenCalledWith('userId', 'user123');
      expect(mockSupabaseChain.order).toHaveBeenCalledWith('timestamp', { ascending: false });
      expect(mockSupabaseChain.range).toHaveBeenCalledWith(0, 9);
    });
  });

  describe('getUserInteractionStats', () => {
    it('should calculate interaction statistics', async () => {
      const mockInteractions = [
        {
          userId: 'user123',
          articleId: 'article1',
          action: 'read_more',
          timestamp: new Date('2024-01-01T00:00:00.000Z'),
        },
        {
          userId: 'user123',
          articleId: 'article2',
          action: 'read_more',
          timestamp: new Date('2024-01-01T01:00:00.000Z'),
        },
        {
          userId: 'user123',
          articleId: 'article3',
          action: 'like',
          timestamp: new Date('2024-01-01T02:00:00.000Z'),
        },
      ] as UserInteraction[];

      vi.spyOn(service, 'getUserInteractions').mockResolvedValue(mockInteractions);

      const result = await service.getUserInteractionStats('user123');

      expect(result.totalInteractions).toBe(3);
      expect(result.actionCounts.read_more).toBe(2);
      expect(result.actionCounts.like).toBe(1);
      expect(result.actionCounts.hide).toBe(0);
      expect(result.actionCounts.share).toBe(0);
      expect(result.recentActivity).toHaveLength(3);
    });
  });

  describe('cleanupOldInteractions', () => {
    it('should cleanup old interactions', async () => {
      const mockDeletedRows = [{ userId: 'user1' }, { userId: 'user2' }];

      mockSupabaseChain.select.mockResolvedValue({
        data: mockDeletedRows,
        error: null,
      });

      const result = await service.cleanupOldInteractions(90);

      expect(result).toBe(2);
      expect(mockSupabaseChain.delete).toHaveBeenCalled();
      expect(mockSupabaseChain.lt).toHaveBeenCalled();
    });
  });
});

describe('DatabaseHealthService', () => {
  let service: DatabaseHealthService;
  let mockSupabaseChain: any;

  beforeEach(() => {
    service = new DatabaseHealthService();
    mockSupabaseChain = {
      select: vi.fn().mockReturnThis(),
      limit: vi.fn(),
    };
    
    (supabase.from as any).mockReturnValue(mockSupabaseChain);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('checkHealth', () => {
    it('should return healthy status when database is accessible', async () => {
      mockSupabaseChain.limit.mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve({ data: [], error: null }), 10);
        });
      });

      const result = await service.checkHealth();

      expect(result.isHealthy).toBe(true);
      expect(result.latency).toBeGreaterThan(0);
      expect(result.error).toBeUndefined();
    });

    it('should return unhealthy status when database has error', async () => {
      mockSupabaseChain.limit.mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve({ data: null, error: { message: 'Connection failed' } }), 10);
        });
      });

      const result = await service.checkHealth();

      expect(result.isHealthy).toBe(false);
      expect(result.latency).toBeGreaterThan(0);
      expect(result.error).toBe('Connection failed');
    });

    it('should handle exceptions gracefully', async () => {
      mockSupabaseChain.limit.mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Network error')), 10);
        });
      });

      const result = await service.checkHealth();

      expect(result.isHealthy).toBe(false);
      expect(result.latency).toBeGreaterThan(0);
      expect(result.error).toBe('Network error');
    });
  });
});

describe('DatabaseError', () => {
  it('should create DatabaseError with correct properties', () => {
    const error = new DatabaseError('Test error', 'TEST_CODE', { detail: 'test' });

    expect(error.name).toBe('DatabaseError');
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_CODE');
    expect(error.details).toEqual({ detail: 'test' });
    expect(error).toBeInstanceOf(Error);
  });
});