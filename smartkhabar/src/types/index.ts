// Core data types for SmartKhabar application
import { z } from 'zod';

// Enhanced Article interface for NewsData.io integration
export interface Article {
  id: string;
  title: string;
  description: string;
  content: string;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  source: {
    id: string | null;
    name: string;
    url?: string;
    icon?: string;
  };
  author: string | null;
  category: string;
  language?: string;
  country?: string;
  keywords?: string[];
  sentiment?: string | null;
  aiTag?: string | null;
  videoUrl?: string | null;
  priority?: number;
}

// Zod validation schemas
export const NewsArticleSchema = z.object({
  id: z.string().min(1, 'Article ID is required'),
  headline: z.string().min(1, 'Headline is required').max(500, 'Headline too long'),
  content: z.string().min(1, 'Content is required'),
  source: z.string().min(1, 'Source is required'),
  category: z.string().min(1, 'Category is required'),
  publishedAt: z.date(),
  url: z.string().url('Invalid URL format'),
  tags: z.array(z.string()).default([]),
});

export interface NewsArticle {
  id: string;
  headline: string;
  content: string;
  source: string;
  category: string;
  publishedAt: Date;
  url: string;
  tags: string[];
  region?: string; // For India-specific regional classification
  language?: string; // Language of the article
}

export const ChunkMetadataSchema = z.object({
  source: z.string().min(1, 'Source is required'),
  category: z.string().min(1, 'Category is required'),
  publishedAt: z.date(),
  chunkIndex: z.number().int().min(0, 'Chunk index must be non-negative'),
  wordCount: z.number().int().min(0, 'Word count must be non-negative'),
});

export const TextChunkSchema = z.object({
  id: z.string().min(1, 'Chunk ID is required'),
  articleId: z.string().min(1, 'Article ID is required'),
  content: z.string().min(1, 'Content is required'),
  embedding: z.array(z.number()).min(1, 'Embedding vector cannot be empty'),
  metadata: ChunkMetadataSchema,
});

export interface TextChunk {
  id: string;
  articleId: string;
  content: string;
  embedding: number[];
  metadata: ChunkMetadata;
}

export interface ChunkMetadata {
  source: string;
  category: string;
  publishedAt: Date;
  chunkIndex: number;
  wordCount: number;
}

export const UserPreferencesSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  topics: z.array(z.string()).default([]),
  tone: z.enum(['formal', 'casual', 'fun']).default('casual'),
  readingTime: z.number().int().min(1, 'Reading time must be at least 1 minute').max(15, 'Reading time cannot exceed 15 minutes').default(5),
  preferredSources: z.array(z.string()).default([]),
  excludedSources: z.array(z.string()).default([]),
  lastUpdated: z.date().default(() => new Date()),
  createdAt: z.date().optional(), // Added
  updatedAt: z.date().optional(), // Added
});

export const UserInteractionSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  articleId: z.string().min(1, 'Article ID is required'),
  action: z.enum(['read_more', 'hide', 'like', 'share']),
  timestamp: z.date().default(() => new Date()),
});

export interface UserPreferences {
  userId: string;
  topics: string[];
  tone: 'formal' | 'casual' | 'fun';
  readingTime: number;
  preferredSources: string[];
  excludedSources: string[];
  lastUpdated: Date;
  createdAt?: Date; // Added
  updatedAt?: Date; // Added
}

export interface UserInteraction {
  userId: string;
  articleId: string;
  action: 'read_more' | 'hide' | 'like' | 'share';
  timestamp: Date;
}

export const SummarySchema = z.object({
  id: z.string().min(1, 'Summary ID is required'),
  content: z.string().min(1, 'Summary content is required'),
  keyPoints: z.array(z.string()).default([]),
  sourceArticles: z.array(z.string()).min(1, 'At least one source article is required'),
  estimatedReadingTime: z.number().int().min(1, 'Reading time must be at least 1 minute'),
  tone: z.enum(['formal', 'casual', 'fun']),
});

