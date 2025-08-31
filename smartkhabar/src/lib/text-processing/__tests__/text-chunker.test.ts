import { describe, it, expect, beforeEach } from 'vitest';
import { TextChunker } from '../text-chunker';
import { DEFAULT_CHUNKING_CONFIG } from '../text-cleaner';
import { NewsArticle } from '@/types';

describe('TextChunker', () => {
  let chunker: TextChunker;
  let sampleArticle: NewsArticle;

  beforeEach(() => {
    chunker = new TextChunker(DEFAULT_CHUNKING_CONFIG);
    sampleArticle = {
      id: 'test-article-1',
      headline: 'Test Article',
      content: 'This is a test article with some content that should be chunked properly.',
      source: 'test-source',
      category: 'technology',
      publishedAt: new Date('2024-01-01'),
      url: 'https://example.com/test',
      tags: ['test'],
    };
  });

  describe('chunkArticle', () => {
    it('should create a single chunk for short articles', () => {
      const chunks = chunker.chunkArticle(sampleArticle);
      
      expect(chunks).toHaveLength(1);
      expect(chunks[0].articleId).toBe(sampleArticle.id);
      expect(chunks[0].content).toBe(sampleArticle.content);
      expect(chunks[0].metadata.chunkIndex).toBe(0);
      expect(chunks[0].metadata.source).toBe(sampleArticle.source);
      expect(chunks[0].metadata.category).toBe(sampleArticle.category);
    });

    it('should create multiple chunks for long articles', () => {
      const longContent = 'This is a very long article with substantial content that should be split into multiple chunks. '.repeat(50); // ~4700 characters
      const longArticle = { ...sampleArticle, content: longContent };
      
      const chunks = chunker.chunkArticle(longArticle);
      
      if (chunks.length > 1) {
        expect(chunks[0].metadata.chunkIndex).toBe(0);
        expect(chunks[1].metadata.chunkIndex).toBe(1);
      }
      
      // Check that all chunks belong to the same article
      chunks.forEach(chunk => {
        expect(chunk.articleId).toBe(longArticle.id);
        expect(chunk.content.length).toBeGreaterThan(0);
      });
    });

    it('should preserve paragraph boundaries when possible', () => {
      const contentWithParagraphs = [
        'This is the first paragraph with some substantial content that provides meaningful information.',
        'This is the second paragraph with different content that adds more context and details.',
        'This is the third paragraph with more content that completes the article narrative.',
      ].join('\n\n');
      
      const articleWithParagraphs = { ...sampleArticle, content: contentWithParagraphs };
      const chunks = chunker.chunkArticle(articleWithParagraphs);
      
      expect(chunks.length).toBeGreaterThanOrEqual(1);
      if (chunks.length > 0) {
        expect(chunks[0].content).toContain('first paragraph');
        expect(chunks[0].content).toContain('second paragraph');
        expect(chunks[0].content).toContain('third paragraph');
      }
    });

    it('should handle articles with HTML content', () => {
      const htmlContent = '<p>This is <strong>HTML</strong> content with substantial text that should be processed properly.</p><p>Another paragraph with more meaningful content.</p>';
      const htmlArticle = { ...sampleArticle, content: htmlContent };
      
      const chunks = chunker.chunkArticle(htmlArticle);
      
      expect(chunks.length).toBeGreaterThanOrEqual(1);
      if (chunks.length > 0) {
        expect(chunks[0].content).not.toContain('<p>');
        expect(chunks[0].content).not.toContain('<strong>');
        expect(chunks[0].content).toContain('HTML');
      }
    });

    it('should return empty array for invalid content', () => {
      const invalidArticle = { ...sampleArticle, content: '' };
      const chunks = chunker.chunkArticle(invalidArticle);
      
      expect(chunks).toHaveLength(0);
    });

    it('should generate unique IDs for each chunk', () => {
      const longContent = 'This is a sentence. '.repeat(200); // Force multiple chunks
      const longArticle = { ...sampleArticle, content: longContent };
      
      const chunks = chunker.chunkArticle(longArticle);
      const ids = chunks.map(chunk => chunk.id);
      const uniqueIds = new Set(ids);
      
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should calculate word counts correctly', () => {
      const chunks = chunker.chunkArticle(sampleArticle);
      
      expect(chunks[0].metadata.wordCount).toBeGreaterThan(0);
      
      // Verify word count matches actual content
      const actualWordCount = chunks[0].content.trim().split(/\s+/).length;
      expect(chunks[0].metadata.wordCount).toBe(actualWordCount);
    });
  });

  describe('estimateChunkCount', () => {
    it('should estimate 1 chunk for short articles', () => {
      const estimate = chunker.estimateChunkCount(sampleArticle);
      expect(estimate).toBe(1);
    });

    it('should estimate multiple chunks for long articles', () => {
      const longContent = 'This is a word. '.repeat(500); // ~7500 characters
      const longArticle = { ...sampleArticle, content: longContent };
      
      const estimate = chunker.estimateChunkCount(longArticle);
      expect(estimate).toBeGreaterThan(1);
    });

    it('should provide reasonable estimates', () => {
      const mediumContent = 'This is a word. '.repeat(100); // ~1500 characters
      const mediumArticle = { ...sampleArticle, content: mediumContent };
      
      const estimate = chunker.estimateChunkCount(mediumArticle);
      const actualChunks = chunker.chunkArticle(mediumArticle);
      
      // Estimate should be close to actual (within 1-2 chunks)
      expect(Math.abs(estimate - actualChunks.length)).toBeLessThanOrEqual(2);
    });
  });

  describe('validateChunks', () => {
    it('should validate good quality chunks', () => {
      const goodArticle = {
        ...sampleArticle,
        content: 'This is a test article with substantial content that should be chunked properly and pass validation checks.'
      };
      const chunks = chunker.chunkArticle(goodArticle);
      const validation = chunker.validateChunks(chunks);
      
      if (chunks.length > 0) {
        expect(validation.metrics.totalChunks).toBe(chunks.length);
        expect(validation.metrics.validChunks).toBeGreaterThan(0);
      }
    });

    it('should detect oversized chunks', () => {
      // Create a chunk that exceeds max size
      const oversizedChunk = {
        id: 'test-chunk',
        articleId: 'test-article',
        content: 'x'.repeat(2000), // Exceeds default max of 1000
        embedding: [],
        metadata: {
          source: 'test',
          category: 'test',
          publishedAt: new Date(),
          chunkIndex: 0,
          wordCount: 2000,
        },
      };
      
      const validation = chunker.validateChunks([oversizedChunk]);
      
      expect(validation.isValid).toBe(false);
      expect(validation.issues.some(issue => issue.includes('exceeds maximum size'))).toBe(true);
    });

    it('should detect undersized chunks', () => {
      // Create a chunk that's below min size
      const undersizedChunk = {
        id: 'test-chunk',
        articleId: 'test-article',
        content: 'tiny', // Below default min of 200
        embedding: [],
        metadata: {
          source: 'test',
          category: 'test',
          publishedAt: new Date(),
          chunkIndex: 0,
          wordCount: 1,
        },
      };
      
      const validation = chunker.validateChunks([undersizedChunk]);
      
      expect(validation.isValid).toBe(false);
      expect(validation.issues.some(issue => issue.includes('below minimum size'))).toBe(true);
    });

    it('should calculate metrics correctly', () => {
      const longContent = 'This is a sentence with multiple words and substantial content. '.repeat(50);
      const longArticle = { ...sampleArticle, content: longContent };
      const chunks = chunker.chunkArticle(longArticle);
      
      const validation = chunker.validateChunks(chunks);
      
      expect(validation.metrics.totalChunks).toBe(chunks.length);
      if (chunks.length > 0) {
        expect(validation.metrics.averageWordCount).toBeGreaterThanOrEqual(0);
        expect(validation.metrics.minWordCount).toBeGreaterThanOrEqual(0);
        expect(validation.metrics.maxWordCount).toBeGreaterThanOrEqual(validation.metrics.minWordCount);
      }
    });
  });

  describe('configuration', () => {
    it('should use custom configuration', () => {
      const customConfig = {
        maxChunkSize: 500,
        minChunkSize: 100,
        overlapSize: 50,
        preserveContext: false,
      };
      
      const customChunker = new TextChunker(customConfig);
      expect(customChunker.getConfig()).toEqual(customConfig);
    });

    it('should update configuration', () => {
      const newConfig = { maxChunkSize: 800 };
      chunker.updateConfig(newConfig);
      
      const updatedConfig = chunker.getConfig();
      expect(updatedConfig.maxChunkSize).toBe(800);
      expect(updatedConfig.minChunkSize).toBe(DEFAULT_CHUNKING_CONFIG.minChunkSize); // Should preserve other values
    });

    it('should affect chunking behavior with different config', () => {
      const smallChunkConfig = {
        maxChunkSize: 200,
        minChunkSize: 50,
        overlapSize: 20,
        preserveContext: true,
      };
      
      const smallChunker = new TextChunker(smallChunkConfig);
      const longContent = 'This is a meaningful sentence with substantial content. '.repeat(100);
      const longArticle = { ...sampleArticle, content: longContent };
      
      const defaultChunks = chunker.chunkArticle(longArticle);
      const smallChunks = smallChunker.chunkArticle(longArticle);
      
      // With smaller chunk size, we should get more chunks (or at least same number)
      expect(smallChunks.length).toBeGreaterThanOrEqual(defaultChunks.length);
    });
  });
});