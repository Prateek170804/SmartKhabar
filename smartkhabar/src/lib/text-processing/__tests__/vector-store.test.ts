import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VectorStore, createVectorStore, createAndInitializeVectorStore, DEFAULT_VECTOR_STORE_CONFIG } from '../vector-store';
import { TextChunk, SearchFilters } from '@/types';
import * as fs from 'fs/promises';

// Mock the FAISS store and embeddings
vi.mock('@langchain/community/vectorstores/faiss', () => ({
  FaissStore: {
    fromDocuments: vi.fn().mockImplementation(async (docs, embeddings) => ({
      addDocuments: vi.fn().mockResolvedValue(undefined),
      similaritySearchWithScore: vi.fn().mockResolvedValue([
        [{ pageContent: 'test content', metadata: { id: 'test-1', articleId: 'article-1', source: 'test', category: 'tech', publishedAt: '2024-01-01T00:00:00.000Z', chunkIndex: 0, wordCount: 2 } }, 0.8],
        [{ pageContent: 'another content', metadata: { id: 'test-2', articleId: 'article-2', source: 'test', category: 'tech', publishedAt: '2024-01-01T00:00:00.000Z', chunkIndex: 0, wordCount: 2 } }, 0.6],
      ]),
      similaritySearchVectorWithScore: vi.fn().mockResolvedValue([
        [{ pageContent: 'vector content', metadata: { id: 'test-3', articleId: 'article-3', source: 'test', category: 'tech', publishedAt: '2024-01-01T00:00:00.000Z', chunkIndex: 0, wordCount: 2 } }, 0.9],
      ]),
      save: vi.fn().mockResolvedValue(undefined),
      index: { ntotal: vi.fn().mockReturnValue(10) },
    })),
    load: vi.fn().mockImplementation(async (path, embeddings) => ({
      addDocuments: vi.fn().mockResolvedValue(undefined),
      similaritySearchWithScore: vi.fn().mockResolvedValue([]),
      similaritySearchVectorWithScore: vi.fn().mockResolvedValue([]),
      save: vi.fn().mockResolvedValue(undefined),
      index: { ntotal: vi.fn().mockReturnValue(5) },
    })),
  },
}));

vi.mock('@langchain/community/embeddings/hf_transformers', () => ({
  HuggingFaceTransformersEmbeddings: vi.fn().mockImplementation(() => ({})),
}));

// Mock fs operations
vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  access: vi.fn().mockResolvedValue(undefined),
  rm: vi.fn().mockResolvedValue(undefined),
}));

