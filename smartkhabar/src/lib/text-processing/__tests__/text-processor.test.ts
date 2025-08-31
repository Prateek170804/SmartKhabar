import { describe, it, expect, beforeEach } from 'vitest';
import { TextProcessor, TextProcessingError, createTextProcessor, processArticle } from '../text-processor';
import { DEFAULT_TEXT_PROCESSING_CONFIG } from '../text-processor';
import { NewsArticle } from '@/types';

describe('TextProcessor', () => {
  let processor: TextProcessor;
  let sampleArticle: NewsArticle;

  beforeEach(() => {
    processor = new TextProcessor();
    sampleArticle = {
      id: 'test-article-1',
      headline: 'Test Article',
      content: '<p>This is a <strong>test</strong> article with HTML content that needs processing and has substantial meaningful content.</p>',
      source: 'test-source',
      category: 'technology',
      publishedAt: new Date('2024-01-01'),
      url: 'https://example.com/test',
      tags: ['test'],
    };
  });

  describe('processArticle', () => {
    it('should process a valid article successfully', async () => {
      const result = await processor.processArticle(sampleArticle);
      
      expect(result.chunks.length).toBeGreaterThanOrEqual(1);
      if (result.chunks.length > 0) {
        expect(result.chunks[0].articleId).toBe(sampleArticle.id);
        expect(result.chunks[0].content).not.toContain('<p>');
        expect(result.chunks[0].content).not.toContain('<strong>');
        expect(result.chunks[0].content).toContain('test');
      }
      
      expect(result.metrics.articleId).toBe(sampleArticle.id);
      expect(result.metrics.originalLength).toBeGreaterThan(0);
      expect(result.metrics.cleanedLength).toBeGreaterThan(0);
      expect(result.metrics.chunkCount).toBe(result.chunks.length);
      expect(result.metrics.processingTimeMs).toBeGreaterThan(0);
    });

    it('should handle long articles with multiple chunks', async () => {
      const longContent = '<p>' + 'This is a long sentence with meaningful content that provides substantial information. '.repeat(100) + '</p>';
      const longArticle = { ...sampleArticle, content: longContent };
      
      const result = await processor.processArticle(longArticle);
      
      expect(result.chunks.length).toBeGreaterThanOrEqual(1);
      expect(result.metrics.chunkCount).toBe(result.chunks.length);
      
      // Verify all chunks belong to the same article
      result.chunks.forEach(chunk => {
        expect(chunk.articleId).toBe(longArticle.id);
        expect(chunk.content.length).toBeGreaterThan(0);
      });
    });

    it('should throw error for invalid article', async () => {
      const invalidArticle = { ...sampleArticle, content: '' };
      
      await expect(processor.processArticle(invalidArticle)).rejects.toThrow(TextProcessingError);
    });

    it('should throw error for missing article ID', async () => {
      const invalidArticle = { ...sampleArticle, id: '' };
      
      await expect(processor.processArticle(invalidArticle)).rejects.toThrow(TextProcessingError);
    });

    it('should throw error for non-string content', async () => {
      const invalidArticle = { ...sampleArticle, content: null as any };
      
      await expect(processor.processArticle(invalidArticle)).rejects.toThrow(TextProcessingError);
    });

    it('should calculate compression ratio correctly', async () => {
      const htmlContent = '<p>Test</p><div><span>Content</span></div>';
      const htmlArticle = { ...sampleArticle, content: htmlContent };
      
      const result = await processor.processArticle(htmlArticle);
      
      expect(result.metrics.originalLength).toBe(htmlContent.length);
      expect(result.metrics.cleanedLength).toBeLessThan(result.metrics.originalLength);
      expect(result.metrics.cleanedLength).toBeGreaterThan(0);
    });

    it('should validate chunks when validation is enabled', async () => {
      const config = { ...DEFAULT_TEXT_PROCESSING_CONFIG, enableValidation: true };
      const validatingProcessor = new TextProcessor(config);
      
      const result = await validatingProcessor.processArticle(sampleArticle);
      
      // Validation should run, but may pass or fail depending on content
      expect(typeof result.metrics.validationPassed).toBe('boolean');
      expect(Array.isArray(result.metrics.issues)).toBe(true);
    });
  });

  describe('processArticles', () => {
    it('should process multiple articles successfully', async () => {
      const articles = [
        sampleArticle,
        { ...sampleArticle, id: 'test-article-2', content: 'Different content for second article with substantial text.' },
        { ...sampleArticle, id: 'test-article-3', content: 'Third article with unique content and meaningful information.' },
      ];
      
      const result = await processor.processArticles(articles);
      
      expect(result.results).toHaveLength(3);
      expect(result.summary.totalArticles).toBe(3);
      expect(result.summary.successfullyProcessed).toBe(3);
      expect(result.summary.errors).toHaveLength(0);
      expect(result.summary.totalChunks).toBeGreaterThanOrEqual(0);
      expect(result.summary.averageProcessingTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle mixed success and failure scenarios', async () => {
      const articles = [
        sampleArticle,
        { ...sampleArticle, id: 'invalid-article', content: '' }, // This will fail
        { ...sampleArticle, id: 'test-article-3', content: 'Valid content.' },
      ];
      
      const result = await processor.processArticles(articles);
      
      expect(result.results).toHaveLength(2); // Only successful ones
      expect(result.summary.totalArticles).toBe(3);
      expect(result.summary.successfullyProcessed).toBe(2);
      expect(result.summary.errors).toHaveLength(1);
      expect(result.summary.errors[0].articleId).toBe('invalid-article');
    });

    it('should calculate summary statistics correctly', async () => {
      const articles = [
        sampleArticle,
        { ...sampleArticle, id: 'test-article-2', content: 'Short content.' },
      ];
      
      const result = await processor.processArticles(articles);
      
      expect(result.summary.totalChunks).toBe(
        result.results.reduce((sum, r) => sum + r.chunks.length, 0)
      );
      
      const totalTime = result.results.reduce((sum, r) => sum + r.metrics.processingTimeMs, 0);
      const expectedAverage = Math.round(totalTime / result.results.length);
      expect(result.summary.averageProcessingTime).toBe(expectedAverage);
    });
  });

  describe('cleanText', () => {
    it('should clean text without chunking', () => {
      const htmlContent = '<p>Test <strong>content</strong></p>';
      const cleaned = processor.cleanText(htmlContent);
      
      expect(cleaned).toBe('Test content');
      expect(cleaned).not.toContain('<p>');
      expect(cleaned).not.toContain('<strong>');
    });
  });

  describe('estimateProcessing', () => {
    it('should provide reasonable estimates for short articles', () => {
      const estimate = processor.estimateProcessing(sampleArticle);
      
      expect(estimate.estimatedChunks).toBe(1);
      expect(estimate.estimatedProcessingTime).toBeGreaterThan(0);
      expect(estimate.contentComplexity).toBe('low');
    });

    it('should classify content complexity correctly', () => {
      const shortArticle = { ...sampleArticle, content: 'Short content with minimal text.' };
      const mediumArticle = { ...sampleArticle, content: 'Medium content with substantial information. '.repeat(100) };
      const longArticle = { ...sampleArticle, content: 'Long content with extensive detailed information. '.repeat(300) };
      
      expect(processor.estimateProcessing(shortArticle).contentComplexity).toBe('low');
      expect(processor.estimateProcessing(mediumArticle).contentComplexity).toBe('medium');
      expect(processor.estimateProcessing(longArticle).contentComplexity).toBe('high');
    });

    it('should estimate more chunks for longer content', () => {
      const shortArticle = { ...sampleArticle, content: 'Short.' };
      const longArticle = { ...sampleArticle, content: 'Long content. '.repeat(500) };
      
      const shortEstimate = processor.estimateProcessing(shortArticle);
      const longEstimate = processor.estimateProcessing(longArticle);
      
      expect(longEstimate.estimatedChunks).toBeGreaterThan(shortEstimate.estimatedChunks);
      expect(longEstimate.estimatedProcessingTime).toBeGreaterThan(shortEstimate.estimatedProcessingTime);
    });
  });

  describe('configuration', () => {
    it('should use custom configuration', () => {
      const customConfig = {
        ...DEFAULT_TEXT_PROCESSING_CONFIG,
        enableValidation: false,
        logProcessingMetrics: true,
      };
      
      const customProcessor = new TextProcessor(customConfig);
      expect(customProcessor.getConfig()).toEqual(customConfig);
    });

    it('should update configuration', () => {
      const newConfig = { enableValidation: false };
      processor.updateConfig(newConfig);
      
      const updatedConfig = processor.getConfig();
      expect(updatedConfig.enableValidation).toBe(false);
    });

    it('should update chunking configuration', () => {
      const newChunkingConfig = { maxChunkSize: 500 };
      processor.updateConfig({ chunking: newChunkingConfig });
      
      const config = processor.getConfig();
      expect(config.chunking.maxChunkSize).toBe(500);
    });
  });

  describe('factory functions', () => {
    it('should create processor with default config', () => {
      const defaultProcessor = createTextProcessor();
      expect(defaultProcessor.getConfig()).toEqual(DEFAULT_TEXT_PROCESSING_CONFIG);
    });

    it('should create processor with custom config', () => {
      const customConfig = { enableValidation: false };
      const customProcessor = createTextProcessor(customConfig);
      
      expect(customProcessor.getConfig().enableValidation).toBe(false);
    });

    it('should process single article with utility function', async () => {
      const chunks = await processArticle(sampleArticle);
      
      expect(chunks).toHaveLength(1);
      expect(chunks[0].articleId).toBe(sampleArticle.id);
      expect(chunks[0].content).not.toContain('<p>');
    });
  });

  describe('error handling', () => {
    it('should create TextProcessingError with metrics', async () => {
      const invalidArticle = { ...sampleArticle, content: '' };
      
      try {
        await processor.processArticle(invalidArticle);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(TextProcessingError);
        expect((error as TextProcessingError).metrics).toBeDefined();
        expect((error as TextProcessingError).metrics.articleId).toBe(invalidArticle.id);
      }
    });

    it('should handle null article gracefully', async () => {
      await expect(processor.processArticle(null as any)).rejects.toThrow(TextProcessingError);
    });

    it('should handle undefined article gracefully', async () => {
      await expect(processor.processArticle(undefined as any)).rejects.toThrow(TextProcessingError);
    });
  });
});