import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { UserInteractionSchema, validateUserInteraction } from '@/types';

describe('Interaction Validation', () => {
  describe('UserInteractionSchema', () => {
    it('should validate valid interaction data', () => {
      const validInteraction = {
        userId: 'user123',
        articleId: 'article456',
        action: 'read_more',
        timestamp: new Date(),
      };

      const result = UserInteractionSchema.safeParse(validInteraction);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validInteraction);
      }
    });

    it('should reject interaction with missing userId', () => {
      const invalidInteraction = {
        articleId: 'article456',
        action: 'read_more',
        timestamp: new Date(),
      };

      const result = UserInteractionSchema.safeParse(invalidInteraction);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].path).toEqual(['userId']);
        expect(result.error.errors[0].message).toBe('Required');
      }
    });

    it('should reject interaction with empty userId', () => {
      const invalidInteraction = {
        userId: '',
        articleId: 'article456',
        action: 'read_more',
        timestamp: new Date(),
      };

      const result = UserInteractionSchema.safeParse(invalidInteraction);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].path).toEqual(['userId']);
        expect(result.error.errors[0].message).toBe('User ID is required');
      }
    });

    it('should reject interaction with missing articleId', () => {
      const invalidInteraction = {
        userId: 'user123',
        action: 'read_more',
        timestamp: new Date(),
      };

      const result = UserInteractionSchema.safeParse(invalidInteraction);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].path).toEqual(['articleId']);
        expect(result.error.errors[0].message).toBe('Required');
      }
    });

    it('should reject interaction with empty articleId', () => {
      const invalidInteraction = {
        userId: 'user123',
        articleId: '',
        action: 'read_more',
        timestamp: new Date(),
      };

      const result = UserInteractionSchema.safeParse(invalidInteraction);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].path).toEqual(['articleId']);
        expect(result.error.errors[0].message).toBe('Article ID is required');
      }
    });

    it('should reject interaction with invalid action', () => {
      const invalidInteraction = {
        userId: 'user123',
        articleId: 'article456',
        action: 'invalid_action',
        timestamp: new Date(),
      };

      const result = UserInteractionSchema.safeParse(invalidInteraction);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].path).toEqual(['action']);
        expect(result.error.errors[0].code).toBe('invalid_enum_value');
      }
    });

    it('should accept all valid action types', () => {
      const validActions = ['read_more', 'hide', 'like', 'share'];
      
      for (const action of validActions) {
        const interaction = {
          userId: 'user123',
          articleId: 'article456',
          action,
          timestamp: new Date(),
        };

        const result = UserInteractionSchema.safeParse(interaction);
        expect(result.success).toBe(true);
      }
    });

    it('should use current timestamp as default', () => {
      const interactionWithoutTimestamp = {
        userId: 'user123',
        articleId: 'article456',
        action: 'read_more',
      };

      const result = UserInteractionSchema.safeParse(interactionWithoutTimestamp);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.timestamp).toBeInstanceOf(Date);
        // Should be very recent (within last second)
        const now = new Date();
        const timeDiff = now.getTime() - result.data.timestamp.getTime();
        expect(timeDiff).toBeLessThan(1000);
      }
    });

    it('should accept custom timestamp', () => {
      const customTimestamp = new Date('2024-01-01T12:00:00Z');
      const interaction = {
        userId: 'user123',
        articleId: 'article456',
        action: 'read_more',
        timestamp: customTimestamp,
      };

      const result = UserInteractionSchema.safeParse(interaction);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.timestamp).toEqual(customTimestamp);
      }
    });

    it('should reject interaction with invalid timestamp type', () => {
      const invalidInteraction = {
        userId: 'user123',
        articleId: 'article456',
        action: 'read_more',
        timestamp: 'invalid-date',
      };

      const result = UserInteractionSchema.safeParse(invalidInteraction);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].path).toEqual(['timestamp']);
        expect(result.error.errors[0].code).toBe('invalid_type');
      }
    });
  });

  describe('validateUserInteraction function', () => {
    it('should validate and return valid interaction', () => {
      const validInteraction = {
        userId: 'user123',
        articleId: 'article456',
        action: 'read_more',
        timestamp: new Date(),
      };

      const result = validateUserInteraction(validInteraction);
      expect(result).toEqual(validInteraction);
    });

    it('should throw ZodError for invalid interaction', () => {
      const invalidInteraction = {
        userId: '',
        articleId: 'article456',
        action: 'invalid_action',
        timestamp: new Date(),
      };

      expect(() => validateUserInteraction(invalidInteraction)).toThrow(z.ZodError);
    });

    it('should handle missing fields gracefully', () => {
      const incompleteInteraction = {
        userId: 'user123',
        // Missing articleId and action
      };

      expect(() => validateUserInteraction(incompleteInteraction)).toThrow(z.ZodError);
    });

    it('should validate interaction with default timestamp', () => {
      const interactionWithoutTimestamp = {
        userId: 'user123',
        articleId: 'article456',
        action: 'like',
      };

      const result = validateUserInteraction(interactionWithoutTimestamp);
      expect(result.userId).toBe('user123');
      expect(result.articleId).toBe('article456');
      expect(result.action).toBe('like');
      expect(result.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('Request validation schemas', () => {
    it('should validate single interaction request', () => {
      const InteractionRequestSchema = z.object({
        userId: z.string().min(1, 'User ID is required'),
        articleId: z.string().min(1, 'Article ID is required'),
        action: z.enum(['read_more', 'hide', 'like', 'share']),
      });

      const validRequest = {
        userId: 'user123',
        articleId: 'article456',
        action: 'read_more',
      };

      const result = InteractionRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it('should validate batch interaction request', () => {
      const InteractionRequestSchema = z.object({
        userId: z.string().min(1, 'User ID is required'),
        articleId: z.string().min(1, 'Article ID is required'),
        action: z.enum(['read_more', 'hide', 'like', 'share']),
      });

      const AnalyticsRequestSchema = z.object({
        userId: z.string().min(1, 'User ID is required'),
        interactions: z.array(InteractionRequestSchema).min(1, 'At least one interaction is required'),
      });

      const validBatchRequest = {
        userId: 'user123',
        interactions: [
          {
            userId: 'user123',
            articleId: 'article456',
            action: 'read_more',
          },
          {
            userId: 'user123',
            articleId: 'article789',
            action: 'like',
          },
        ],
      };

      const result = AnalyticsRequestSchema.safeParse(validBatchRequest);
      expect(result.success).toBe(true);
    });

    it('should reject batch request with empty interactions array', () => {
      const InteractionRequestSchema = z.object({
        userId: z.string().min(1, 'User ID is required'),
        articleId: z.string().min(1, 'Article ID is required'),
        action: z.enum(['read_more', 'hide', 'like', 'share']),
      });

      const AnalyticsRequestSchema = z.object({
        userId: z.string().min(1, 'User ID is required'),
        interactions: z.array(InteractionRequestSchema).min(1, 'At least one interaction is required'),
      });

      const invalidBatchRequest = {
        userId: 'user123',
        interactions: [],
      };

      const result = AnalyticsRequestSchema.safeParse(invalidBatchRequest);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].path).toEqual(['interactions']);
        expect(result.error.errors[0].message).toBe('At least one interaction is required');
      }
    });

    it('should validate individual interactions in batch request', () => {
      const InteractionRequestSchema = z.object({
        userId: z.string().min(1, 'User ID is required'),
        articleId: z.string().min(1, 'Article ID is required'),
        action: z.enum(['read_more', 'hide', 'like', 'share']),
      });

      const AnalyticsRequestSchema = z.object({
        userId: z.string().min(1, 'User ID is required'),
        interactions: z.array(InteractionRequestSchema).min(1, 'At least one interaction is required'),
      });

      const invalidBatchRequest = {
        userId: 'user123',
        interactions: [
          {
            userId: 'user123',
            articleId: 'article456',
            action: 'read_more',
          },
          {
            userId: 'user123',
            // Missing articleId
            action: 'like',
          },
        ],
      };

      const result = AnalyticsRequestSchema.safeParse(invalidBatchRequest);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].path).toEqual(['interactions', 1, 'articleId']);
      }
    });
  });

  describe('Edge cases', () => {
    it('should handle very long user IDs', () => {
      const longUserId = 'a'.repeat(1000);
      const interaction = {
        userId: longUserId,
        articleId: 'article456',
        action: 'read_more',
        timestamp: new Date(),
      };

      const result = UserInteractionSchema.safeParse(interaction);
      expect(result.success).toBe(true);
    });

    it('should handle very long article IDs', () => {
      const longArticleId = 'article_' + 'a'.repeat(1000);
      const interaction = {
        userId: 'user123',
        articleId: longArticleId,
        action: 'read_more',
        timestamp: new Date(),
      };

      const result = UserInteractionSchema.safeParse(interaction);
      expect(result.success).toBe(true);
    });

    it('should handle special characters in IDs', () => {
      const interaction = {
        userId: 'user-123_test@domain.com',
        articleId: 'article-456_test@source.com',
        action: 'read_more',
        timestamp: new Date(),
      };

      const result = UserInteractionSchema.safeParse(interaction);
      expect(result.success).toBe(true);
    });

    it('should handle future timestamps', () => {
      const futureTimestamp = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day in future
      const interaction = {
        userId: 'user123',
        articleId: 'article456',
        action: 'read_more',
        timestamp: futureTimestamp,
      };

      const result = UserInteractionSchema.safeParse(interaction);
      expect(result.success).toBe(true);
    });

    it('should handle very old timestamps', () => {
      const oldTimestamp = new Date('1990-01-01T00:00:00Z');
      const interaction = {
        userId: 'user123',
        articleId: 'article456',
        action: 'read_more',
        timestamp: oldTimestamp,
      };

      const result = UserInteractionSchema.safeParse(interaction);
      expect(result.success).toBe(true);
    });
  });
});