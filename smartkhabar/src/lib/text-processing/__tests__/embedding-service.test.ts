import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EmbeddingService, createEmbeddingService, generateEmbeddings, DEFAULT_EMBEDDING_CONFIG } from '../embedding-service';
import { TextChunk } from '@/types';

// Mock the HuggingFaceTransformersEmbeddings
vi.mock('@langchain/community/embeddings/hf_transformers', () => ({
  HuggingFaceTransformersEmbeddings: vi.fn().mockImplementation(() => ({
    embedQuery: vi.fn().mockImplementation(async () => {
      // Add small delay to simulate processing time
      await new Promise(resolve => setTimeout(resolve, 10));
      return new Array(384).fill(0).map(() => Math.random() - 0.5);
    }),
    embedDocuments: vi.fn().mockImplementation(async (texts: string[]) => {
      // Add small delay to simulate processing time
      await new Promise(resolve => setTimeout(resolve, 10));
      return texts.map(() => new Array(384).fill(0).map(() => Math.random() - 0.5));
    }),
  })),
}));

describe('EmbeddingService', () => {
  let service: EmbeddingService;
  let sampleChunks: TextChunk[];

  beforeEach(() => {
    service = new EmbeddingService();
    sampleChunks = [
      {
        id: 'chunk-1',
        articleId: 'article-1',
        content: 'This is the first chunk of text content.',
        embedding: [],
        metadata: {
          source: 'test-source',
          category: 'technology',
          publishedAt: new Date('2024-01-01'),
          chunkIndex: 0,
          wordCount: 8,
        },
      },
      {
        id: 'chunk-2',
        articleId: 'article-1',
        content: 'This is the second chunk with different content.',
        embedding: [],
        metadata: {
          source: 'test-source',
          category: 'technology',
          publishedAt: new Date('2024-01-01'),
          chunkIndex: 1,
          wordCount: 9,
        },
      },
    ];
  });

  describe('generateEmbeddings', () => {
    it('should generate embeddings for text chunks', async () => {
      const result = await service.generateEmbeddings(sampleChunks);
      
      expect(result.chunks).toHaveLength(2);
      expect(result.chunks[0].embedding).toHaveLength(384);
      expect(result.chunks[1].embedding).toHaveLength(384);
      expect(result.chunks[0].id).toBe('chunk-1');
      expect(result.chunks[1].id).toBe('chunk-2');
      
      expect(result.metrics.totalChunks).toBe(2);
      expect(result.metrics.successfulEmbeddings).toBe(2);
      expect(result.metrics.failedEmbeddings).toBe(0);
      expect(result.metrics.totalProcessingTime).toBeGreaterThan(0);
    });

    it('should handle empty chunk array', async () => {
      const result = await service.generateEmbeddings([]);
      
      expect(result.chunks).toHaveLength(0);
      expect(result.metrics.totalChunks).toBe(0);
      expect(result.metrics.successfulEmbeddings).toBe(0);
      expect(result.metrics.failedEmbeddings).toBe(0);
    });

    it('should process chunks in batches', async () => {
      const manyChunks = Array.from({ length: 25 }, (_, i) => ({
        ...sampleChunks[0],
        id: `chunk-${i}`,
        content: `This is chunk number ${i} with unique content.`,
      }));

      const result = await service.generateEmbeddings(manyChunks);
      
      expect(result.chunks).toHaveLength(25);
      expect(result.metrics.batchCount).toBeGreaterThan(1); // Should be processed in multiple batches
      expect(result.metrics.successfulEmbeddings).toBe(25);
    });

    it('should calculate metrics correctly', async () => {
      const result = await service.generateEmbeddings(sampleChunks);
      
      expect(result.metrics.totalChunks).toBe(sampleChunks.length);
      expect(result.metrics.averageProcessingTime).toBeGreaterThan(0);
      expect(result.metrics.batchCount).toBeGreaterThan(0);
      expect(result.metrics.errors).toHaveLength(0);
    });
  });

  describe('generateSingleEmbedding', () => {
    it('should generate embedding for a single chunk', async () => {
      const chunk = sampleChunks[0];
      const result = await service.generateSingleEmbedding(chunk);
      
      expect(result.id).toBe(chunk.id);
      expect(result.embedding).toHaveLength(384);
      expect(result.content).toBe(chunk.content);
    });
  });

  describe('validateEmbedding', () => {
    it('should validate correct embeddings', () => {
      const validEmbedding = new Array(384).fill(0).map(() => Math.random() - 0.5);
      const validation = service.validateEmbedding(validEmbedding);
      
      expect(validation.isValid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    it('should detect empty embeddings', () => {
      const validation = service.validateEmbedding([]);
      
      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain('Embedding is empty');
    });

    it('should detect wrong dimensions', () => {
      const wrongDimensionEmbedding = new Array(100).fill(0.5); // Wrong dimension
      const validation = service.validateEmbedding(wrongDimensionEmbedding);
      
      expect(validation.isValid).toBe(false);
      expect(validation.issues.some(issue => issue.includes('Expected 384 dimensions'))).toBe(true);
    });

    it('should detect invalid values', () => {
      const invalidEmbedding = [1.0, 2.0, NaN, 4.0, Infinity];
      const validation = service.validateEmbedding(invalidEmbedding);
      
      expect(validation.isValid).toBe(false);
      expect(validation.issues.some(issue => issue.includes('invalid values'))).toBe(true);
    });

    it('should detect all-zero embeddings', () => {
      const zeroEmbedding = new Array(384).fill(0);
      const validation = service.validateEmbedding(zeroEmbedding);
      
      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain('All embedding values are zero');
    });

    it('should handle non-array input', () => {
      const validation = service.validateEmbedding('not an array' as any);
      
      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain('Embedding is not an array');
    });
  });

  describe('testEmbedding', () => {
    it('should test embedding generation successfully', async () => {
      const result = await service.testEmbedding();
      
      expect(result.success).toBe(true);
      expect(result.embedding).toHaveLength(384);
      expect(result.dimensions).toBe(384);
      expect(result.processingTime).toBeGreaterThan(0);
      expect(result.error).toBeUndefined();
    });

    it('should test with custom text', async () => {
      const customText = 'Custom test text for embedding generation.';
      const result = await service.testEmbedding(customText);
      
      expect(result.success).toBe(true);
      expect(result.embedding).toHaveLength(384);
    });
  });

  describe('configuration', () => {
    it('should use default configuration', () => {
      const config = service.getConfig();
      
      expect(config.modelName).toBe(DEFAULT_EMBEDDING_CONFIG.modelName);
      expect(config.batchSize).toBe(DEFAULT_EMBEDDING_CONFIG.batchSize);
      expect(config.expectedDimensions).toBe(DEFAULT_EMBEDDING_CONFIG.expectedDimensions);
    });

    it('should update configuration', () => {
      const newConfig = { batchSize: 5, maxRetries: 5 };
      service.updateConfig(newConfig);
      
      const config = service.getConfig();
      expect(config.batchSize).toBe(5);
      expect(config.maxRetries).toBe(5);
      expect(config.modelName).toBe(DEFAULT_EMBEDDING_CONFIG.modelName); // Should preserve other values
    });

    it('should create service with custom configuration', () => {
      const customConfig = {
        batchSize: 20,
        maxRetries: 2,
        expectedDimensions: 512,
      };
      
      const customService = new EmbeddingService({ ...DEFAULT_EMBEDDING_CONFIG, ...customConfig });
      const config = customService.getConfig();
      
      expect(config.batchSize).toBe(20);
      expect(config.maxRetries).toBe(2);
      expect(config.expectedDimensions).toBe(512);
    });
  });

  describe('error handling', () => {
    it('should handle embedding generation errors gracefully', async () => {
      // Create a service with minimal retries to avoid timeout
      const fastFailService = new EmbeddingService({ 
        ...DEFAULT_EMBEDDING_CONFIG, 
        maxRetries: 0,
        retryDelay: 10
      });
      
      // Mock the embeddings to throw an error
      const mockEmbeddings = {
        embedDocuments: vi.fn().mockRejectedValue(new Error('Embedding generation failed')),
      };
      
      (fastFailService as any).embeddings = mockEmbeddings;
      
      const result = await fastFailService.generateEmbeddings(sampleChunks);
      
      expect(result.chunks).toHaveLength(2); // Should return original chunks
      expect(result.chunks[0].embedding).toHaveLength(0); // No embeddings generated
      expect(result.metrics.failedEmbeddings).toBe(2);
      expect(result.metrics.successfulEmbeddings).toBe(0);
      expect(result.metrics.errors.length).toBeGreaterThan(0);
    }, 10000);

    it('should handle test embedding errors', async () => {
      // Mock the embeddings to throw an error with delay
      const mockEmbeddings = {
        embedQuery: vi.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          throw new Error('Test embedding failed');
        }),
      };
      
      (service as any).embeddings = mockEmbeddings;
      
      const result = await service.testEmbedding();
      
      expect(result.success).toBe(false);
      expect(result.embedding).toBeUndefined();
      expect(result.error).toContain('Test embedding failed');
      expect(result.processingTime).toBeGreaterThan(0);
    });
  });

  describe('factory functions', () => {
    it('should create service with default config', () => {
      const defaultService = createEmbeddingService();
      expect(defaultService.getConfig()).toEqual(DEFAULT_EMBEDDING_CONFIG);
    });

    it('should create service with custom config', () => {
      const customConfig = { batchSize: 15 };
      const customService = createEmbeddingService(customConfig);
      
      expect(customService.getConfig().batchSize).toBe(15);
      expect(customService.getConfig().modelName).toBe(DEFAULT_EMBEDDING_CONFIG.modelName);
    });

    it('should generate embeddings with utility function', async () => {
      const result = await generateEmbeddings(sampleChunks);
      
      expect(result).toHaveLength(2);
      expect(result[0].embedding).toHaveLength(384);
      expect(result[1].embedding).toHaveLength(384);
    });
  });

  describe('batch processing', () => {
    it('should handle different batch sizes', async () => {
      const smallBatchService = new EmbeddingService({ 
        ...DEFAULT_EMBEDDING_CONFIG, 
        batchSize: 1 
      });
      
      const result = await smallBatchService.generateEmbeddings(sampleChunks);
      
      expect(result.chunks).toHaveLength(2);
      expect(result.metrics.batchCount).toBe(2); // Each chunk in its own batch
      expect(result.metrics.successfulEmbeddings).toBe(2);
    });

    it('should process large batches efficiently', async () => {
      const largeBatchService = new EmbeddingService({ 
        ...DEFAULT_EMBEDDING_CONFIG, 
        batchSize: 100 
      });
      
      const result = await largeBatchService.generateEmbeddings(sampleChunks);
      
      expect(result.chunks).toHaveLength(2);
      expect(result.metrics.batchCount).toBe(1); // All chunks in one batch
      expect(result.metrics.successfulEmbeddings).toBe(2);
    });
  });
});