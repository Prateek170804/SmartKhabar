import { NewsArticle, TextChunk, ChunkMetadata } from '@/types';
import { TextCleaner, ChunkingConfig, DEFAULT_CHUNKING_CONFIG } from './text-cleaner';
import { randomUUID } from 'crypto';

/**
 * Intelligent text chunking service that preserves context and optimizes for embeddings
 */
export class TextChunker {
  private config: ChunkingConfig;

  constructor(config: ChunkingConfig = DEFAULT_CHUNKING_CONFIG) {
    this.config = config;
  }

  /**
   * Chunk a news article into optimized text segments
   */
  chunkArticle(article: NewsArticle): TextChunk[] {
    // Clean the article content first
    const cleanedContent = TextCleaner.cleanText(article.content);
    
    if (!cleanedContent || cleanedContent.length < this.config.minChunkSize) {
      // If content is too short, return as single chunk
      return this.createSingleChunk(article, cleanedContent);
    }

    // Split into chunks using intelligent chunking
    const chunks = this.intelligentChunk(cleanedContent);
    
    // Create TextChunk objects with metadata
    return chunks
      .map((chunkText, index) => this.createTextChunk(article, chunkText, index))
      .filter(chunk => chunk.content.trim().length > 0 && TextCleaner.getWordCount(chunk.content) >= 3);
  }

  /**
   * Create a single chunk for short articles
   */
  private createSingleChunk(article: NewsArticle, content: string): TextChunk[] {
    if (!content || content.trim().length === 0) {
      return [];
    }

    // For short articles, be more lenient with validation
    if (content.length < this.config.minChunkSize && TextCleaner.getWordCount(content) < 5) {
      return [];
    }

    return [this.createTextChunk(article, content, 0)];
  }

  /**
   * Intelligent chunking that preserves sentence and paragraph boundaries
   */
  private intelligentChunk(text: string): string[] {
    if (text.length <= this.config.maxChunkSize) {
      return [text];
    }

    const chunks: string[] = [];
    let currentChunk = '';
    
    // Split by paragraphs first to preserve document structure
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    
    for (const paragraph of paragraphs) {
      const trimmedParagraph = paragraph.trim();
      
      // If adding this paragraph would exceed max size, finalize current chunk
      if (currentChunk.length + trimmedParagraph.length > this.config.maxChunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = this.getOverlapText(currentChunk);
      }
      
      // If paragraph itself is too long, split it by sentences
      if (trimmedParagraph.length > this.config.maxChunkSize) {
        const sentenceChunks = this.chunkBySentences(trimmedParagraph);
        
        for (const sentenceChunk of sentenceChunks) {
          if (currentChunk.length + sentenceChunk.length > this.config.maxChunkSize && currentChunk.length > 0) {
            chunks.push(currentChunk.trim());
            currentChunk = this.getOverlapText(currentChunk);
          }
          currentChunk += (currentChunk ? '\n\n' : '') + sentenceChunk;
        }
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + trimmedParagraph;
      }
    }
    
    // Add the final chunk if it has content
    if (currentChunk.trim().length >= this.config.minChunkSize) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks.filter(chunk => chunk.length >= this.config.minChunkSize);
  }

  /**
   * Split long paragraphs by sentences while preserving context
   */
  private chunkBySentences(text: string): string[] {
    // Split by sentence boundaries (periods, exclamation marks, question marks)
    const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
    
    if (sentences.length <= 1) {
      return [text];
    }

    const chunks: string[] = [];
    let currentChunk = '';
    
    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      
      // If adding this sentence would exceed max size, finalize current chunk
      if (currentChunk.length + trimmedSentence.length > this.config.maxChunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = this.getOverlapText(currentChunk);
      }
      
      currentChunk += (currentChunk ? ' ' : '') + trimmedSentence;
    }
    
    // Add the final chunk
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }

  /**
   * Get overlap text from the end of a chunk to preserve context
   */
  private getOverlapText(chunk: string): string {
    if (!this.config.preserveContext || chunk.length <= this.config.overlapSize) {
      return '';
    }

    // Get the last part of the chunk for overlap
    const overlapText = chunk.slice(-this.config.overlapSize);
    
    // Try to find a sentence boundary to make clean overlap
    const sentenceBoundary = overlapText.search(/[.!?]\s+/);
    if (sentenceBoundary !== -1) {
      return overlapText.slice(sentenceBoundary + 2); // +2 to skip the punctuation and space
    }
    
    // If no sentence boundary, find word boundary
    const wordBoundary = overlapText.lastIndexOf(' ');
    if (wordBoundary !== -1) {
      return overlapText.slice(wordBoundary + 1);
    }
    
    return overlapText;
  }

  /**
   * Create a TextChunk object with proper metadata
   */
  private createTextChunk(article: NewsArticle, content: string, index: number): TextChunk {
    const metadata: ChunkMetadata = {
      source: article.source,
      category: article.category,
      publishedAt: article.publishedAt,
      chunkIndex: index,
      wordCount: TextCleaner.getWordCount(content),
    };

    return {
      id: randomUUID(),
      articleId: article.id,
      content: content.trim(),
      embedding: [], // Will be populated by embedding service
      metadata,
    };
  }

  /**
   * Update chunking configuration
   */
  updateConfig(newConfig: Partial<ChunkingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current chunking configuration
   */
  getConfig(): ChunkingConfig {
    return { ...this.config };
  }

  /**
   * Estimate the number of chunks for an article
   */
  estimateChunkCount(article: NewsArticle): number {
    const cleanedContent = TextCleaner.cleanText(article.content);
    
    if (cleanedContent.length <= this.config.maxChunkSize) {
      return 1;
    }
    
    // Rough estimation based on content length and overlap
    const effectiveChunkSize = this.config.maxChunkSize - this.config.overlapSize;
    return Math.ceil(cleanedContent.length / effectiveChunkSize);
  }

  /**
   * Validate chunk quality and provide metrics
   */
  validateChunks(chunks: TextChunk[]): {
    isValid: boolean;
    metrics: {
      totalChunks: number;
      averageWordCount: number;
      minWordCount: number;
      maxWordCount: number;
      validChunks: number;
    };
    issues: string[];
  } {
    const issues: string[] = [];
    let validChunks = 0;
    const wordCounts = chunks.map(chunk => chunk.metadata.wordCount);
    
    for (const chunk of chunks) {
      if (chunk.content.trim().length > 0 && TextCleaner.getWordCount(chunk.content) >= 3) {
        validChunks++;
      } else {
        issues.push(`Chunk ${chunk.id} has insufficient quality`);
      }
      
      if (chunk.content.length > this.config.maxChunkSize) {
        issues.push(`Chunk ${chunk.id} exceeds maximum size`);
      }
      
      // Be more lenient with minimum size for short articles
      if (chunk.content.length < this.config.minChunkSize && TextCleaner.getWordCount(chunk.content) < 10) {
        issues.push(`Chunk ${chunk.id} below minimum size`);
      }
    }

    const metrics = {
      totalChunks: chunks.length,
      averageWordCount: wordCounts.length > 0 ? Math.round(wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length) : 0,
      minWordCount: wordCounts.length > 0 ? Math.min(...wordCounts) : 0,
      maxWordCount: wordCounts.length > 0 ? Math.max(...wordCounts) : 0,
      validChunks,
    };

    return {
      isValid: issues.length === 0 && validChunks === chunks.length,
      metrics,
      issues,
    };
  }
}