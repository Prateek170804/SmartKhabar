// Application configuration
export const config = {
  // Primary Database (Neon)
  database: {
    url: process.env.DATABASE_URL || '',
  },
  
  // Primary APIs (Free)
  newsdata: {
    apiKey: process.env.NEWSDATA_API_KEY || '',
    baseUrl: 'https://newsdata.io/api/1',
  },
  
  gnews: {
    apiKey: process.env.GNEWS_API_KEY || '',
    baseUrl: 'https://gnews.io/api/v4',
  },
  
  huggingface: {
    apiKey: process.env.HUGGINGFACE_API_KEY || '',
    baseUrl: 'https://api-inference.huggingface.co',
  },
  
  // Legacy Database (Fallback)
  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
  },
  
  // Legacy APIs (Fallback)
  newsApi: {
    key: process.env.NEWS_API_KEY || '',
    baseUrl: 'https://newsapi.org/v2',
  },
  
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
  },
  
  firecrawl: {
    apiKey: process.env.FIRECRAWL_API_KEY || '',
    baseUrl: 'https://api.firecrawl.dev',
  },
  
  // Application settings
  app: {
    url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    environment: process.env.NODE_ENV || 'development',
  },
  
  // News sources configuration
  newsSources: {
    cnn: 'cnn',
    bbc: 'bbc-news',
    techcrunch: 'techcrunch',
    hackerNews: 'https://news.ycombinator.com',
  },
  
  // Default user preferences
  defaultPreferences: {
    topics: ['general'] as string[],
    tone: 'casual' as const,
    readingTime: 5,
    preferredSources: ['bbc-news', 'techcrunch'] as string[],
    excludedSources: [] as string[],
  },
  
  // Vector search settings
  vectorSearch: {
    dimensions: 384, // sentence-transformers/all-MiniLM-L6-v2
    maxResults: 10,
    minRelevanceScore: 0.7,
  },
  
  // Performance settings
  performance: {
    maxConcurrentUsers: 100,
    responseTimeoutMs: 3000,
    chunkSize: 1000,
    maxChunksPerArticle: 10,
  },
} as const;