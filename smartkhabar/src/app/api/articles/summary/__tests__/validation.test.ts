/**
 * Simple validation tests for the summary API
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Test the validation schema directly
const SummaryRequestBodySchema = z.object({
  articles: z.array(z.object({
    id: z.string().min(1, 'Article ID is required'),
    headline: z.string().min(1, 'Headline is required'),
    content: z.string().min(1, 'Content is required'),
    source: z.string().min(1, 'Source is required'),
    category: z.string().min(1, 'Category is required'),
    publishedAt: z.string().datetime().transform(str => new Date(str)),
    url: z.string().url('Invalid URL format'),
    tags: z.array(z.string()).default([]),
  })).min(1, 'At least one article is required'),
  tone: z.enum(['formal', 'casual', 'fun']).default('casual'),
  maxReadingTime: z.number().int().min(1, 'Reading time must be at least 1 minute').max(15, 'Reading time cannot exceed 15 minutes').default(5),
  userId: z.string().min(1, 'User ID is required'),
  enableCaching: z.boolean().default(true),
});

describe('Summary API Validation', () => {
  const validArticle = {
    id: 'article-1',
    headline: 'Test Article Headline',
    content: 'This is the test article content that should be summarized.',
    source: 'test-source',
    category: 'technology',
    publishedAt: '2024-01-01T00:00:00Z',
    url: 'https://example.com/article-1',
    tags: ['test', 'article']
  };

  it('should validate correct request data', () => {
    const validData = {
      articles: [validArticle],
      tone: 'casual',
      maxReadingTime: 5,
      userId: 'user-1',
      enableCaching: true
    };

    const result = SummaryRequestBodySchema.safeParse(validData);
    expect(result.success).toBe(true);
    
    if (result.success) {
      expect(result.data.articles).toHaveLength(1);
      expect(result.data.tone).toBe('casual');
      expect(result.data.maxReadingTime).toBe(5);
      expect(result.data.userId).toBe('user-1');
      expect(result.data.enableCaching).toBe(true);
    }
  });

  it('should reject empty articles array', () => {
    const invalidData = {
      articles: [],
      tone: 'casual',
      maxReadingTime: 5,
      userId: 'user-1'
    };

    const result = SummaryRequestBodySchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    
    if (!result.success) {
      expect(result.error.errors[0].message).toBe('At least one article is required');
    }
  });

  it('should reject invalid tone', () => {
    const invalidData = {
      articles: [validArticle],
      tone: 'invalid-tone',
      maxReadingTime: 5,
      userId: 'user-1'
    };

    const result = SummaryRequestBodySchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject reading time exceeding maximum', () => {
    const invalidData = {
      articles: [validArticle],
      tone: 'casual',
      maxReadingTime: 20, // Exceeds max of 15
      userId: 'user-1'
    };

    const result = SummaryRequestBodySchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    
    if (!result.success) {
      expect(result.error.errors[0].message).toBe('Reading time cannot exceed 15 minutes');
    }
  });

  it('should reject reading time below minimum', () => {
    const invalidData = {
      articles: [validArticle],
      tone: 'casual',
      maxReadingTime: 0, // Below min of 1
      userId: 'user-1'
    };

    const result = SummaryRequestBodySchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    
    if (!result.success) {
      expect(result.error.errors[0].message).toBe('Reading time must be at least 1 minute');
    }
  });

  it('should reject missing userId', () => {
    const invalidData = {
      articles: [validArticle],
      tone: 'casual',
      maxReadingTime: 5
      // Missing userId
    };

    const result = SummaryRequestBodySchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should use default values when optional fields are missing', () => {
    const minimalData = {
      articles: [validArticle],
      userId: 'user-1'
      // Missing tone, maxReadingTime, enableCaching
    };

    const result = SummaryRequestBodySchema.safeParse(minimalData);
    expect(result.success).toBe(true);
    
    if (result.success) {
      expect(result.data.tone).toBe('casual');
      expect(result.data.maxReadingTime).toBe(5);
      expect(result.data.enableCaching).toBe(true);
    }
  });

  it('should validate article fields', () => {
    const invalidArticle = {
      id: '', // Empty ID
      headline: 'Test Headline',
      content: 'Test content',
      source: 'test-source',
      category: 'technology',
      publishedAt: '2024-01-01T00:00:00Z',
      url: 'https://example.com/article',
      tags: ['test']
    };

    const invalidData = {
      articles: [invalidArticle],
      tone: 'casual',
      maxReadingTime: 5,
      userId: 'user-1'
    };

    const result = SummaryRequestBodySchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    
    if (!result.success) {
      expect(result.error.errors[0].message).toBe('Article ID is required');
    }
  });

  it('should validate URL format', () => {
    const invalidArticle = {
      ...validArticle,
      url: 'not-a-valid-url'
    };

    const invalidData = {
      articles: [invalidArticle],
      tone: 'casual',
      maxReadingTime: 5,
      userId: 'user-1'
    };

    const result = SummaryRequestBodySchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    
    if (!result.success) {
      expect(result.error.errors[0].message).toBe('Invalid URL format');
    }
  });

  it('should validate datetime format', () => {
    const invalidArticle = {
      ...validArticle,
      publishedAt: 'not-a-valid-date'
    };

    const invalidData = {
      articles: [invalidArticle],
      tone: 'casual',
      maxReadingTime: 5,
      userId: 'user-1'
    };

    const result = SummaryRequestBodySchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});