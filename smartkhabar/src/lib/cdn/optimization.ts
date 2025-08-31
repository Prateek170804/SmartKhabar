/**
 * CDN and static asset optimization utilities
 * Handles asset optimization, caching headers, and performance improvements
 */

export interface AssetOptimizationConfig {
  enableCompression: boolean;
  enableCaching: boolean;
  maxAge: number;
  staleWhileRevalidate: number;
  enableImageOptimization: boolean;
  enablePreloading: boolean;
}

export interface CacheHeaders {
  'Cache-Control': string;
  'CDN-Cache-Control'?: string;
  'Vercel-CDN-Cache-Control'?: string;
  'Vary'?: string;
  'ETag'?: string;
}

export class CDNOptimizer {
  constructor(private config: AssetOptimizationConfig) {}
  
  /**
   * Get cache headers for different asset types
   */
  getCacheHeaders(assetType: 'static' | 'api' | 'dynamic' | 'image'): CacheHeaders {
    switch (assetType) {
      case 'static':
        return {
          'Cache-Control': `public, max-age=${this.config.maxAge}, s-maxage=${this.config.maxAge}`,
          'CDN-Cache-Control': `max-age=${this.config.maxAge}`,
          'Vercel-CDN-Cache-Control': `max-age=${this.config.maxAge}`
        };
      
      case 'api':
        return {
          'Cache-Control': `public, max-age=60, s-maxage=${this.config.staleWhileRevalidate}, stale-while-revalidate=${this.config.staleWhileRevalidate}`,
          'Vary': 'Accept-Encoding, Authorization'
        };
      
      case 'dynamic':
        return {
          'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300',
          'Vary': 'Accept-Encoding, Cookie'
        };
      
      case 'image':
        return {
          'Cache-Control': `public, max-age=${this.config.maxAge}, s-maxage=${this.config.maxAge}, immutable`,
          'CDN-Cache-Control': `max-age=${this.config.maxAge}`
        };
      
      default:
        return {
          'Cache-Control': 'public, max-age=3600, s-maxage=3600'
        };
    }
  }
  
  /**
   * Generate optimized image URLs for Next.js Image component
   */
  getOptimizedImageUrl(
    src: string,
    width: number,
    height?: number,
    quality: number = 75
  ): string {
    if (!this.config.enableImageOptimization) {
      return src;
    }
    
    // For external images, use Next.js image optimization
    if (src.startsWith('http')) {
      const params = new URLSearchParams({
        url: src,
        w: width.toString(),
        q: quality.toString()
      });
      
      if (height) {
        params.set('h', height.toString());
      }
      
      return `/_next/image?${params.toString()}`;
    }
    
    return src;
  }
  
  /**
   * Generate preload links for critical resources
   */
  generatePreloadLinks(resources: Array<{
    href: string;
    as: 'script' | 'style' | 'font' | 'image';
    type?: string;
    crossorigin?: boolean;
  }>): string[] {
    if (!this.config.enablePreloading) {
      return [];
    }
    
    return resources.map(resource => {
      let link = `<${resource.href}>; rel=preload; as=${resource.as}`;
      
      if (resource.type) {
        link += `; type=${resource.type}`;
      }
      
      if (resource.crossorigin) {
        link += '; crossorigin';
      }
      
      return link;
    });
  }
  
  /**
   * Get compression headers
   */
  getCompressionHeaders(): Record<string, string> {
    if (!this.config.enableCompression) {
      return {};
    }
    
    return {
      'Content-Encoding': 'gzip',
      'Vary': 'Accept-Encoding'
    };
  }
  
  /**
   * Generate ETag for content
   */
  generateETag(content: string): string {
    // Simple hash-based ETag
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `"${Math.abs(hash).toString(16)}"`;
  }
  
