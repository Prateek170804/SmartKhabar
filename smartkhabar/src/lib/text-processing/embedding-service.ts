import { HuggingFaceTransformersEmbeddings } from '@langchain/community/embeddings/hf_transformers';
import { TextChunk } from '@/types';

/**
 * Configuration for embedding generation
 */
export interface EmbeddingConfig {
  modelName: string;
  batchSize: number;
  maxRetries: number;
  retryDelay: number; // milliseconds
  validateEmbeddings: boolean;
  expectedDimensions: number;
}

/**
 * Default embedding configuration using sentence transformers
 */
export const DEFAULT_EMBEDDING_CONFIG: EmbeddingConfig = {
  modelName: 'Xenova/all-MiniLM-L6-v2', // Lightweight sentence transformer
  batchSize: 10, // Process chunks in batches for efficiency
  maxRetries: 3,
  retryDelay: 1000,
  validateEmbeddings: true,
  expectedDimensions: 384, // Dimension for all-MiniLM-L6-v2
};

/**
 * Embedding generation metrics for monitoring
 */
export interface EmbeddingMetrics {
  totalChunks: number;
  successfulEmbeddings: number;
  failedEmbeddings: number;
  averageProcessingTime: number; // milliseconds per chunk
  totalProcessingTime: number; // milliseconds
  batchCount: number;
  retryCount: number;
  errors: string[];
}

/**
 * Embedding service using Langchain and Hugging Face transformers
 */
export class EmbeddingService {
  private embeddings: HuggingFaceTransformersEmbeddings;
  private config: EmbeddingConfig;

  constructor(config: EmbeddingConfig = DEFAULT_EMBEDDING_CONFIG) {
    this.config = config;
    this.embeddings = new HuggingFaceTransformersEmbeddings({
      modelName: config.modelName,
    });
  }

  /**
   * Generate embeddings for a batch of text chunks
   */
  async generateEmbeddings(chunks: TextChunk[]): Promise<{
    chunks: TextChunk[];
    metrics: EmbeddingMetrics;
  }> {
    const startTime = Date.now();
    const metrics: EmbeddingMetrics = {
      totalChunks: chunks.length,
      successfulEmbeddings: 0,
      failedEmbeddings: 0,
      averageProcessingTime: 0,
      totalProcessingTime: 0,
      batchCount: 0,
      retryCount: 0,
      errors: [],
    };

    if (chunks.length === 0) {
      return { chunks: [], metrics };
    }

    const processedChunks: TextChunk[] = [];
    
    // Process chunks in batches for efficiency
    const batches = this.createBatches(chunks);
    metrics.batchCount = batches.length;

    for (const batch of batches) {
      try {
        const batchResult = await this.processBatch(batch);
        processedChunks.push(...batchResult.chunks);
        metrics.successfulEmbeddings += batchResult.successCount;
        metrics.failedEmbeddings += batchResult.failureCount;
        metrics.retryCount += batchResult.retryCount;
        metrics.errors.push(...batchResult.errors);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown batch processing error';
        metrics.errors.push(`Batch processing failed: ${errorMessage}`);
        metrics.failedEmbeddings += batch.length;
        
        // Add chunks without embeddings to maintain data integrity
        processedChunks.push(...batch);
      }
    }

    // Calculate final metrics
    const totalTime = Date.now() - startTime;
    metrics.totalProcessingTime = totalTime;
    metrics.averageProcessingTime = chunks.length > 0 ? Math.round(totalTime / chunks.length) : 0;

    return { chunks: processedChunks, metrics };
  }

  /**
   * Generate embedding for a single text chunk
   */
  async generateSingleEmbedding(chunk: TextChunk): Promise<TextChunk> {
    const result = await this.generateEmbeddings([chunk]);
    return result.chunks[0];
  }

  /**
   * Validate that embeddings have the expected dimensions and values
   */
  validateEmbedding(embedding: number[]): {
    isValid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    if (!Array.isArray(embedding)) {
      issues.push('Embedding is not an array');
      return { isValid: false, issues };
    }

    if (embedding.length === 0) {
      issues.push('Embedding is empty');
      return { isValid: false, issues };
    }

    if (this.config.expectedDimensions > 0 && embedding.length !== this.config.expectedDimensions) {
      issues.push(`Expected ${this.config.expectedDimensions} dimensions, got ${embedding.length}`);
    }

    // Check for invalid values (NaN, Infinity)
    const invalidValues = embedding.filter(val => !Number.isFinite(val));
    if (invalidValues.length > 0) {
      issues.push(`Found ${invalidValues.length} invalid values (NaN or Infinity)`);
    }

    // Check if all values are zero (likely an error)
    const allZero = embedding.every(val => val === 0);
    if (allZero) {
      issues.push('All embedding values are zero');
    }

    return { isValid: issues.length === 0, issues };
  }

