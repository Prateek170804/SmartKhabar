// Text Processing Module
// Provides text cleaning, chunking, embedding generation, vector storage, and processing services for news articles

export { TextCleaner, DEFAULT_CHUNKING_CONFIG } from './text-cleaner';
export type { ChunkingConfig } from './text-cleaner';
export { TextChunker } from './text-chunker';
export { 
  TextProcessor, 
  TextProcessingError,
  DEFAULT_TEXT_PROCESSING_CONFIG,
  createTextProcessor,
  processArticle
} from './text-processor';
export type { TextProcessingConfig, ProcessingMetrics } from './text-processor';
export {
  EmbeddingService,
  EmbeddingError,
  DEFAULT_EMBEDDING_CONFIG,
  createEmbeddingService,
  generateEmbeddings
} from './embedding-service';
export type { EmbeddingConfig, EmbeddingMetrics } from './embedding-service';
export {
  VectorStore,
  VectorStoreError,
  DEFAULT_VECTOR_STORE_CONFIG,
  createVectorStore,
  createAndInitializeVectorStore
} from './vector-store';
export type { VectorStoreConfig, VectorSearchMetrics } from './vector-store';

// Re-export types for convenience
export type { NewsArticle, TextChunk, ChunkMetadata, SearchFilters, SearchResult } from '@/types';