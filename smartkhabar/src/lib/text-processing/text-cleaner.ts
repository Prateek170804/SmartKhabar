import { NewsArticle, TextChunk, ChunkMetadata } from '@/types';

/**
 * Configuration for text chunking
 */
export interface ChunkingConfig {
  maxChunkSize: number; // Maximum characters per chunk
  minChunkSize: number; // Minimum characters per chunk
  overlapSize: number; // Characters to overlap between chunks
  preserveContext: boolean; // Whether to preserve sentence boundaries
}

/**
 * Default chunking configuration optimized for embeddings
 */
export const DEFAULT_CHUNKING_CONFIG: ChunkingConfig = {
  maxChunkSize: 1000, // Optimal for sentence transformers
  minChunkSize: 200,  // Minimum meaningful content
  overlapSize: 100,   // Preserve context between chunks
  preserveContext: true,
};

/**
 * Text cleaning utilities for news articles
 */
export class TextCleaner {
  /**
   * Clean raw text content by removing HTML, normalizing whitespace, and fixing encoding issues
   */
  static cleanText(content: string): string {
    if (!content || typeof content !== 'string') {
      return '';
    }

    let cleaned = content;

    // Remove HTML tags and entities
    cleaned = this.removeHtml(cleaned);
    
    // Fix common encoding issues
    cleaned = this.fixEncoding(cleaned);
    
    // Normalize whitespace
    cleaned = this.normalizeWhitespace(cleaned);
    
    // Remove unwanted characters and patterns
    cleaned = this.removeUnwantedPatterns(cleaned);
    
    return cleaned.trim();
  }

  /**
   * Remove HTML tags and decode HTML entities
   */
  private static removeHtml(text: string): string {
    // Remove HTML tags
    let cleaned = text.replace(/<[^>]*>/g, ' ');
    
    // Decode common HTML entities
    const htmlEntities: Record<string, string> = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&apos;': "'",
      '&nbsp;': ' ',
      '&mdash;': '—',
      '&ndash;': '–',
      '&hellip;': '...',
      '&rsquo;': "'",
      '&lsquo;': "'",
      '&rdquo;': '"',
      '&ldquo;': '"',
    };

    for (const [entity, replacement] of Object.entries(htmlEntities)) {
      cleaned = cleaned.replace(new RegExp(entity, 'g'), replacement);
    }

    // Handle numeric HTML entities
    cleaned = cleaned.replace(/&#(\d+);/g, (match, num) => {
      return String.fromCharCode(parseInt(num, 10));
    });

    return cleaned;
  }

  /**
   * Fix common encoding issues
   */
  private static fixEncoding(text: string): string {
    // Fix common UTF-8 encoding issues
    const encodingFixes: Record<string, string> = {
      'â€™': "'",
      'â€œ': '"',
      'â€\u009d': '"',
      'â€"': '—',
      'â€¦': '...',
      'Ã¡': 'á',
      'Ã©': 'é',
      'Ã­': 'í',
      'Ã³': 'ó',
      'Ãº': 'ú',
      'Ã±': 'ñ',
    };

    let fixed = text;
    for (const [wrong, correct] of Object.entries(encodingFixes)) {
      fixed = fixed.replace(new RegExp(wrong, 'g'), correct);
    }

    return fixed;
  }

  /**
   * Normalize whitespace characters
   */
  private static normalizeWhitespace(text: string): string {
    return text
      // Replace multiple spaces/tabs with single space
      .replace(/[ \t]+/g, ' ')
      // Replace multiple line breaks with double line break
      .replace(/\n\s*\n\s*\n+/g, '\n\n')
      // Remove trailing whitespace from lines
      .replace(/[ \t]+$/gm, '')
      // Remove leading whitespace from lines (except intentional indentation)
      .replace(/^[ \t]+/gm, '');
  }

  /**
   * Remove unwanted patterns and characters
   */
  private static removeUnwantedPatterns(text: string): string {
    return text
      // Remove email addresses (privacy)
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[email]')
      // Remove phone numbers (privacy)
      .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[phone]')
      // Remove excessive punctuation
      .replace(/[.]{3,}/g, '...')
      .replace(/[!]{2,}/g, '!')
      .replace(/[?]{2,}/g, '?')
      // Remove social media handles and hashtags in isolation
      .replace(/\s@\w+\s/g, ' ')
      .replace(/\s#\w+\s/g, ' ')
      // Remove common footer/header patterns
      .replace(/\b(subscribe|unsubscribe|newsletter|copyright|all rights reserved)\b/gi, '')
      // Remove advertisement markers
      .replace(/\b(advertisement|sponsored|promoted)\b/gi, '');
  }

  /**
   * Estimate word count for text
   */
  static getWordCount(text: string): number {
    if (!text || typeof text !== 'string') {
      return 0;
    }
    
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Check if text chunk has sufficient content quality
   */
  static isValidChunk(text: string, minWordCount: number = 10): boolean {
    if (!text || typeof text !== 'string') {
      return false;
    }

    const wordCount = this.getWordCount(text);
    const hasSubstantialContent = wordCount >= minWordCount;
    const hasVariedContent = new Set(text.toLowerCase().split(/\s+/)).size > wordCount * 0.5;
    
    return hasSubstantialContent && hasVariedContent;
  }
}