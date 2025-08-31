/**
 * Unit tests for ReadingTimeEstimator
 */

import { describe, it, expect } from 'vitest';
import { ReadingTimeEstimator } from '../reading-time-estimator';

describe('ReadingTimeEstimator', () => {
  describe('estimateReadingTime', () => {
    it('should estimate reading time correctly', () => {
      const shortText = 'This is a short text with about ten words.';
      const longText = 'This is a much longer text that contains many more words. '.repeat(50); // ~500 words

      expect(ReadingTimeEstimator.estimateReadingTime(shortText)).toBe(1);
      expect(ReadingTimeEstimator.estimateReadingTime(longText)).toBe(3); // 500 words / 200 wpm = 2.5, rounded up to 3
    });

    it('should handle empty text', () => {
      expect(ReadingTimeEstimator.estimateReadingTime('')).toBe(1);
      expect(ReadingTimeEstimator.estimateReadingTime('   ')).toBe(1);
    });
  });

  describe('calculateTargetWordCount', () => {
    it('should calculate correct word count for target minutes', () => {
      expect(ReadingTimeEstimator.calculateTargetWordCount(1)).toBe(200);
      expect(ReadingTimeEstimator.calculateTargetWordCount(5)).toBe(1000);
      expect(ReadingTimeEstimator.calculateTargetWordCount(0.5)).toBe(100);
    });
  });

  describe('countWords', () => {
    it('should count words correctly', () => {
      expect(ReadingTimeEstimator.countWords('Hello world')).toBe(2);
      expect(ReadingTimeEstimator.countWords('One two three four five')).toBe(5);
      expect(ReadingTimeEstimator.countWords('  Multiple   spaces   between  words  ')).toBe(4);
    });

    it('should handle empty or whitespace-only text', () => {
      expect(ReadingTimeEstimator.countWords('')).toBe(0);
      expect(ReadingTimeEstimator.countWords('   ')).toBe(0);
      expect(ReadingTimeEstimator.countWords('\n\t')).toBe(0);
    });

    it('should handle punctuation correctly', () => {
      expect(ReadingTimeEstimator.countWords('Hello, world!')).toBe(2);
      expect(ReadingTimeEstimator.countWords('Dr. Smith went to the U.S.A.')).toBe(6); // "Dr.", "Smith", "went", "to", "the", "U.S.A."
    });
  });

  describe('adjustContentLength', () => {
    const longContent = 'This is a test sentence. '.repeat(100); // ~500 words

    it('should not truncate content that fits within target', () => {
      const shortContent = 'This is a short text.';
      const result = ReadingTimeEstimator.adjustContentLength(shortContent, 5);
      
      expect(result).toBe(shortContent);
    });

    it('should truncate content that exceeds target reading time', () => {
      const result = ReadingTimeEstimator.adjustContentLength(longContent, 1); // 1 minute = ~200 words
      
      expect(ReadingTimeEstimator.countWords(result)).toBeLessThanOrEqual(200);
      expect(result.length).toBeLessThan(longContent.length);
    });

    it('should try to end at sentence boundaries', () => {
      const content = 'First sentence. Second sentence. Third sentence. Fourth sentence.';
      const result = ReadingTimeEstimator.adjustContentLength(content, 0.1); // Very short target
      
      // Should end with a period if possible
      expect(result.endsWith('.')).toBe(true);
    });

    it('should handle content without sentence boundaries', () => {
      const content = 'word '.repeat(300); // 300 words without periods
      const result = ReadingTimeEstimator.adjustContentLength(content, 1);
      
      expect(ReadingTimeEstimator.countWords(result)).toBeLessThanOrEqual(200);
    });
  });

  describe('generateReadingTimeSummary', () => {
    it('should generate complete reading time summary', () => {
      const text = 'This is a test text with multiple words and sentences. It should provide accurate metrics.';
      const summary = ReadingTimeEstimator.generateReadingTimeSummary(text);

      expect(summary).toMatchObject({
        estimatedMinutes: expect.any(Number),
        wordCount: expect.any(Number),
        characterCount: text.length
      });

      expect(summary.wordCount).toBeGreaterThan(0);
      expect(summary.estimatedMinutes).toBeGreaterThan(0);
      expect(summary.characterCount).toBe(text.length);
    });

    it('should handle empty text in summary', () => {
      const summary = ReadingTimeEstimator.generateReadingTimeSummary('');

      expect(summary).toMatchObject({
        estimatedMinutes: 1, // Minimum 1 minute
        wordCount: 0,
        characterCount: 0
      });
    });
  });

  describe('edge cases', () => {
    it('should handle very long words', () => {
      const longWord = 'a'.repeat(1000);
      expect(ReadingTimeEstimator.countWords(longWord)).toBe(1);
    });

    it('should handle special characters and numbers', () => {
      const text = 'Test 123 @#$ test2 $100 test3';
      expect(ReadingTimeEstimator.countWords(text)).toBe(6); // "Test", "123", "@#$", "test2", "$100", "test3"
    });

    it('should handle newlines and tabs', () => {
      const text = 'Line1\nLine2\tTabbed\rCarriageReturn';
      expect(ReadingTimeEstimator.countWords(text)).toBe(4);
    });
  });
});