  /**
   * Check if content should be cached based on request
   */
  shouldCache(request: {
    method: string;
    headers: Record<string, string>;
    url: string;
  }): boolean {
    // Don't cache non-GET requests
    if (request.method !== 'GET') {
      return false;
    }
    
    // Don't cache requests with authorization
    if (request.headers.authorization) {
      return false;
    }
    
    // Don't cache requests with cache-control: no-cache
    const cacheControl = request.headers['cache-control'];
    if (cacheControl && cacheControl.includes('no-cache')) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Get optimal cache strategy for different content types
   */
  getCacheStrategy(contentType: string): {
    maxAge: number;
    sMaxAge: number;
    staleWhileRevalidate: number;
    mustRevalidate: boolean;
  } {
    // Static assets (CSS, JS, images)
    if (contentType.includes('css') || 
        contentType.includes('javascript') || 
        contentType.includes('image/')) {
      return {
        maxAge: 31536000, // 1 year
        sMaxAge: 31536000,
        staleWhileRevalidate: 86400, // 1 day
        mustRevalidate: false
      };
    }
    
    // API responses
    if (contentType.includes('json')) {
      return {
        maxAge: 60, // 1 minute
        sMaxAge: 300, // 5 minutes
        staleWhileRevalidate: 3600, // 1 hour
        mustRevalidate: false
      };
    }
    
    // HTML pages
    if (contentType.includes('html')) {
      return {
        maxAge: 0,
        sMaxAge: 60, // 1 minute
        staleWhileRevalidate: 300, // 5 minutes
        mustRevalidate: true
      };
    }
    
    // Default strategy
    return {
      maxAge: 3600, // 1 hour
      sMaxAge: 3600,
      staleWhileRevalidate: 7200, // 2 hours
      mustRevalidate: false
    };
  }
}

// Default CDN configuration
export const DEFAULT_CDN_CONFIG: AssetOptimizationConfig = {
  enableCompression: true,
  enableCaching: true,
  maxAge: 31536000, // 1 year for static assets
  staleWhileRevalidate: 86400, // 1 day
  enableImageOptimization: true,
  enablePreloading: true
};

// Global CDN optimizer instance
let globalOptimizer: CDNOptimizer | null = null;

/**
 * Get or create global CDN optimizer
 */
export function getCDNOptimizer(config?: Partial<AssetOptimizationConfig>): CDNOptimizer {
  if (!globalOptimizer) {
    globalOptimizer = new CDNOptimizer({
      ...DEFAULT_CDN_CONFIG,
      ...config
    });
  }
  return globalOptimizer;
}

/**
 * Middleware to add cache headers to responses
 */
export function withCacheHeaders(
  assetType: 'static' | 'api' | 'dynamic' | 'image' = 'api'
) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const result = await originalMethod.apply(this, args);
      
      // If result is a Response object, add cache headers
      if (result && typeof result === 'object' && result.headers) {
        const optimizer = getCDNOptimizer();
        const cacheHeaders = optimizer.getCacheHeaders(assetType);
        
        Object.entries(cacheHeaders).forEach(([key, value]) => {
          if (value) {
            result.headers.set(key, value);
          }
        });
      }
      
      return result;
    };
    
    return descriptor;
  };
}

/**
 * Performance optimization utilities
 */
export const PerformanceUtils = {
  /**
   * Compress response data
   */
  compressResponse: (data: string): string => {
    // In a real implementation, you'd use gzip compression
    // For now, just return the data as-is since Vercel handles compression
    return data;
  },
  
  /**
   * Minify JSON response
   */
  minifyJSON: (obj: any): string => {
    return JSON.stringify(obj);
  },
  
  /**
   * Generate resource hints for critical resources
   */
  generateResourceHints: (resources: string[]): string => {
    return resources
      .map(resource => `<link rel="preload" href="${resource}" as="script">`)
      .join('\n');
  },
  
  /**
   * Calculate content hash for cache busting
   */
  calculateContentHash: (content: string): string => {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
};