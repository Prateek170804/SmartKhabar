import '@testing-library/jest-dom';

// Mock environment variables for testing
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.NEWS_API_KEY = 'test-news-api-key';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.FIRECRAWL_API_KEY = 'test-firecrawl-key';