describe('VectorStore', () => {
  let vectorStore: VectorStore;
  let sampleChunks: TextChunk[];

  beforeEach(() => {
    vectorStore = new VectorStore({
      ...DEFAULT_VECTOR_STORE_CONFIG,
      indexPath: './test-index',
      enablePersistence: false, // Disable for tests
    });

    sampleChunks = [
      {
        id: 'chunk-1',
        articleId: 'article-1',
        content: 'This is a test chunk about technology.',
        embedding: new Array(384).fill(0).map(() => Math.random()),
        metadata: {
          source: 'tech-news',
          category: 'technology',
          publishedAt: new Date('2024-01-01'),
          chunkIndex: 0,
          wordCount: 8,
        },
      },
      {
        id: 'chunk-2',
        articleId: 'article-2',
        content: 'Another chunk about business news.',
        embedding: new Array(384).fill(0).map(() => Math.random()),
        metadata: {
          source: 'business-news',
          category: 'business',
          publishedAt: new Date('2024-01-02'),
          chunkIndex: 0,
          wordCount: 6,
        },
      },
    ];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await vectorStore.initialize();
      expect(vectorStore['isInitialized']).toBe(true);
    });

    it('should not reinitialize if already initialized', async () => {
      await vectorStore.initialize();
      await vectorStore.initialize(); // Second call should not do anything
      expect(vectorStore['isInitialized']).toBe(true);
    });

    it('should create new index when no existing index', async () => {
      // Mock indexExists to return false
      vi.spyOn(vectorStore as any, 'indexExists').mockResolvedValue(false);
      
      await vectorStore.initialize();
      expect(vectorStore['isInitialized']).toBe(true);
    });
  });

  describe('addChunks', () => {
    it('should add chunks to the vector store', async () => {
      await vectorStore.addChunks(sampleChunks);
      
      // Should have initialized and created store
      expect(vectorStore['isInitialized']).toBe(true);
      expect(vectorStore['store']).toBeDefined();
    });

    it('should handle empty chunks array', async () => {
      await vectorStore.addChunks([]);
      
      // Should initialize but not create store
      expect(vectorStore['isInitialized']).toBe(true);
    });

    it('should initialize before adding chunks', async () => {
      expect(vectorStore['isInitialized']).toBe(false);
      
      await vectorStore.addChunks(sampleChunks);
      
      expect(vectorStore['isInitialized']).toBe(true);
    });
  });

  describe('searchSimilar', () => {
    beforeEach(async () => {
      await vectorStore.addChunks(sampleChunks);
    });

    it('should search with text query', async () => {
      const result = await vectorStore.searchSimilar('technology news');
      
      expect(result.results).toHaveLength(2);
      expect(result.results[0].chunk.content).toBe('test content');
      expect(result.results[0].relevanceScore).toBe(0.8);
      expect(result.metrics.queryTime).toBeGreaterThanOrEqual(0);
      expect(result.metrics.resultsReturned).toBe(2);
    });

    it('should search with vector query', async () => {
      const queryVector = new Array(384).fill(0).map(() => Math.random());
      const result = await vectorStore.searchSimilar(queryVector);
      
      expect(result.results).toHaveLength(1);
      expect(result.results[0].chunk.content).toBe('vector content');
      expect(result.results[0].relevanceScore).toBe(0.9);
    });

    it('should return empty results when no store exists', async () => {
      const emptyStore = new VectorStore({ ...DEFAULT_VECTOR_STORE_CONFIG, enablePersistence: false });
      
      // Override initialize to not create a store
      vi.spyOn(emptyStore as any, 'initialize').mockResolvedValue(undefined);
      emptyStore['isInitialized'] = true;
      emptyStore['store'] = null;
      
      const result = await emptyStore.searchSimilar('test');
      
      expect(result.results).toHaveLength(0);
      expect(result.metrics.totalVectors).toBe(0);
    });

    it('should apply category filters', async () => {
      const filters: SearchFilters = {
        categories: ['technology'],
      };
      
      const result = await vectorStore.searchSimilar('test', filters);
      
      expect(result.metrics.filtersApplied).toContain('categories: technology');
    });

    it('should apply source filters', async () => {
      const filters: SearchFilters = {
        sources: ['tech-news'],
      };
      
      const result = await vectorStore.searchSimilar('test', filters);
      
      expect(result.metrics.filtersApplied).toContain('sources: tech-news');
    });

    it('should apply date range filters', async () => {
      const filters: SearchFilters = {
        dateRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-31'),
        },
      };
      
      const result = await vectorStore.searchSimilar('test', filters);
      
      expect(result.metrics.filtersApplied.some(f => f.includes('dateRange'))).toBe(true);
    });

    it('should apply minimum relevance score filter', async () => {
      const filters: SearchFilters = {
        minRelevanceScore: 0.7,
      };
      
      const result = await vectorStore.searchSimilar('test', filters);
      
      expect(result.metrics.filtersApplied).toContain('minRelevanceScore: 0.7');
    });
  });

  describe('persistence', () => {
    it('should save index when auto-save is enabled', async () => {
      const persistentStore = new VectorStore({
        ...DEFAULT_VECTOR_STORE_CONFIG,
        enablePersistence: true,
        autoSave: true,
      });
      
      await persistentStore.addChunks(sampleChunks);
      
      // Should have called save
      expect(fs.mkdir).toHaveBeenCalled();
    });

    it('should load existing index', async () => {
      const persistentStore = new VectorStore({
        ...DEFAULT_VECTOR_STORE_CONFIG,
        enablePersistence: true,
      });
      
      // Mock indexExists to return true
      vi.spyOn(persistentStore as any, 'indexExists').mockResolvedValue(true);
      
      await persistentStore.initialize();
      
      expect(persistentStore['isInitialized']).toBe(true);
    });

    it('should check if index exists', async () => {
      const result = await vectorStore.indexExists();
      
      // Should return true because fs.access is mocked to succeed
      expect(result).toBe(true);
    });

    it('should handle index not existing', async () => {
      // Mock fs.access to throw error
      vi.mocked(fs.access).mockRejectedValue(new Error('File not found'));
      
      const result = await vectorStore.indexExists();
      
      expect(result).toBe(false);
    });
  });

  describe('configuration', () => {
    it('should use default configuration', () => {
      const config = vectorStore.getConfig();
      
      expect(config.dimensions).toBe(384);
      expect(config.embeddingModel).toBe('Xenova/all-MiniLM-L6-v2');
      expect(config.maxResults).toBe(50);
    });

    it('should update configuration', () => {
      const newConfig = {
        maxResults: 20,
        similarityThreshold: 0.5,
      };
      
      vectorStore.updateConfig(newConfig);
      
      const config = vectorStore.getConfig();
      expect(config.maxResults).toBe(20);
      expect(config.similarityThreshold).toBe(0.5);
    });

    it('should create store with custom configuration', () => {
      const customConfig = {
        dimensions: 512,
        maxResults: 100,
      };
      
      const customStore = new VectorStore({ ...DEFAULT_VECTOR_STORE_CONFIG, ...customConfig });
      const config = customStore.getConfig();
      
      expect(config.dimensions).toBe(512);
      expect(config.maxResults).toBe(100);
    });
  });

  describe('utility methods', () => {
    it('should get vector count', async () => {
      await vectorStore.addChunks(sampleChunks);
      
      const count = await vectorStore.getVectorCount();
      
      expect(count).toBe(10); // Mocked value
    });

    it('should return 0 for vector count when no store', async () => {
      const count = await vectorStore.getVectorCount();
      
      expect(count).toBe(0);
    });

    it('should clear the store', async () => {
      await vectorStore.addChunks(sampleChunks);
      expect(vectorStore['isInitialized']).toBe(true);
      
      await vectorStore.clear();
      
      expect(vectorStore['store']).toBeNull();
      expect(vectorStore['isInitialized']).toBe(false);
    });

    it('should update index', async () => {
      await vectorStore.addChunks(sampleChunks);
      
      // Should not throw error
      await vectorStore.updateIndex();
    });
  });

  describe('factory functions', () => {
    it('should create vector store with default config', () => {
      const store = createVectorStore();
      
      expect(store.getConfig()).toEqual(DEFAULT_VECTOR_STORE_CONFIG);
    });

    it('should create vector store with custom config', () => {
      const customConfig = { maxResults: 25 };
      const store = createVectorStore(customConfig);
      
      expect(store.getConfig().maxResults).toBe(25);
    });

    it('should create and initialize vector store', async () => {
      const store = await createAndInitializeVectorStore();
      
      expect(store['isInitialized']).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle initialization errors', async () => {
      // Mock createNewIndex to throw error
      vi.spyOn(vectorStore as any, 'createNewIndex').mockRejectedValue(new Error('Init failed'));
      
      await expect(vectorStore.initialize()).rejects.toThrow('Failed to initialize vector store');
    });

    it('should handle add chunks errors', async () => {
      // Initialize first to avoid initialization errors
      await vectorStore.initialize();
      
      // Mock addDocuments to throw error
      vectorStore['store']!.addDocuments = vi.fn().mockRejectedValue(new Error('Add failed'));
      
      await expect(vectorStore.addChunks(sampleChunks)).rejects.toThrow('Failed to add chunks to vector store');
    });

    it('should handle search errors', async () => {
      await vectorStore.initialize();
      
      // Mock search to throw error
      vectorStore['store']!.similaritySearchWithScore = vi.fn().mockRejectedValue(new Error('Search failed'));
      
      await expect(vectorStore.searchSimilar('test')).rejects.toThrow('Failed to search vector store');
    });

    it('should handle save errors', async () => {
      const persistentStore = new VectorStore({
        ...DEFAULT_VECTOR_STORE_CONFIG,
        enablePersistence: true,
        autoSave: false, // Disable auto-save to control when save is called
      });
      
      await persistentStore.initialize();
      
      // Mock save to throw error
      persistentStore['store']!.save = vi.fn().mockRejectedValue(new Error('Save failed'));
      
      await expect(persistentStore.saveIndex()).rejects.toThrow('Failed to save index');
    });

    it('should handle load errors', async () => {
      const persistentStore = new VectorStore({
        ...DEFAULT_VECTOR_STORE_CONFIG,
        enablePersistence: true,
      });
      
      // Mock load to throw error
      const { FaissStore } = await import('@langchain/community/vectorstores/faiss');
      vi.mocked(FaissStore.load).mockRejectedValue(new Error('Load failed'));
      
      await expect(persistentStore.loadIndex()).rejects.toThrow('Failed to load index');
    });
  });
});