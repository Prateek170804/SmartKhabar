# SmartKhabar Code Implementation Guide

## Project Structure and Implementation Details

### Core Architecture Implementation

#### 1. Database Layer Implementation
```typescript
// src/lib/database/index.ts
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';

export class DatabaseManager {
  private pool: Pool;
  private db: ReturnType<typeof drizzle>;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    
    this.db = drizzle(this.pool);
  }

  async executeQuery<T>(query: string, params?: any[]): Promise<T[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(query, params);
      return result.rows;
    } finally {
      client.release();
    }
  }
}
```

#### 2. News Collection Service
```typescript
// src/lib/news-collection/news-collector.ts
export class NewsCollector {
  private sources: NewsSource[];
  private rateLimiter: RateLimiter;
  private deduplicator: ArticleDeduplicator;

  async collectFromAllSources(): Promise<Article[]> {
    const collectionPromises = this.sources.map(async (source) => {
      try {
        await this.rateLimiter.waitForToken(source.name);
        return await this.collectFromSource(source);
      } catch (error) {
        console.error(`Failed to collect from ${source.name}:`, error);
        return [];
      }
    });

    const results = await Promise.allSettled(collectionPromises);
    const articles = results
      .filter((result): result is PromiseFulfilledResult<Article[]> => 
        result.status === 'fulfilled')
      .flatMap(result => result.value);

    return this.deduplicator.removeDuplicates(articles);
  }

  private async collectFromSource(source: NewsSource): Promise<Article[]> {
    switch (source.type) {
      case 'newsapi':
        return this.newsApiClient.fetchArticles(source.config);
      case 'newsdata':
        return this.newsDataClient.fetchArticles(source.config);
      case 'gnews':
        return this.gNewsClient.fetchArticles(source.config);
      default:
        throw new Error(`Unsupported source type: ${source.type}`);
    }
  }
}
```

#### 3. Personalization Engine Implementation
```typescript
// src/lib/personalization/index.ts
export class PersonalizationEngine {
  private interactionLearner: InteractionLearner;
  private semanticSearch: SemanticSearch;
  private preferenceConverter: PreferenceQueryConverter;

  async getPersonalizedFeed(
    userId: string, 
    preferences: UserPreferences
  ): Promise<Article[]> {
    // Get user interaction history
    const interactions = await this.getUserInteractions(userId);
    
    // Learn from interactions
    const learnedPreferences = await this.interactionLearner
      .updatePreferences(userId, interactions);
    
    // Combine explicit and learned preferences
    const combinedPreferences = this.combinePreferences(
      preferences, 
      learnedPreferences
    );
    
    // Convert to search query
    const searchQuery = this.preferenceConverter
      .convertToQuery(combinedPreferences);
    
    // Perform semantic search
    const candidates = await this.semanticSearch
      .findRelevantArticles(searchQuery);
    
    // Rank and filter results
    return this.rankArticles(candidates, combinedPreferences);
  }

  private async rankArticles(
    articles: Article[], 
    preferences: CombinedPreferences
  ): Promise<Article[]> {
    const scoredArticles = await Promise.all(
      articles.map(async (article) => {
        const score = await this.calculateRelevanceScore(article, preferences);
        return { article, score };
      })
    );

    return scoredArticles
      .sort((a, b) => b.score - a.score)
      .map(({ article }) => article);
  }
}
```

#### 4. Real-time WebSocket Implementation
```typescript
// src/lib/realtime/websocket-manager.ts
export class WebSocketManager {
  private connections: Map<string, WebSocket> = new Map();
  private newsStream: EventEmitter;

  constructor() {
    this.newsStream = new EventEmitter();
    this.setupNewsStreamHandlers();
  }

  handleConnection(ws: WebSocket, userId: string): void {
    this.connections.set(userId, ws);
    
    ws.on('message', (message) => {
      this.handleMessage(userId, JSON.parse(message.toString()));
    });
    
    ws.on('close', () => {
      this.connections.delete(userId);
    });
    
    // Send initial data
    this.sendPersonalizedUpdates(userId);
  }

  broadcastBreakingNews(article: Article): void {
    const message = {
      type: 'breaking_news',
      data: article,
      timestamp: new Date().toISOString()
    };

    this.connections.forEach((ws, userId) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    });
  }

  private async sendPersonalizedUpdates(userId: string): Promise<void> {
    const preferences = await this.getUserPreferences(userId);
    const relevantArticles = await this.getRelevantArticles(preferences);
    
    const ws = this.connections.get(userId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'personalized_update',
        data: relevantArticles
      }));
    }
  }
}
```

