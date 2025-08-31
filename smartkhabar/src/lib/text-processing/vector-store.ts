import { FaissStore } from '@langchain/community/vectorstores/faiss';
import { HuggingFaceTransformersEmbeddings } from '@langchain/community/embeddings/hf_transformers';
import { TextChunk, SearchFilters, SearchResult, DateRange } from '@/types';
import { Document } from '@langchain/core/documents';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Configuration for FAISS vector store
 */
export interface VectorStoreConfig {
  indexPath: string; // Path to store FAISS index files
  embeddingModel: string;
  dimensions: number;
  similarityThreshold: number; // Minimum similarity score for results
  maxResults: number; // Maximum number of results to return
  enablePersistence: boolean; // Whether to save/load index from disk
  autoSave: boolean; // Whether to automatically save after updates
}

/**
 * Default vector store configuration
 */
export const DEFAULT_VECTOR_STORE_CONFIG: VectorStoreConfig = {
  indexPath: './data/faiss-index',
  embeddingModel: 'Xenova/all-MiniLM-L6-v2',
  dimensions: 384,
  similarityThreshold: 0.1,
  maxResults: 50,
  enablePersistence: true,
  autoSave: true,
};

/**
 * Metadata for vector search operations
 */
export interface VectorSearchMetrics {
  queryTime: number; // milliseconds
  totalVectors: number;
  resultsReturned: number;
  similarityScores: number[];
  filtersApplied: string[];
}

/**
 * FAISS vector store service for semantic search
 */
export class VectorStore {
  private store: FaissStore | null = null;
  private embeddings: HuggingFaceTransformersEmbeddings;
  private config: VectorStoreConfig;
  private isInitialized = false;

  constructor(config: VectorStoreConfig = DEFAULT_VECTOR_STORE_CONFIG) {
    this.config = config;
    this.embeddings = new HuggingFaceTransformersEmbeddings({
      modelName: config.embeddingModel,
    });
  }

  /**
   * Initialize the vector store (create new or load existing)
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      if (this.config.enablePersistence && await this.indexExists()) {
        await this.loadIndex();
      } else {
        await this.createNewIndex();
      }
      
      this.isInitialized = true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new VectorStoreError(`Failed to initialize vector store: ${errorMessage}`);
    }
  }

  /**
   * Add text chunks to the vector store
   */
  async addChunks(chunks: TextChunk[]): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (chunks.length === 0) {
      return;
    }

    try {
      // Convert chunks to Langchain documents
      const documents = chunks.map(chunk => new Document({
        pageContent: chunk.content,
        metadata: {
          id: chunk.id,
          articleId: chunk.articleId,
          source: chunk.metadata.source,
          category: chunk.metadata.category,
          publishedAt: chunk.metadata.publishedAt.toISOString(),
          chunkIndex: chunk.metadata.chunkIndex,
          wordCount: chunk.metadata.wordCount,
        },
      }));

      if (this.store) {
        // Add to existing store
        await this.store.addDocuments(documents);
      } else {
        // Create new store with documents
        this.store = await FaissStore.fromDocuments(documents, this.embeddings);
      }

      // Auto-save if enabled
      if (this.config.autoSave && this.config.enablePersistence) {
        await this.saveIndex();
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new VectorStoreError(`Failed to add chunks to vector store: ${errorMessage}`);
    }
  }

