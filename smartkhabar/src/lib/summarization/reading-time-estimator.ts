/**
 * Reading time estimation utility
 * Estimates reading time based on word count and adjusts content accordingly
 */

export class ReadingTimeEstimator {
  // Average reading speed: 200 words per minute
  private static readonly WORDS_PER_MINUTE = 200;
  
  /**
   * Estimate reading time for given text
   */
  static estimateReadingTime(text: string): number {
    const wordCount = this.countWords(text);
    return Math.max(1, Math.ceil(wordCount / this.WORDS_PER_MINUTE));
  }
  
  /**
   * Calculate target word count for desired reading time
   */
  static calculateTargetWordCount(targetMinutes: number): number {
    return Math.floor(targetMinutes * this.WORDS_PER_MINUTE);
  }
  
  /**
   * Count words in text
   */
  static countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }
  
  /**
   * Adjust content length to fit target reading time
   */
  static adjustContentLength(content: string, targetMinutes: number): string {
    const currentWordCount = this.countWords(content);
    const targetWordCount = this.calculateTargetWordCount(targetMinutes);
    
    if (currentWordCount <= targetWordCount) {
      return content;
    }
    
    // Truncate content to fit target word count
    const words = content.trim().split(/\s+/);
    const truncatedWords = words.slice(0, targetWordCount);
    
    // Ensure we end at a sentence boundary if possible
    let truncatedContent = truncatedWords.join(' ');
    const lastSentenceEnd = Math.max(
      truncatedContent.lastIndexOf('.'),
      truncatedContent.lastIndexOf('!'),
      truncatedContent.lastIndexOf('?')
    );
    
    if (lastSentenceEnd > truncatedContent.length * 0.8) {
      truncatedContent = truncatedContent.substring(0, lastSentenceEnd + 1);
    }
    
    return truncatedContent;
  }
  
  /**
   * Generate reading time summary for display
   */
  static generateReadingTimeSummary(text: string): {
    estimatedMinutes: number;
    wordCount: number;
    characterCount: number;
  } {
    return {
      estimatedMinutes: this.estimateReadingTime(text),
      wordCount: this.countWords(text),
      characterCount: text.length,
    };
  }
}