import { supabase, TABLES } from './supabase';
import { config } from './config';
import {
  UserPreferences,
  UserInteraction,
  validateUserPreferences,
  validateUserInteraction,
  UserPreferencesSchema,
  UserInteractionSchema,
} from '../types';
import { z } from 'zod';
import { databaseOptimizer, optimizedQuery } from './monitoring/database-optimizer';
import { trackDatabaseQuery } from './monitoring/performance';

// Database error types
export class DatabaseError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

// User Preferences CRUD Operations
export class UserPreferencesService {
  /**
   * Get user preferences by user ID
   */
  @optimizedQuery('getUserPreferences', { cache: true, cacheTTL: 5 * 60 * 1000 })
  async getUserPreferences(userId: string, requestId: string = 'unknown'): Promise<UserPreferences | null> {
    return trackDatabaseQuery(requestId, 'getUserPreferences', async () => {
      try {
        const { data, error } = await supabase
          .from(TABLES.USER_PREFERENCES)
          .select('*')
          .eq('userId', userId)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            // No rows returned - user doesn't exist
            return null;
          }
          throw new DatabaseError(
            'Failed to fetch user preferences',
            error.code,
            error
          );
        }

        // Parse dates and validate data
        const preferences = {
          ...data,
          lastUpdated: new Date(data.lastUpdated),
        };

        return validateUserPreferences(preferences);
      } catch (error) {
        if (error instanceof DatabaseError) {
          throw error;
        }
        throw new DatabaseError(
          'Unexpected error fetching user preferences',
          'UNKNOWN_ERROR',
          error
        );
      }
    });
  }

  /**
   * Create new user preferences
   */
  async createUserPreferences(preferences: Omit<UserPreferences, 'lastUpdated'>, requestId: string = 'unknown'): Promise<UserPreferences> {
    try {
      const newPreferences: UserPreferences = {
        ...preferences,
        lastUpdated: new Date(),
      };

      // Validate before inserting
      const validatedPreferences = validateUserPreferences(newPreferences);

      const { data, error } = await supabase
        .from(TABLES.USER_PREFERENCES)
        .insert([validatedPreferences])
        .select()
        .single();

      if (error) {
        throw new DatabaseError(
          'Failed to create user preferences',
          error.code,
          error
        );
      }

      return {
        ...data,
        lastUpdated: new Date(data.lastUpdated),
      };
    } catch (error) {
      if (error instanceof DatabaseError || error instanceof z.ZodError) {
        throw error;
      }
      throw new DatabaseError(
        'Unexpected error creating user preferences',
        'UNKNOWN_ERROR',
        error
      );
    }
  }

  /**
   * Update existing user preferences
   */
  async updateUserPreferences(
    userId: string,
    updates: Partial<Omit<UserPreferences, 'userId' | 'lastUpdated'>>,
    requestId: string = 'unknown'
  ): Promise<UserPreferences> {
    return trackDatabaseQuery(requestId, 'updateUserPreferences', async () => {
      try {
        const updatedData = {
          ...updates,
          lastUpdated: new Date(),
        };

        const { data, error } = await supabase
          .from(TABLES.USER_PREFERENCES)
          .update(updatedData)
          .eq('userId', userId)
          .select()
          .single();

        if (error) {
          throw new DatabaseError(
            'Failed to update user preferences',
            error.code,
            error
          );
        }

        // Invalidate cache for this user
        databaseOptimizer.invalidateCache(`getUserPreferences.*${userId}.*`);

        return {
          ...data,
          lastUpdated: new Date(data.lastUpdated),
        };
      } catch (error) {
        if (error instanceof DatabaseError) {
          throw error;
        }
        throw new DatabaseError(
          'Unexpected error updating user preferences',
          'UNKNOWN_ERROR',
          error
        );
      }
    });
  }

  /**
   * Get or create user preferences with defaults
   */
  async getOrCreateUserPreferences(userId: string, requestId: string = 'unknown'): Promise<UserPreferences> {
    try {
      let preferences = await this.getUserPreferences(userId, requestId);
      
      if (!preferences) {
        // Create with default preferences
        preferences = await this.createUserPreferences({
          userId,
          ...config.defaultPreferences,
        }, requestId);
      }

      return preferences;
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(
        'Failed to get or create user preferences',
        'UNKNOWN_ERROR',
        error
      );
    }
  }

  /**
   * Delete user preferences
   */
  async deleteUserPreferences(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from(TABLES.USER_PREFERENCES)
        .delete()
        .eq('userId', userId);

      if (error) {
        throw new DatabaseError(
          'Failed to delete user preferences',
          error.code,
          error
        );
      }

      return true;
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(
        'Unexpected error deleting user preferences',
        'UNKNOWN_ERROR',
        error
      );
    }
  }
}