  /**
   * Search for similar chunks using semantic similarity
   */
  async searchSimilar(
    query: string | number[], 
    filters?: SearchFilters
  ): Promise<{
    results: SearchResult[];
    metrics: VectorSearchMetrics;
  }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.store) {
      return {
        results: [],
        metrics: {
          queryTime: 0,
          totalVectors: 0,
          resultsReturned: 0,
          similarityScores: [],
          filtersApplied: [],
        },
      };
    }

    const startTime = Date.now();
    const filtersApplied: string[] = [];

    try {
      let searchResults;
      
      if (typeof query === 'string') {
        // Text query - use similarity search
        searchResults = await this.store.similaritySearchWithScore(
          query,
          this.config.maxResults
        );
      } else {
        // Vector query - use similarity search with embedding
        const queryEmbedding = query;
        searchResults = await this.store.similaritySearchVectorWithScore(
          queryEmbedding,
          this.config.maxResults
        );
      }

      // Apply filters and convert to SearchResult format
      let filteredResults = searchResults
        .filter(([, score]: [any, number]) => score >= this.config.similarityThreshold)
        .map(([doc, score]: [any, number]) => ({
          chunk: this.documentToTextChunk(doc),
          relevanceScore: score,
        }));

      // Apply additional filters
      if (filters) {
        filteredResults = this.applyFilters(filteredResults, filters, filtersApplied);
      }

      const queryTime = Date.now() - startTime;
      const metrics: VectorSearchMetrics = {
        queryTime,
        totalVectors: await this.getVectorCount(),
        resultsReturned: filteredResults.length,
        similarityScores: filteredResults.map((r: any) => r.relevanceScore),
        filtersApplied,
      };

      return {
        results: filteredResults,
        metrics,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new VectorStoreError(`Failed to search vector store: ${errorMessage}`);
    }
  }

  /**
   * Update the vector store index (rebuild from scratch)
   */
  async updateIndex(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // For FAISS, we typically rebuild the entire index
    // This is a placeholder for more sophisticated update logic
    if (this.config.autoSave && this.config.enablePersistence) {
      await this.saveIndex();
    }
  }

  /**
   * Get the total number of vectors in the store
   */
  async getVectorCount(): Promise<number> {
    if (!this.store) {
      return 0;
    }

    // FAISS doesn't directly expose vector count, so we estimate
    // This is a limitation of the current Langchain FAISS implementation
    return this.store.index?.ntotal() || 0;
  }

  /**
   * Save the index to disk
   */
  async saveIndex(): Promise<void> {
    if (!this.store || !this.config.enablePersistence) {
      return;
    }

    try {
      // Ensure directory exists
      await fs.mkdir(path.dirname(this.config.indexPath), { recursive: true });
      
      // Save the FAISS index
      await this.store.save(this.config.indexPath);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new VectorStoreError(`Failed to save index: ${errorMessage}`);
    }
  }

  /**
   * Load the index from disk
   */
  async loadIndex(): Promise<void> {
    if (!this.config.enablePersistence) {
      return;
    }

    try {
      this.store = await FaissStore.load(this.config.indexPath, this.embeddings);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new VectorStoreError(`Failed to load index: ${errorMessage}`);
    }
  }

  /**
   * Check if index files exist on disk
   */
  async indexExists(): Promise<boolean> {
    try {
      const indexFile = path.join(this.config.indexPath, 'faiss.index');
      const docstoreFile = path.join(this.config.indexPath, 'docstore.json');
      
      await fs.access(indexFile);
      await fs.access(docstoreFile);
      
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clear all vectors from the store
   */
  async clear(): Promise<void> {
    this.store = null;
    this.isInitialized = false;
    
    if (this.config.enablePersistence) {
      try {
        await fs.rm(this.config.indexPath, { recursive: true, force: true });
      } catch {
        // Ignore errors if directory doesn't exist
      }
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): VectorStoreConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<VectorStoreConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Recreate embeddings if model changed
    if (newConfig.embeddingModel && newConfig.embeddingModel !== this.config.embeddingModel) {
      this.embeddings = new HuggingFaceTransformersEmbeddings({
        modelName: newConfig.embeddingModel,
      });
    }
  }

  /**
   * Create a new empty index
   */
  private async createNewIndex(): Promise<void> {
    // Create an empty store with a dummy document that we'll remove
    const dummyDoc = new Document({
      pageContent: 'dummy',
      metadata: { dummy: true },
    });
    
    this.store = await FaissStore.fromDocuments([dummyDoc], this.embeddings);
  }

  /**
   * Convert Langchain Document back to TextChunk
   */
  private documentToTextChunk(doc: Document): TextChunk {
    return {
      id: doc.metadata.id,
      articleId: doc.metadata.articleId,
      content: doc.pageContent,
      embedding: [], // Embeddings are stored in FAISS, not returned
      metadata: {
        source: doc.metadata.source,
        category: doc.metadata.category,
        publishedAt: new Date(doc.metadata.publishedAt),
        chunkIndex: doc.metadata.chunkIndex,
        wordCount: doc.metadata.wordCount,
      },
    };
  }

  /**
   * Apply filters to search results
   */
  private applyFilters(
    results: SearchResult[], 
    filters: SearchFilters,
    filtersApplied: string[]
  ): SearchResult[] {
    let filtered = results;

    // Filter by categories
    if (filters.categories && filters.categories.length > 0) {
      filtered = filtered.filter(result => 
        filters.categories!.includes(result.chunk.metadata.category)
      );
      filtersApplied.push(`categories: ${filters.categories.join(', ')}`);
    }

    // Filter by sources
    if (filters.sources && filters.sources.length > 0) {
      filtered = filtered.filter(result => 
        filters.sources!.includes(result.chunk.metadata.source)
      );
      filtersApplied.push(`sources: ${filters.sources.join(', ')}`);
    }

    // Filter by date range
    if (filters.dateRange) {
      filtered = filtered.filter(result => {
        const publishedAt = result.chunk.metadata.publishedAt;
        return publishedAt >= filters.dateRange!.start && 
               publishedAt <= filters.dateRange!.end;
      });
      filtersApplied.push(`dateRange: ${filters.dateRange.start.toISOString()} to ${filters.dateRange.end.toISOString()}`);
    }

    // Filter by minimum relevance score
    if (filters.minRelevanceScore !== undefined) {
      filtered = filtered.filter(result => 
        result.relevanceScore >= filters.minRelevanceScore!
      );
      filtersApplied.push(`minRelevanceScore: ${filters.minRelevanceScore}`);
    }

    return filtered;
  }
}

/**
 * Custom error class for vector store operations
 */
export class VectorStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VectorStoreError';
  }
}

/**
 * Factory function to create a vector store with default configuration
 */
export function createVectorStore(config?: Partial<VectorStoreConfig>): VectorStore {
  const finalConfig = config ? { ...DEFAULT_VECTOR_STORE_CONFIG, ...config } : DEFAULT_VECTOR_STORE_CONFIG;
  return new VectorStore(finalConfig);
}

/**
 * Utility function to create and initialize a vector store
 */
export async function createAndInitializeVectorStore(config?: Partial<VectorStoreConfig>): Promise<VectorStore> {
  const store = createVectorStore(config);
  await store.initialize();
  return store;
}