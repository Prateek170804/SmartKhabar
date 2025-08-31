import { createClient } from '@supabase/supabase-js';
import { config } from './config';

// Create Supabase client
export const supabase = createClient(
  config.supabase.url,
  config.supabase.anonKey
);

// Database table names
export const TABLES = {
  USER_PREFERENCES: 'user_preferences',
  USER_INTERACTIONS: 'user_interactions',
  ARTICLES: 'articles',
  ARTICLE_CHUNKS: 'article_chunks',
} as const;