  /**
   * Update embedding configuration
   */
  updateConfig(newConfig: Partial<EmbeddingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Recreate embeddings instance if model changed
    if (newConfig.modelName && newConfig.modelName !== this.config.modelName) {
      this.embeddings = new HuggingFaceTransformersEmbeddings({
        modelName: newConfig.modelName,
      });
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): EmbeddingConfig {
    return { ...this.config };
  }

  /**
   * Generate embedding for a query text
   */
  async embedQuery(text: string): Promise<number[]> {
    return await this.embeddings.embedQuery(text);
  }

  /**
   * Test embedding generation with sample text
   */
  async testEmbedding(text: string = 'This is a test sentence for embedding generation.'): Promise<{
    success: boolean;
    embedding?: number[];
    dimensions?: number;
    processingTime: number;
    error?: string;
  }> {
    const startTime = Date.now();
    
    try {
      const embedding = await this.embeddings.embedQuery(text);
      const processingTime = Date.now() - startTime;
      
      const validation = this.validateEmbedding(embedding);
      
      return {
        success: validation.isValid,
        embedding: validation.isValid ? embedding : undefined,
        dimensions: embedding.length,
        processingTime,
        error: validation.issues.length > 0 ? validation.issues.join(', ') : undefined,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      return {
        success: false,
        processingTime,
        error: errorMessage,
      };
    }
  }

  /**
   * Create batches of chunks for efficient processing
   */
  private createBatches(chunks: TextChunk[]): TextChunk[][] {
    const batches: TextChunk[][] = [];
    
    for (let i = 0; i < chunks.length; i += this.config.batchSize) {
      batches.push(chunks.slice(i, i + this.config.batchSize));
    }
    
    return batches;
  }

  /**
   * Process a single batch of chunks with retry logic
   */
  private async processBatch(batch: TextChunk[]): Promise<{
    chunks: TextChunk[];
    successCount: number;
    failureCount: number;
    retryCount: number;
    errors: string[];
  }> {
    const result = {
      chunks: [] as TextChunk[],
      successCount: 0,
      failureCount: 0,
      retryCount: 0,
      errors: [] as string[],
    };

    // Extract texts for batch embedding
    const texts = batch.map(chunk => chunk.content);
    
    let embeddings: number[][] | null = null;
    let lastError: Error | null = null;

    // Retry logic for batch processing
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          result.retryCount++;
          await this.delay(this.config.retryDelay * attempt);
        }

        embeddings = await this.embeddings.embedDocuments(texts);
        break; // Success, exit retry loop
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt === this.config.maxRetries) {
          result.errors.push(`Batch failed after ${this.config.maxRetries} retries: ${lastError.message}`);
        }
      }
    }

    // Process results
    if (embeddings) {
      for (let i = 0; i < batch.length; i++) {
        const chunk = batch[i];
        const embedding = embeddings[i];
        
        if (this.config.validateEmbeddings) {
          const validation = this.validateEmbedding(embedding);
          if (!validation.isValid) {
            result.errors.push(`Invalid embedding for chunk ${chunk.id}: ${validation.issues.join(', ')}`);
            result.failureCount++;
            result.chunks.push(chunk); // Keep original chunk without embedding
            continue;
          }
        }
        
        result.chunks.push({
          ...chunk,
          embedding,
        });
        result.successCount++;
      }
    } else {
      // All chunks failed
      result.failureCount += batch.length;
      result.chunks.push(...batch); // Keep original chunks without embeddings
    }

    return result;
  }

  /**
   * Utility function for delays in retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Factory function to create an embedding service with default configuration
 */
export function createEmbeddingService(config?: Partial<EmbeddingConfig>): EmbeddingService {
  const finalConfig = config ? { ...DEFAULT_EMBEDDING_CONFIG, ...config } : DEFAULT_EMBEDDING_CONFIG;
  return new EmbeddingService(finalConfig);
}

/**
 * Utility function to generate embeddings for chunks with default settings
 */
export async function generateEmbeddings(chunks: TextChunk[]): Promise<TextChunk[]> {
  const service = createEmbeddingService();
  const result = await service.generateEmbeddings(chunks);
  return result.chunks;
}

/**
 * Custom error class for embedding generation failures
 */
export class EmbeddingError extends Error {
  public readonly metrics: EmbeddingMetrics;

  constructor(message: string, metrics: EmbeddingMetrics) {
    super(message);
    this.name = 'EmbeddingError';
    this.metrics = metrics;
  }
}