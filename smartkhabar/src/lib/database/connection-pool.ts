/**
 * Database connection pooling for production optimization
 * Manages Supabase client instances and connection reuse
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '@/lib/config';

export interface ConnectionPoolConfig {
  maxConnections: number;
  idleTimeout: number; // milliseconds
  connectionTimeout: number; // milliseconds
  retryAttempts: number;
  retryDelay: number; // milliseconds
}

export interface PooledConnection {
  client: SupabaseClient;
  lastUsed: number;
  inUse: boolean;
  id: string;
}

export class DatabaseConnectionPool {
  private connections: Map<string, PooledConnection> = new Map();
  private waitingQueue: Array<{
    resolve: (client: SupabaseClient) => void;
    reject: (error: Error) => void;
    timestamp: number;
  }> = [];
  
  private cleanupTimer?: NodeJS.Timeout;
  
  constructor(private config: ConnectionPoolConfig) {
    this.startCleanup();
  }
  
  /**
   * Get a database connection from the pool
   */
  async getConnection(): Promise<SupabaseClient> {
    // Try to find an available connection
    const availableConnection = this.findAvailableConnection();
    if (availableConnection) {
      availableConnection.inUse = true;
      availableConnection.lastUsed = Date.now();
      return availableConnection.client;
    }
    
    // Create new connection if under limit
    if (this.connections.size < this.config.maxConnections) {
      const connection = this.createConnection();
      connection.inUse = true;
      return connection.client;
    }
    
    // Wait for available connection
    return this.waitForConnection();
  }
  
  /**
   * Release a connection back to the pool
   */
  releaseConnection(client: SupabaseClient): void {
    for (const connection of this.connections.values()) {
      if (connection.client === client) {
        connection.inUse = false;
        connection.lastUsed = Date.now();
        
        // Process waiting queue
        this.processWaitingQueue();
        break;
      }
    }
  }
  
  /**
   * Execute a query with automatic connection management
   */
  async withConnection<T>(
    operation: (client: SupabaseClient) => Promise<T>
  ): Promise<T> {
    const client = await this.getConnection();
    
    try {
      const result = await operation(client);
      return result;
    } finally {
      this.releaseConnection(client);
    }
  }
  
  /**
   * Get pool statistics
   */
  getStats() {
    const now = Date.now();
    let activeConnections = 0;
    let idleConnections = 0;
    
    for (const connection of this.connections.values()) {
      if (connection.inUse) {
        activeConnections++;
      } else {
        idleConnections++;
      }
    }
    
    return {
      totalConnections: this.connections.size,
      activeConnections,
      idleConnections,
      waitingRequests: this.waitingQueue.length,
      maxConnections: this.config.maxConnections,
      utilizationPercent: (this.connections.size / this.config.maxConnections) * 100
    };
  }
  
  /**
   * Close all connections and cleanup
   */
  async destroy(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    // Reject all waiting requests
    this.waitingQueue.forEach(({ reject }) => {
      reject(new Error('Connection pool is being destroyed'));
    });
    this.waitingQueue = [];
    
    // Close all connections
    this.connections.clear();
  }
  
  /**
   * Find an available connection
   */
  private findAvailableConnection(): PooledConnection | null {
    for (const connection of this.connections.values()) {
      if (!connection.inUse) {
        return connection;
      }
    }
    return null;
  }
  
  /**
   * Create a new connection
   */
  private createConnection(): PooledConnection {
    const client = createClient(config.supabase.url, config.supabase.anonKey, {
      auth: {
        persistSession: false // Disable session persistence for server-side
      },
      db: {
        schema: 'public'
      },
      global: {
        headers: {
          'x-connection-pool': 'true'
        }
      }
    });
    
    const connection: PooledConnection = {
      client,
      lastUsed: Date.now(),
      inUse: false,
      id: Math.random().toString(36).substring(7)
    };
    
    this.connections.set(connection.id, connection);
    return connection;
  }
  
  /**
   * Wait for an available connection
   */
  private waitForConnection(): Promise<SupabaseClient> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        // Remove from queue
        const index = this.waitingQueue.findIndex(item => item.resolve === resolve);
        if (index !== -1) {
          this.waitingQueue.splice(index, 1);
        }
        reject(new Error('Connection timeout'));
      }, this.config.connectionTimeout);
      
      this.waitingQueue.push({
        resolve: (client) => {
          clearTimeout(timeout);
          resolve(client);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
        timestamp: Date.now()
      });
    });
  }
  
  /**
   * Process waiting queue when connections become available
   */
  private processWaitingQueue(): void {
    if (this.waitingQueue.length === 0) {
      return;
    }
    
    const availableConnection = this.findAvailableConnection();
    if (availableConnection) {
      const waiting = this.waitingQueue.shift();
      if (waiting) {
        availableConnection.inUse = true;
        availableConnection.lastUsed = Date.now();
        waiting.resolve(availableConnection.client);
      }
    }
  }
  
  /**
   * Cleanup idle connections
   */
  private cleanup(): void {
    const now = Date.now();
    const connectionsToRemove: string[] = [];
    
    for (const [id, connection] of this.connections.entries()) {
      // Remove idle connections that have exceeded timeout
      if (!connection.inUse && 
          now - connection.lastUsed > this.config.idleTimeout) {
        connectionsToRemove.push(id);
      }
    }
    
    connectionsToRemove.forEach(id => {
      this.connections.delete(id);
    });
  }
  
  /**
   * Start periodic cleanup
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.idleTimeout / 2);
  }
}

// Default connection pool configuration
export const DEFAULT_POOL_CONFIG: ConnectionPoolConfig = {
  maxConnections: 10,
  idleTimeout: 5 * 60 * 1000, // 5 minutes
  connectionTimeout: 10 * 1000, // 10 seconds
  retryAttempts: 3,
  retryDelay: 1000 // 1 second
};

// Global connection pool instance
let globalPool: DatabaseConnectionPool | null = null;

/**
 * Get or create global connection pool
 */
export function getConnectionPool(config?: Partial<ConnectionPoolConfig>): DatabaseConnectionPool {
  if (!globalPool) {
    globalPool = new DatabaseConnectionPool({
      ...DEFAULT_POOL_CONFIG,
      ...config
    });
  }
  return globalPool;
}

/**
 * Execute database operation with connection pooling
 */
export async function withPooledConnection<T>(
  operation: (client: SupabaseClient) => Promise<T>
): Promise<T> {
  const pool = getConnectionPool();
  return pool.withConnection(operation);
}

/**
 * Database operation decorator with connection pooling
 */
export function pooled() {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      return withPooledConnection(async (client) => {
        // Replace the default client with pooled client
        const originalClient = (this as any).client;
        (this as any).client = client;
        
        try {
          return await originalMethod.apply(this, args);
        } finally {
          (this as any).client = originalClient;
        }
      });
    };
    
    return descriptor;
  };
}