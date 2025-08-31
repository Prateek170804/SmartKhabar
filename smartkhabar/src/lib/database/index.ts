// src/lib/database/index.ts
import { getNeonClient } from './neon-client';
import { UserPreferences } from '@/types';

const client = getNeonClient();

export const userPreferencesService = {
  async getOrCreateUserPreferences(userId: string): Promise<UserPreferences> {
    try {
      const dbPreferences = await client.getUserPreferences(userId);
      
      if (dbPreferences) {
        // Map database fields to TypeScript interface
        return {
          userId: dbPreferences.user_id,
          topics: dbPreferences.topics || ['general'],
          tone: (dbPreferences.tone as 'formal' | 'casual' | 'fun') || 'casual',
          readingTime: dbPreferences.reading_time || 5,
          preferredSources: dbPreferences.preferred_sources || [],
          excludedSources: dbPreferences.excluded_sources || [],
          lastUpdated: new Date(dbPreferences.updated_at),
          createdAt: new Date(dbPreferences.created_at),
          updatedAt: new Date(dbPreferences.updated_at),
        };
      } else {
        // Create default preferences
        const defaultPreferences = {
          userId,
          topics: ['general'],
          tone: 'casual' as const,
          readingTime: 5,
          preferredSources: [],
          excludedSources: [],
          lastUpdated: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        // Save to database
        await client.saveUserPreferences(userId, {
          topics: defaultPreferences.topics,
          tone: defaultPreferences.tone,
          readingTime: defaultPreferences.readingTime,
          preferredSources: defaultPreferences.preferredSources,
          excludedSources: defaultPreferences.excludedSources,
        });
        
        return defaultPreferences;
      }
    } catch (error) {
      throw new Error(`Failed to get or create preferences for user ${userId}: ${(error as Error).message}`);
    }
  },
};