### API Implementation Patterns

#### 1. Error Handling Middleware
```typescript
// src/lib/error-handling/middleware.ts
export function withErrorHandling<T extends any[], R>(
  handler: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R> => {
    try {
      return await handler(...args);
    } catch (error) {
      console.error('API Error:', error);
      
      if (error instanceof ValidationError) {
        throw new APIError('Invalid input', 400, error.details);
      }
      
      if (error instanceof DatabaseError) {
        throw new APIError('Database operation failed', 500);
      }
      
      if (error instanceof ExternalAPIError) {
        throw new APIError('External service unavailable', 503);
      }
      
      throw new APIError('Internal server error', 500);
    }
  };
}
```

#### 2. API Route Implementation Pattern
```typescript
// src/app/api/news/personalized/route.ts
import { withErrorHandling } from '@/lib/error-handling/middleware';
import { validateRequest } from '@/lib/validation';
import { PersonalizationEngine } from '@/lib/personalization';

const personalizationEngine = new PersonalizationEngine();

export const GET = withErrorHandling(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const limit = parseInt(searchParams.get('limit') || '20');
  
  // Validate input
  const validation = validateRequest({ userId, limit });
  if (!validation.success) {
    return Response.json(
      { error: 'Invalid parameters', details: validation.errors },
      { status: 400 }
    );
  }
  
  // Get user preferences
  const preferences = await getUserPreferences(userId);
  
  // Get personalized feed
  const articles = await personalizationEngine.getPersonalizedFeed(
    userId, 
    preferences
  );
  
  return Response.json({
    articles: articles.slice(0, limit),
    total: articles.length,
    timestamp: new Date().toISOString()
  });
});
```

### Component Implementation

#### 1. News Feed Component
```typescript
// src/components/NewsFeed.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';

interface NewsFeedProps {
  userId?: string;
  category?: string;
  personalized?: boolean;
}

export function NewsFeed({ userId, category, personalized }: NewsFeedProps) {
  const [articles, setArticles] = useState<Article[]>([]);
  
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error
  } = useInfiniteQuery({
    queryKey: ['news', userId, category, personalized],
    queryFn: ({ pageParam = 0 }) => fetchArticles({
      userId,
      category,
      personalized,
      offset: pageParam,
      limit: 20
    }),
    getNextPageParam: (lastPage, pages) => {
      return lastPage.hasMore ? pages.length * 20 : undefined;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Real-time updates via WebSocket
  useEffect(() => {
    if (!userId) return;

    const ws = new WebSocket(`${process.env.NEXT_PUBLIC_WS_URL}/ws`);
    
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === 'breaking_news') {
        setArticles(prev => [message.data, ...prev]);
      }
    };

    return () => ws.close();
  }, [userId]);

  if (isLoading) return <NewsFeedSkeleton />;
  if (error) return <ErrorMessage error={error} />;

  const allArticles = data?.pages.flatMap(page => page.articles) || [];

  return (
    <div className="news-feed">
      {allArticles.map((article) => (
        <ArticleCard 
          key={article.id} 
          article={article}
          onInteraction={(type) => trackInteraction(userId, article.id, type)}
        />
      ))}
      
      {hasNextPage && (
        <LoadMoreButton 
          onClick={handleLoadMore}
          loading={isFetchingNextPage}
        />
      )}
    </div>
  );
}
```

#### 2. User Preferences Component
```typescript
// src/components/UserPreferences.tsx
'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function UserPreferences({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  
  const { data: preferences, isLoading } = useQuery({
    queryKey: ['preferences', userId],
    queryFn: () => fetchUserPreferences(userId),
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: (newPreferences: UserPreferences) => 
      updateUserPreferences(userId, newPreferences),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preferences', userId] });
      queryClient.invalidateQueries({ queryKey: ['news', userId] });
    },
  });

  const handlePreferenceChange = (key: string, value: any) => {
    const updatedPreferences = {
      ...preferences,
      [key]: value
    };
    
    updatePreferencesMutation.mutate(updatedPreferences);
  };

  if (isLoading) return <PreferencesSkeleton />;

  return (
    <div className="preferences-panel">
      <CategorySelector
        selected={preferences?.categories || []}
        onChange={(categories) => handlePreferenceChange('categories', categories)}
      />
      
      <LanguageSelector
        selected={preferences?.language || 'en'}
        onChange={(language) => handlePreferenceChange('language', language)}
      />
      
      <ReadingTimeSlider
        value={preferences?.maxReadingTime || 5}
        onChange={(time) => handlePreferenceChange('maxReadingTime', time)}
      />
      
      <ToneSelector
        selected={preferences?.preferredTone || 'neutral'}
        onChange={(tone) => handlePreferenceChange('preferredTone', tone)}
      />
    </div>
  );
}
```

