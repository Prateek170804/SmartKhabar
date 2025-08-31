import { NewsArticle, TextChunk } from '@/types';
import { TextCleaner, ChunkingConfig, DEFAULT_CHUNKING_CONFIG } from './text-cleaner';
import { TextChunker } from './text-chunker';

/**
 * Text processing configuration
 */
export interface TextProcessingConfig {
  chunking: ChunkingConfig;
  enableValidation: boolean;
  logProcessingMetrics: boolean;
}

/**
 * Default text processing configuration
 */
export const DEFAULT_TEXT_PROCESSING_CONFIG: TextProcessingConfig = {
  chunking: DEFAULT_CHUNKING_CONFIG,
  enableValidation: true,
  logProcessingMetrics: false,
};

/**
 * Processing metrics for monitoring and optimization
 */
export interface ProcessingMetrics {
  articleId: string;
  originalLength: number;
  cleanedLength: number;
  chunkCount: number;
  averageChunkSize: number;
  processingTimeMs: number;
  validationPassed: boolean;
  issues: string[];
}

/**
 * Main text processing service that orchestrates cleaning and chunking
 */
export class TextProcessor {
  private chunker: TextChunker;
  private config: TextProcessingConfig;

  constructor(config: TextProcessingConfig = DEFAULT_TEXT_PROCESSING_CONFIG) {
    this.config = config;
    this.chunker = new TextChunker(config.chunking);
  }

  /**
   * Process a single news article into clean, chunked text segments
   */
  async processArticle(article: NewsArticle): Promise<{
    chunks: TextChunk[];
    metrics: ProcessingMetrics;
  }> {
    const startTime = Date.now();
    
    try {
      // Validate input article
      this.validateArticle(article);
      
      const originalLength = article?.content?.length || 0;
      
      // Clean the article content
      const cleanedContent = TextCleaner.cleanText(article.content);
      const cleanedLength = cleanedContent.length;
      
      // Create article with cleaned content for chunking
      const cleanedArticle: NewsArticle = {
        ...article,
        content: cleanedContent,
      };
      
      // Chunk the cleaned article
      const chunks = this.chunker.chunkArticle(cleanedArticle);
      
      // Validate chunks if enabled
      let validationPassed = true;
      let issues: string[] = [];
      
      if (this.config.enableValidation) {
        const validation = this.chunker.validateChunks(chunks);
        validationPassed = validation.isValid;
        issues = validation.issues;
      }
      
      // Calculate metrics
      const processingTimeMs = Date.now() - startTime;
      const averageChunkSize = chunks.length > 0 
        ? Math.round(chunks.reduce((sum, chunk) => sum + chunk.content.length, 0) / chunks.length)
        : 0;
      
      const metrics: ProcessingMetrics = {
        articleId: article.id,
        originalLength,
        cleanedLength,
        chunkCount: chunks.length,
        averageChunkSize,
        processingTimeMs,
        validationPassed,
        issues,
      };
      
      // Log metrics if enabled
      if (this.config.logProcessingMetrics) {
        this.logMetrics(metrics);
      }
      
      return { chunks, metrics };
      
    } catch (error) {
      const processingTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      const metrics: ProcessingMetrics = {
        articleId: article?.id || 'unknown',
        originalLength: article?.content?.length || 0,
        cleanedLength: 0,
        chunkCount: 0,
        averageChunkSize: 0,
        processingTimeMs,
        validationPassed: false,
        issues: [`Processing failed: ${errorMessage}`],
      };
      
      throw new TextProcessingError(`Failed to process article ${article?.id || 'unknown'}: ${errorMessage}`, metrics);
    }
  }

