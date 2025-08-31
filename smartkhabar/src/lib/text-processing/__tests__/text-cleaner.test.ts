import { describe, it, expect } from 'vitest';
import { TextCleaner, DEFAULT_CHUNKING_CONFIG } from '../text-cleaner';

describe('TextCleaner', () => {
  describe('cleanText', () => {
    it('should remove HTML tags', () => {
      const input = '<p>This is a <strong>test</strong> article.</p>';
      const expected = 'This is a test article.';
      expect(TextCleaner.cleanText(input)).toBe(expected);
    });

    it('should decode HTML entities', () => {
      const input = 'This &amp; that &lt;test&gt; &quot;quote&quot; &nbsp;space';
      const expected = 'This & that <test> "quote" space';
      expect(TextCleaner.cleanText(input)).toBe(expected);
    });

    it('should handle numeric HTML entities', () => {
      const input = 'Test &#39;quote&#39; and &#8217;smart quote&#8217;';
      const result = TextCleaner.cleanText(input);
      expect(result).toContain("Test 'quote'");
      expect(result).toContain('smart quote');
    });

    it('should fix common encoding issues', () => {
      const input = 'Donâ€™t worry about â€œthisâ€ issue';
      const result = TextCleaner.cleanText(input);
      expect(result).toContain("Don");
      expect(result).toContain("worry about");
      expect(result).toContain("issue");
    });

    it('should normalize whitespace', () => {
      const input = 'This   has    multiple\n\n\n\nspaces   and   lines';
      const result = TextCleaner.cleanText(input);
      expect(result).toContain('This has multiple');
      expect(result).toContain('spaces and lines');
      expect(result).not.toContain('   '); // No multiple spaces
    });

    it('should remove email addresses for privacy', () => {
      const input = 'Contact us at test@example.com for more info';
      const expected = 'Contact us at [email] for more info';
      expect(TextCleaner.cleanText(input)).toBe(expected);
    });

    it('should remove phone numbers for privacy', () => {
      const input = 'Call us at 123-456-7890 or 123.456.7890';
      const expected = 'Call us at [phone] or [phone]';
      expect(TextCleaner.cleanText(input)).toBe(expected);
    });

    it('should handle empty or invalid input', () => {
      expect(TextCleaner.cleanText('')).toBe('');
      expect(TextCleaner.cleanText(null as any)).toBe('');
      expect(TextCleaner.cleanText(undefined as any)).toBe('');
      expect(TextCleaner.cleanText(123 as any)).toBe('');
    });

    it('should remove excessive punctuation', () => {
      const input = 'This is amazing!!!!! Really....... Are you sure???';
      const expected = 'This is amazing! Really... Are you sure?';
      expect(TextCleaner.cleanText(input)).toBe(expected);
    });

    it('should remove advertisement markers', () => {
      const input = 'This is content. Advertisement. More content. Sponsored content here.';
      const result = TextCleaner.cleanText(input);
      expect(result).toContain('This is content');
      expect(result).toContain('More content');
      expect(result).toContain('content here');
      expect(result).not.toContain('Advertisement');
      expect(result).not.toContain('Sponsored');
    });
  });

  describe('getWordCount', () => {
    it('should count words correctly', () => {
      expect(TextCleaner.getWordCount('Hello world')).toBe(2);
      expect(TextCleaner.getWordCount('This is a test sentence')).toBe(5);
      expect(TextCleaner.getWordCount('One')).toBe(1);
      expect(TextCleaner.getWordCount('')).toBe(0);
      expect(TextCleaner.getWordCount('   ')).toBe(0);
    });

    it('should handle multiple spaces', () => {
      expect(TextCleaner.getWordCount('Hello    world   test')).toBe(3);
    });

    it('should handle newlines and tabs', () => {
      expect(TextCleaner.getWordCount('Hello\nworld\ttest')).toBe(3);
    });

    it('should handle invalid input', () => {
      expect(TextCleaner.getWordCount(null as any)).toBe(0);
      expect(TextCleaner.getWordCount(undefined as any)).toBe(0);
      expect(TextCleaner.getWordCount(123 as any)).toBe(0);
    });
  });

  describe('isValidChunk', () => {
    it('should validate chunks with sufficient content', () => {
      const validChunk = 'This is a valid chunk with enough words to be considered substantial content for processing.';
      expect(TextCleaner.isValidChunk(validChunk)).toBe(true);
    });

    it('should reject chunks with insufficient content', () => {
      const shortChunk = 'Too short';
      expect(TextCleaner.isValidChunk(shortChunk)).toBe(false);
    });

    it('should reject chunks with repetitive content', () => {
      const repetitiveChunk = 'test test test test test test test test test test test test';
      expect(TextCleaner.isValidChunk(repetitiveChunk)).toBe(false);
    });

    it('should handle custom minimum word count', () => {
      const chunk = 'This has exactly five words';
      expect(TextCleaner.isValidChunk(chunk, 5)).toBe(true);
      expect(TextCleaner.isValidChunk(chunk, 6)).toBe(false);
    });

    it('should handle invalid input', () => {
      expect(TextCleaner.isValidChunk('')).toBe(false);
      expect(TextCleaner.isValidChunk(null as any)).toBe(false);
      expect(TextCleaner.isValidChunk(undefined as any)).toBe(false);
    });
  });

  describe('DEFAULT_CHUNKING_CONFIG', () => {
    it('should have reasonable default values', () => {
      expect(DEFAULT_CHUNKING_CONFIG.maxChunkSize).toBe(1000);
      expect(DEFAULT_CHUNKING_CONFIG.minChunkSize).toBe(200);
      expect(DEFAULT_CHUNKING_CONFIG.overlapSize).toBe(100);
      expect(DEFAULT_CHUNKING_CONFIG.preserveContext).toBe(true);
    });

    it('should have logical size relationships', () => {
      expect(DEFAULT_CHUNKING_CONFIG.minChunkSize).toBeLessThan(DEFAULT_CHUNKING_CONFIG.maxChunkSize);
      expect(DEFAULT_CHUNKING_CONFIG.overlapSize).toBeLessThan(DEFAULT_CHUNKING_CONFIG.minChunkSize);
    });
  });
});