// User Interaction Tracking Service
export class UserInteractionService {
  /**
   * Record a user interaction
   */
  async recordInteraction(interaction: Omit<UserInteraction, 'timestamp'>): Promise<UserInteraction> {
    try {
      const newInteraction: UserInteraction = {
        ...interaction,
        timestamp: new Date(),
      };

      // Validate before inserting
      const validatedInteraction = validateUserInteraction(newInteraction);

      const { data, error } = await supabase
        .from(TABLES.USER_INTERACTIONS)
        .insert([validatedInteraction])
        .select()
        .single();

      if (error) {
        throw new DatabaseError(
          'Failed to record user interaction',
          error.code,
          error
        );
      }

      return {
        ...data,
        timestamp: new Date(data.timestamp),
      };
    } catch (error) {
      if (error instanceof DatabaseError || error instanceof z.ZodError) {
        throw error;
      }
      throw new DatabaseError(
        'Unexpected error recording interaction',
        'UNKNOWN_ERROR',
        error
      );
    }
  }

  /**
   * Get user interactions for a specific user
   */
  async getUserInteractions(
    userId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<UserInteraction[]> {
    try {
      const { data, error } = await supabase
        .from(TABLES.USER_INTERACTIONS)
        .select('*')
        .eq('userId', userId)
        .order('timestamp', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw new DatabaseError(
          'Failed to fetch user interactions',
          error.code,
          error
        );
      }

      return data.map(interaction => ({
        ...interaction,
        timestamp: new Date(interaction.timestamp),
      }));
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(
        'Unexpected error fetching user interactions',
        'UNKNOWN_ERROR',
        error
      );
    }
  }

  /**
   * Get interaction statistics for a user
   */
  async getUserInteractionStats(userId: string): Promise<{
    totalInteractions: number;
    actionCounts: Record<UserInteraction['action'], number>;
    recentActivity: UserInteraction[];
  }> {
    try {
      const interactions = await this.getUserInteractions(userId, 1000);
      
      const actionCounts = interactions.reduce((acc, interaction) => {
        acc[interaction.action] = (acc[interaction.action] || 0) + 1;
        return acc;
      }, {} as Record<UserInteraction['action'], number>);

      // Fill in missing actions with 0
      const allActions: UserInteraction['action'][] = ['read_more', 'hide', 'like', 'share'];
      allActions.forEach(action => {
        if (!(action in actionCounts)) {
          actionCounts[action] = 0;
        }
      });

      return {
        totalInteractions: interactions.length,
        actionCounts,
        recentActivity: interactions.slice(0, 10), // Last 10 interactions
      };
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(
        'Failed to get user interaction statistics',
        'UNKNOWN_ERROR',
        error
      );
    }
  }

  /**
   * Clean up old interactions (older than specified days)
   */
  async cleanupOldInteractions(daysToKeep: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const { data, error } = await supabase
        .from(TABLES.USER_INTERACTIONS)
        .delete()
        .lt('timestamp', cutoffDate.toISOString())
        .select('userId'); // Just to count deleted rows

      if (error) {
        throw new DatabaseError(
          'Failed to cleanup old interactions',
          error.code,
          error
        );
      }

      return data?.length || 0;
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(
        'Unexpected error during cleanup',
        'UNKNOWN_ERROR',
        error
      );
    }
  }
}

// Database connection health check
export class DatabaseHealthService {
  /**
   * Check if database connection is healthy
   */
  async checkHealth(): Promise<{
    isHealthy: boolean;
    latency: number;
    error?: string;
  }> {
    const startTime = Date.now();
    
    try {
      const { error } = await supabase
        .from(TABLES.USER_PREFERENCES)
        .select('userId')
        .limit(1);

      const latency = Date.now() - startTime;

      if (error) {
        return {
          isHealthy: false,
          latency,
          error: error.message,
        };
      }

      return {
        isHealthy: true,
        latency,
      };
    } catch (error) {
      return {
        isHealthy: false,
        latency: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Export service instances
export const userPreferencesService = new UserPreferencesService();
export const userInteractionService = new UserInteractionService();
export const databaseHealthService = new DatabaseHealthService();