  /**
   * Process multiple articles in batch
   */
  async processArticles(articles: NewsArticle[]): Promise<{
    results: Array<{
      articleId: string;
      chunks: TextChunk[];
      metrics: ProcessingMetrics;
    }>;
    summary: {
      totalArticles: number;
      successfullyProcessed: number;
      totalChunks: number;
      averageProcessingTime: number;
      errors: Array<{ articleId: string; error: string }>;
    };
  }> {
    const results: Array<{
      articleId: string;
      chunks: TextChunk[];
      metrics: ProcessingMetrics;
    }> = [];
    
    const errors: Array<{ articleId: string; error: string }> = [];
    let totalProcessingTime = 0;
    let totalChunks = 0;
    
    for (const article of articles) {
      try {
        const result = await this.processArticle(article);
        results.push({
          articleId: article.id,
          chunks: result.chunks,
          metrics: result.metrics,
        });
        
        totalProcessingTime += result.metrics.processingTimeMs;
        totalChunks += result.chunks.length;
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push({
          articleId: article.id,
          error: errorMessage,
        });
      }
    }
    
    const summary = {
      totalArticles: articles.length,
      successfullyProcessed: results.length,
      totalChunks,
      averageProcessingTime: results.length > 0 ? Math.round(totalProcessingTime / results.length) : 0,
      errors,
    };
    
    return { results, summary };
  }

  /**
   * Clean text without chunking (utility method)
   */
  cleanText(content: string): string {
    return TextCleaner.cleanText(content);
  }

  /**
   * Estimate processing requirements for an article
   */
  estimateProcessing(article: NewsArticle): {
    estimatedChunks: number;
    estimatedProcessingTime: number; // milliseconds
    contentComplexity: 'low' | 'medium' | 'high';
  } {
    const contentLength = article.content.length;
    const estimatedChunks = this.chunker.estimateChunkCount(article);
    
    // Estimate processing time based on content length and complexity
    const baseTimePerChar = 0.01; // milliseconds per character
    const chunkingOverhead = estimatedChunks * 5; // additional time per chunk
    const estimatedProcessingTime = Math.round(contentLength * baseTimePerChar + chunkingOverhead);
    
    // Determine content complexity
    let contentComplexity: 'low' | 'medium' | 'high' = 'low';
    if (contentLength > 5000 || estimatedChunks > 10) {
      contentComplexity = 'high';
    } else if (contentLength > 2000 || estimatedChunks > 5) {
      contentComplexity = 'medium';
    }
    
    return {
      estimatedChunks,
      estimatedProcessingTime,
      contentComplexity,
    };
  }

  /**
   * Update processing configuration
   */
  updateConfig(newConfig: Partial<TextProcessingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.chunking) {
      this.chunker.updateConfig(newConfig.chunking);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): TextProcessingConfig {
    return { ...this.config };
  }

  /**
   * Validate article input
   */
  private validateArticle(article: NewsArticle): void {
    if (!article) {
      throw new Error('Article is required');
    }
    
    if (!article.id) {
      throw new Error('Article ID is required');
    }
    
    if (!article.content || typeof article.content !== 'string') {
      throw new Error('Article content is required and must be a string');
    }
    
    if (article.content.trim().length === 0) {
      throw new Error('Article content cannot be empty');
    }
  }

  /**
   * Log processing metrics
   */
  private logMetrics(metrics: ProcessingMetrics): void {
    console.log(`Text Processing Metrics for ${metrics.articleId}:`, {
      originalLength: metrics.originalLength,
      cleanedLength: metrics.cleanedLength,
      compressionRatio: metrics.originalLength > 0 ? (metrics.cleanedLength / metrics.originalLength).toFixed(2) : '0',
      chunkCount: metrics.chunkCount,
      averageChunkSize: metrics.averageChunkSize,
      processingTime: `${metrics.processingTimeMs}ms`,
      validationPassed: metrics.validationPassed,
      issueCount: metrics.issues.length,
    });
  }
}

/**
 * Custom error class for text processing failures
 */
export class TextProcessingError extends Error {
  public readonly metrics: ProcessingMetrics;

  constructor(message: string, metrics: ProcessingMetrics) {
    super(message);
    this.name = 'TextProcessingError';
    this.metrics = metrics;
  }
}

/**
 * Factory function to create a text processor with default configuration
 */
export function createTextProcessor(config?: Partial<TextProcessingConfig>): TextProcessor {
  const finalConfig = config ? { ...DEFAULT_TEXT_PROCESSING_CONFIG, ...config } : DEFAULT_TEXT_PROCESSING_CONFIG;
  return new TextProcessor(finalConfig);
}

/**
 * Utility function to process a single article with default settings
 */
export async function processArticle(article: NewsArticle): Promise<TextChunk[]> {
  const processor = createTextProcessor();
  const result = await processor.processArticle(article);
  return result.chunks;
}