export interface Summary {
  id: string;
  content: string;
  keyPoints: string[];
  sourceArticles: string[];
  estimatedReadingTime: number;
  tone: string;
}

export const DateRangeSchema = z.object({
  start: z.date(),
  end: z.date(),
}).refine(data => data.start <= data.end, {
  message: 'Start date must be before or equal to end date',
});

export const SearchFiltersSchema = z.object({
  categories: z.array(z.string()).optional(),
  sources: z.array(z.string()).optional(),
  dateRange: DateRangeSchema.optional(),
  minRelevanceScore: z.number().min(0).max(1).optional(),
});

export const SearchResultSchema = z.object({
  chunk: TextChunkSchema,
  relevanceScore: z.number().min(0).max(1),
});

export const SummaryRequestSchema = z.object({
  articles: z.array(NewsArticleSchema).min(1, 'At least one article is required'),
  tone: z.enum(['formal', 'casual', 'fun']),
  maxReadingTime: z.number().int().min(1).max(15),
  userId: z.string().min(1, 'User ID is required'),
});

export interface SearchFilters {
  categories?: string[];
  sources?: string[];
  dateRange?: DateRange;
  minRelevanceScore?: number;
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface SearchResult {
  chunk: TextChunk;
  relevanceScore: number;
}

export interface SummaryRequest {
  articles: NewsArticle[];
  tone: string;
  maxReadingTime: number;
  userId: string;
}

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
  fallback: z.object({
    type: z.enum(['cached_content', 'default_feed', 'excerpt']),
    data: z.unknown(),
  }).optional(),
});

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  fallback?: {
    type: 'cached_content' | 'default_feed' | 'excerpt' | 'empty_state';
    data: unknown;
    message?: string;
  };
}

export interface FallbackData {
  type: 'cached_content' | 'default_feed' | 'excerpt' | 'empty_state';
  data: unknown;
  message?: string;
}

// Utility types for API responses
export type ApiResponse<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: ErrorResponse['error'];
  fallback?: ErrorResponse['fallback'];
};

export type PaginatedResponse<T> = {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};

export type PersonalizedFeedResponse = ApiResponse<{
  summaries: Summary[];
  lastUpdated: Date;
  userPreferences: UserPreferences;
}>;

export type PreferencesResponse = ApiResponse<UserPreferences>;

export type SummaryResponse = ApiResponse<Summary>;

export type InteractionResponse = ApiResponse<{
  success: boolean;
  updatedPreferences?: Partial<UserPreferences>;
}>;

export type SourcesResponse = ApiResponse<{
  sources: Array<{
    id: string;
    name: string;
    category: string;
    isActive: boolean;
  }>;
}>;

// Type guards for runtime validation
export const isNewsArticle = (obj: unknown): obj is NewsArticle => {
  return NewsArticleSchema.safeParse(obj).success;
};

export const isUserPreferences = (obj: unknown): obj is UserPreferences => {
  return UserPreferencesSchema.safeParse(obj).success;
};

export const isUserInteraction = (obj: unknown): obj is UserInteraction => {
  return UserInteractionSchema.safeParse(obj).success;
};

export const isTextChunk = (obj: unknown): obj is TextChunk => {
  return TextChunkSchema.safeParse(obj).success;
};

export const isSummaryRequest = (obj: unknown): obj is SummaryRequest => {
  return SummaryRequestSchema.safeParse(obj).success;
};

// Validation helper functions
export const validateNewsArticle = (data: unknown) => {
  return NewsArticleSchema.parse(data);
};

export const validateUserPreferences = (data: unknown) => {
  return UserPreferencesSchema.parse(data);
};

export const validateUserInteraction = (data: unknown) => {
  return UserInteractionSchema.parse(data);
};

export const validateTextChunk = (data: unknown) => {
  return TextChunkSchema.parse(data);
};

export const validateSummaryRequest = (data: unknown) => {
  return SummaryRequestSchema.parse(data);
};