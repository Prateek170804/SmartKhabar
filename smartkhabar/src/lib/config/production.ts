/**
 * Production configuration for SmartKhabar
 * Centralizes all production optimizations and settings
 */

import { LogLevel } from '@/lib/monitoring/production-logger';

export interface ProductionConfig {
  // Caching configuration
  cache: {
    enabled: boolean;
    maxSize: number;
    defaultTTL: number;
    cleanupInterval: number;
  };
  
  // Database connection pooling
  database: {
    pooling: {
      enabled: boolean;
      maxConnections: number;
      idleTimeout: number;
      connectionTimeout: number;
    };
  };
  
  // Logging configuration
  logging: {
    level: LogLevel;
    enableConsole: boolean;
    enableStructuredLogging: boolean;
    bufferSize: number;
    flushInterval: number;
  };
  
  // CDN and asset optimization
  cdn: {
    enableCompression: boolean;
    enableCaching: boolean;
    enableImageOptimization: boolean;
    maxAge: number;
    staleWhileRevalidate: number;
  };
  
  // Performance monitoring
  monitoring: {
    enabled: boolean;
    metricsRetention: number;
    alertThresholds: {
      responseTime: number;
      errorRate: number;
      memoryUsage: number;
    };
  };
  
  // Security settings
  security: {
    enableCORS: boolean;
    enableCSP: boolean;
    enableRateLimiting: boolean;
    rateLimitRequests: number;
    rateLimitWindow: number;
  };
}

// Production configuration
export const PRODUCTION_CONFIG: ProductionConfig = {
  cache: {
    enabled: true,
    maxSize: 100 * 1024 * 1024, // 100MB
    defaultTTL: 5 * 60 * 1000, // 5 minutes
    cleanupInterval: 60 * 1000 // 1 minute
  },
  
  database: {
    pooling: {
      enabled: true,
      maxConnections: 10,
      idleTimeout: 5 * 60 * 1000, // 5 minutes
      connectionTimeout: 10 * 1000 // 10 seconds
    }
  },
  
  logging: {
    level: LogLevel.INFO,
    enableConsole: true,
    enableStructuredLogging: true,
    bufferSize: 100,
    flushInterval: 5000 // 5 seconds
  },
  
  cdn: {
    enableCompression: true,
    enableCaching: true,
    enableImageOptimization: true,
    maxAge: 31536000, // 1 year
    staleWhileRevalidate: 86400 // 1 day
  },
  
  monitoring: {
    enabled: true,
    metricsRetention: 24 * 60 * 60 * 1000, // 24 hours
    alertThresholds: {
      responseTime: 3000, // 3 seconds
      errorRate: 0.05, // 5%
      memoryUsage: 0.8 // 80%
    }
  },
  
  security: {
    enableCORS: true,
    enableCSP: true,
    enableRateLimiting: true,
    rateLimitRequests: 100,
    rateLimitWindow: 60 * 1000 // 1 minute
  }
};

// Development configuration (less aggressive caching, more logging)
export const DEVELOPMENT_CONFIG: ProductionConfig = {
  ...PRODUCTION_CONFIG,
  
  cache: {
    ...PRODUCTION_CONFIG.cache,
    enabled: false, // Disable caching in development
    defaultTTL: 30 * 1000 // 30 seconds
  },
  
  logging: {
    ...PRODUCTION_CONFIG.logging,
    level: LogLevel.DEBUG,
    enableStructuredLogging: false,
    bufferSize: 10,
    flushInterval: 1000 // 1 second
  },
  
  cdn: {
    ...PRODUCTION_CONFIG.cdn,
    enableCaching: false,
    maxAge: 0
  },
  
  monitoring: {
    ...PRODUCTION_CONFIG.monitoring,
    alertThresholds: {
      responseTime: 5000, // 5 seconds (more lenient)
      errorRate: 0.1, // 10%
      memoryUsage: 0.9 // 90%
    }
  },
  
  security: {
    ...PRODUCTION_CONFIG.security,
    enableRateLimiting: false // Disable rate limiting in development
  }
};

/**
 * Get configuration based on environment
 */
export function getProductionConfig(): ProductionConfig {
  return process.env.NODE_ENV === 'production' 
    ? PRODUCTION_CONFIG 
    : DEVELOPMENT_CONFIG;
}

/**
 * Environment-specific feature flags
 */
export const FeatureFlags = {
  // Caching features
  ENABLE_API_CACHING: process.env.NODE_ENV === 'production',
  ENABLE_RESPONSE_COMPRESSION: process.env.NODE_ENV === 'production',
  ENABLE_IMAGE_OPTIMIZATION: true,
  
  // Database features
  ENABLE_CONNECTION_POOLING: process.env.NODE_ENV === 'production',
  ENABLE_QUERY_OPTIMIZATION: true,
  
  // Monitoring features
  ENABLE_PERFORMANCE_MONITORING: true,
  ENABLE_ERROR_TRACKING: true,
  ENABLE_ANALYTICS: process.env.NODE_ENV === 'production',
  
  // Security features
  ENABLE_RATE_LIMITING: process.env.NODE_ENV === 'production',
  ENABLE_SECURITY_HEADERS: true,
  ENABLE_CORS: true,
  
  // Development features
  ENABLE_DEBUG_LOGGING: process.env.NODE_ENV !== 'production',
  ENABLE_HOT_RELOAD: process.env.NODE_ENV === 'development',
  ENABLE_SOURCE_MAPS: process.env.NODE_ENV !== 'production'
};

/**
 * Performance thresholds for different operations
 */
export const PerformanceThresholds = {
  // API response times (milliseconds)
  API_RESPONSE_TIME: {
    FAST: 500,
    ACCEPTABLE: 1000,
    SLOW: 3000
  },
  
  // Database query times (milliseconds)
  DATABASE_QUERY_TIME: {
    FAST: 100,
    ACCEPTABLE: 500,
    SLOW: 1000
  },
  
  // External API call times (milliseconds)
  EXTERNAL_API_TIME: {
    FAST: 1000,
    ACCEPTABLE: 3000,
    SLOW: 10000
  },
  
  // Memory usage (percentage)
  MEMORY_USAGE: {
    LOW: 0.5,
    MEDIUM: 0.7,
    HIGH: 0.9
  }
};

/**
 * Cache TTL settings for different data types
 */
export const CacheTTL = {
  // User-specific data (shorter TTL)
  USER_PREFERENCES: 5 * 60 * 1000, // 5 minutes
  PERSONALIZED_NEWS: 10 * 60 * 1000, // 10 minutes
  USER_INTERACTIONS: 2 * 60 * 1000, // 2 minutes
  
  // Article data (medium TTL)
  ARTICLE_SUMMARIES: 60 * 60 * 1000, // 1 hour
  NEWS_COLLECTION: 30 * 60 * 1000, // 30 minutes
  
  // Static/semi-static data (longer TTL)
  EMBEDDINGS: 24 * 60 * 60 * 1000, // 24 hours
  SYSTEM_CONFIG: 60 * 60 * 1000, // 1 hour
  
  // Health checks and monitoring
  HEALTH_STATUS: 30 * 1000, // 30 seconds
  PERFORMANCE_METRICS: 5 * 60 * 1000 // 5 minutes
};