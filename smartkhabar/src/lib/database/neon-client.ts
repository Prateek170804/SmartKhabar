/**
 * Neon Database Client
 * Free PostgreSQL database integration using pg client
 */

import { Client, Pool } from 'pg';
import { config } from '@/lib/config';

export interface DatabaseConfig {
  connectionString: string;
  maxConnections: number;
  idleTimeout: number;
}

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

export class NeonClient {
  private config: DatabaseConfig;
  private pool: Pool | null = null;

  constructor(dbConfig?: Partial<DatabaseConfig>) {
    this.config = {
      connectionString: config.database?.url || process.env.DATABASE_URL || '',
      maxConnections: 10,
      idleTimeout: 30000,
      ...dbConfig
    };

    if (!this.config.connectionString) {
      throw new Error('Database connection string is required');
    }
  }

  /**
   * Get or create connection pool
   */
  private getPool(): Pool {
    if (!this.pool) {
      this.pool = new Pool({
        connectionString: this.config.connectionString,
        max: this.config.maxConnections,
        idleTimeoutMillis: this.config.idleTimeout
      });
    }
    return this.pool;
  }

  /**
   * Execute a query using PostgreSQL client
   */
  async query<T = any>(sql: string, params: any[] = []): Promise<QueryResult<T>> {
    const pool = this.getPool();
    
    try {
      const result = await pool.query(sql, params);
      return {
        rows: result.rows as T[],
        rowCount: result.rowCount || 0
      };
    } catch (error) {
      throw new Error(`Database query failed: ${(error as Error).message}`);
    }
  }

  /**
   * Initialize database tables
   */
  async initializeTables(): Promise<void> {
    const tables = [
      // Articles table
      `CREATE TABLE IF NOT EXISTS articles (
        id VARCHAR(255) PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        content TEXT,
        url TEXT UNIQUE NOT NULL,
        image_url TEXT,
        published_at TIMESTAMP,
        source VARCHAR(255),
        source_url TEXT,
        author VARCHAR(255),
        category VARCHAR(100),
        language VARCHAR(10) DEFAULT 'en',
        country VARCHAR(10) DEFAULT 'us',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // User preferences table
      `CREATE TABLE IF NOT EXISTS user_preferences (
        user_id VARCHAR(255) PRIMARY KEY,
        topics TEXT[], -- Array of topics
        tone VARCHAR(50) DEFAULT 'casual',
        reading_time INTEGER DEFAULT 5,
        preferred_sources TEXT[],
        excluded_sources TEXT[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // User interactions table
      `CREATE TABLE IF NOT EXISTS user_interactions (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255),
        article_id VARCHAR(255),
        interaction_type VARCHAR(50), -- 'view', 'like', 'share', 'save'
        interaction_data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (article_id) REFERENCES articles(id)
      )`,

      // Article embeddings table (simplified for free tier)
      `CREATE TABLE IF NOT EXISTS article_embeddings (
        article_id VARCHAR(255) PRIMARY KEY,
        embedding_data TEXT, -- Store as JSON string for free tier compatibility
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (article_id) REFERENCES articles(id)
      )`,

      // News collection status table
      `CREATE TABLE IF NOT EXISTS collection_status (
        id SERIAL PRIMARY KEY,
        source VARCHAR(100),
        status VARCHAR(50),
        articles_collected INTEGER DEFAULT 0,
        errors TEXT[],
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    for (const table of tables) {
      try {
        await this.query(table);
        console.log('Table created/verified successfully');
      } catch (error) {
        console.error('Failed to create table:', error);
      }
    }
  }

  /**
   * Save articles to database
   */
  async saveArticles(articles: any[]): Promise<void> {
    if (articles.length === 0) return;

    const sql = `
      INSERT INTO articles (
        id, title, description, content, url, image_url, 
        published_at, source, source_url, author, category, language, country
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (url) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        content = EXCLUDED.content,
        updated_at = CURRENT_TIMESTAMP
    `;

    for (const article of articles) {
      try {
        await this.query(sql, [
          article.id,
          article.title,
          article.description,
          article.content,
          article.url,
          article.imageUrl,
          article.publishedAt,
          article.source,
          article.sourceUrl,
          article.author,
          article.category,
          article.language,
          article.country
        ]);
      } catch (error) {
        console.error('Failed to save article:', article.title, error);
      }
    }
  }

  /**
   * Get articles with pagination
   */
  async getArticles(limit: number = 20, offset: number = 0): Promise<any[]> {
    const sql = `
      SELECT * FROM articles 
      ORDER BY published_at DESC 
      LIMIT $1 OFFSET $2
    `;
    
    const result = await this.query(sql, [limit, offset]);
    return result.rows;
  }

  /**
   * Save user preferences
   */
  async saveUserPreferences(userId: string, preferences: any): Promise<void> {
    const sql = `
      INSERT INTO user_preferences (
        user_id, topics, tone, reading_time, preferred_sources, excluded_sources
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id) DO UPDATE SET
        topics = EXCLUDED.topics,
        tone = EXCLUDED.tone,
        reading_time = EXCLUDED.reading_time,
        preferred_sources = EXCLUDED.preferred_sources,
        excluded_sources = EXCLUDED.excluded_sources,
        updated_at = CURRENT_TIMESTAMP
    `;

    await this.query(sql, [
      userId,
      preferences.topics,
      preferences.tone,
      preferences.readingTime,
      preferences.preferredSources,
      preferences.excludedSources
    ]);
  }

  /**
   * Get user preferences
   */
  async getUserPreferences(userId: string): Promise<any | null> {
    const sql = 'SELECT * FROM user_preferences WHERE user_id = $1';
    const result = await this.query(sql, [userId]);
    return result.rows[0] || null;
  }

  /**
   * Record user interaction
   */
  async recordInteraction(userId: string, articleId: string, type: string, data: any = {}): Promise<void> {
    const sql = `
      INSERT INTO user_interactions (user_id, article_id, interaction_type, interaction_data)
      VALUES ($1, $2, $3, $4)
    `;

    await this.query(sql, [userId, articleId, type, JSON.stringify(data)]);
  }

  /**
   * Get database health status
   */
  async getHealthStatus(): Promise<{ status: string; details: any }> {
    try {
      const result = await this.query('SELECT NOW() as current_time');
      return {
        status: 'healthy',
        details: {
          connected: true,
          currentTime: result.rows[0]?.current_time,
          connectionString: this.config.connectionString.replace(/:[^:@]*@/, ':***@')
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          connected: false,
          error: (error as Error).message
        }
      };
    }
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}

// Global client instance
let defaultClient: NeonClient | null = null;

/**
 * Get or create default Neon client
 */
export function getNeonClient(config?: Partial<DatabaseConfig>): NeonClient {
  if (!defaultClient) {
    defaultClient = new NeonClient(config);
  }
  return defaultClient;
}

/**
 * Initialize database (convenience function)
 */
export async function initializeDatabase(): Promise<void> {
  const client = getNeonClient();
  await client.initializeTables();
}