### Testing Implementation

#### 1. Unit Test Example
```typescript
// src/lib/personalization/__tests__/interaction-learner.test.ts
import { InteractionLearner } from '../interaction-learner';
import { mockUserInteractions } from '../../__mocks__/interactions';

describe('InteractionLearner', () => {
  let learner: InteractionLearner;

  beforeEach(() => {
    learner = new InteractionLearner();
  });

  describe('updatePreferences', () => {
    it('should learn from positive interactions', async () => {
      const userId = 'user-123';
      const interactions = mockUserInteractions.positive;

      const preferences = await learner.updatePreferences(userId, interactions);

      expect(preferences.categories).toContain('technology');
      expect(preferences.topics).toContain('artificial intelligence');
      expect(preferences.confidence).toBeGreaterThan(0.7);
    });

    it('should handle negative interactions', async () => {
      const userId = 'user-123';
      const interactions = mockUserInteractions.negative;

      const preferences = await learner.updatePreferences(userId, interactions);

      expect(preferences.categories).not.toContain('sports');
      expect(preferences.confidence).toBeLessThan(0.3);
    });
  });
});
```

#### 2. Integration Test Example
```typescript
// src/app/api/news/personalized/__tests__/route.test.ts
import { GET } from '../route';
import { createMockRequest } from '../../../../__mocks__/request';

describe('/api/news/personalized', () => {
  it('should return personalized articles', async () => {
    const request = createMockRequest({
      searchParams: { userId: 'user-123', limit: '10' }
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.articles).toHaveLength(10);
    expect(data.articles[0]).toHaveProperty('id');
    expect(data.articles[0]).toHaveProperty('title');
    expect(data.articles[0]).toHaveProperty('relevanceScore');
  });

  it('should handle invalid user ID', async () => {
    const request = createMockRequest({
      searchParams: { userId: '', limit: '10' }
    });

    const response = await GET(request);

    expect(response.status).toBe(400);
  });
});
```

### Performance Optimization Implementation

#### 1. Caching Layer
```typescript
// src/lib/cache/index.ts
export class CacheManager {
  private redis: Redis;
  private localCache: Map<string, CacheEntry>;

  async get<T>(key: string): Promise<T | null> {
    // Try local cache first
    const localEntry = this.localCache.get(key);
    if (localEntry && !this.isExpired(localEntry)) {
      return localEntry.value;
    }

    // Try Redis cache
    const redisValue = await this.redis.get(key);
    if (redisValue) {
      const parsed = JSON.parse(redisValue);
      this.localCache.set(key, {
        value: parsed,
        timestamp: Date.now(),
        ttl: 300000 // 5 minutes
      });
      return parsed;
    }

    return null;
  }

  async set<T>(key: string, value: T, ttl: number = 300000): Promise<void> {
    // Set in both caches
    this.localCache.set(key, {
      value,
      timestamp: Date.now(),
      ttl
    });

    await this.redis.setex(key, Math.floor(ttl / 1000), JSON.stringify(value));
  }
}
```

#### 2. Database Connection Pooling
```typescript
// src/lib/database/connection-pool.ts
export class ConnectionPool {
  private pool: Pool;
  private metrics: PoolMetrics;

  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      max: 20, // Maximum number of connections
      min: 5,  // Minimum number of connections
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      acquireTimeoutMillis: 60000,
    });

    this.setupMetrics();
  }

  async query<T>(text: string, params?: any[]): Promise<QueryResult<T>> {
    const start = Date.now();
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(text, params);
      this.metrics.recordQuery(Date.now() - start);
      return result;
    } finally {
      client.release();
    }
  }

  getMetrics(): PoolMetrics {
    return {
      ...this.metrics,
      totalConnections: this.pool.totalCount,
      idleConnections: this.pool.idleCount,
      waitingClients: this.pool.waitingCount
    };
  }
}
```

This implementation guide provides the foundation for building a scalable, performant news aggregation platform with advanced personalization features.