/**
 * Main summarization service using Langchain
 * Handles article summarization with tone adaptation and reading time constraints
 */

import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { NewsArticle, Summary, SummaryRequest } from '../../types';
import { SummarizationPrompts } from './prompts';
import { ReadingTimeEstimator } from './reading-time-estimator';
import { ToneAdapter, ToneType } from './tone-adapter';
import { TopicConsolidator, ConsolidationRequest, ConsolidatedSummary } from './topic-consolidator';

export class SummarizationService {
  private llm: ChatOpenAI;
  private toneAdapter: ToneAdapter;
  private topicConsolidator: TopicConsolidator;
  
  constructor() {
    if (!config.openai.apiKey) {
      throw new Error('OpenAI API key is required for summarization service');
    }
    
    this.llm = new ChatOpenAI({
      openAIApiKey: config.openai.apiKey,
      modelName: 'gpt-3.5-turbo',
      temperature: 0.3, // Lower temperature for more consistent summaries
      maxTokens: 1000, // Reasonable limit for summaries
    });
    
    this.toneAdapter = new ToneAdapter();
    this.topicConsolidator = new TopicConsolidator();
  }
  
  /**
   * Generate summary from articles
   */
  async generateSummary(request: SummaryRequest): Promise<Summary> {
    try {
      // Combine articles if multiple
      const combinedContent = this.combineArticles(request.articles);
      
      // Get tone-specific prompt
      const promptTemplate = SummarizationPrompts.getTonePrompt(request.tone as 'formal' | 'casual' | 'fun');
      const prompt = SummarizationPrompts.formatPrompt(promptTemplate, {
        content: combinedContent,
        targetMinutes: request.maxReadingTime.toString()
      });
      
      // Generate summary
      const messages = [
        new SystemMessage(prompt.system),
        new HumanMessage(prompt.user)
      ];
      
      const response = await this.llm.invoke(messages);
      let summaryContent = response.content as string;
      
      // Adjust content length to fit reading time
      summaryContent = ReadingTimeEstimator.adjustContentLength(
        summaryContent,
        request.maxReadingTime
      );
      
      // Extract key points
      const keyPoints = await this.extractKeyPoints(combinedContent);
      
      // Calculate actual reading time
      const actualReadingTime = ReadingTimeEstimator.estimateReadingTime(summaryContent);
      
      return {
        id: uuidv4(),
        content: summaryContent,
        keyPoints,
        sourceArticles: request.articles.map(article => article.id),
        estimatedReadingTime: actualReadingTime,
        tone: request.tone
      };
      
    } catch (error) {
      console.error('Error generating summary:', error);
      throw new Error(`Failed to generate summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Generate summary for single article
   */
  async generateSingleArticleSummary(
    article: NewsArticle,
    tone: 'formal' | 'casual' | 'fun' = 'casual',
    maxReadingTime: number = 5
  ): Promise<Summary> {
    return this.generateSummary({
      articles: [article],
      tone,
      maxReadingTime,
      userId: 'system' // Default for single article summaries
    });
  }
  
  /**
   * Extract key points from content
   */
  private async extractKeyPoints(content: string): Promise<string[]> {
    try {
      const promptTemplate = SummarizationPrompts.getKeyPointsPrompt();
      const prompt = SummarizationPrompts.formatPrompt(promptTemplate, { content });
      
      const messages = [
        new SystemMessage(prompt.system),
        new HumanMessage(prompt.user)
      ];
      
      const response = await this.llm.invoke(messages);
      const responseText = response.content as string;
      
      // Parse JSON response
      try {
        const keyPoints = JSON.parse(responseText);
        return Array.isArray(keyPoints) ? keyPoints : [];
      } catch (parseError) {
        // Fallback: extract points from text
        return this.extractKeyPointsFromText(responseText);
      }
      
    } catch (error) {
      console.error('Error extracting key points:', error);
      // Return empty array as fallback
      return [];
    }
  }
  
  /**
   * Fallback method to extract key points from text
   */
  private extractKeyPointsFromText(text: string): string[] {
    // Look for numbered lists, bullet points, or line breaks
    const lines = text.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .filter(line => !line.startsWith('[') && !line.startsWith('{')) // Filter out JSON artifacts
      .slice(0, 5); // Limit to 5 points
    
    return lines.length > 0 ? lines : ['Key information extracted from the article'];
  }
  
  /**
   * Combine multiple articles into single content
   */
  private combineArticles(articles: NewsArticle[]): string {
    if (articles.length === 1) {
      return `Title: ${articles[0].headline}\n\nContent: ${articles[0].content}`;
    }
    
    return articles.map((article, index) => 
      `Article ${index + 1} - ${article.source}:\nTitle: ${article.headline}\nContent: ${article.content}`
    ).join('\n\n---\n\n');
  }
  
  /**
   * Validate summary quality
   */
  private validateSummary(summary: Summary, originalContent: string): boolean {
    // Basic validation checks
    if (!summary.content || summary.content.length < 50) {
      return false;
    }
    
    if (summary.keyPoints.length === 0) {
      return false;
    }
    
    // Check if summary is not just a copy of original
    const similarity = this.calculateTextSimilarity(summary.content, originalContent);
    if (similarity > 0.9) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Calculate basic text similarity (simplified)
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }
  
  /**
   * Adapt existing summary to a different tone
   */
  async adaptSummaryTone(
    summary: Summary,
    targetTone: ToneType,
    preserveLength: boolean = true
  ): Promise<Summary> {
    try {
      const adaptationResult = await this.toneAdapter.adaptTone({
        content: summary.content,
        sourceTone: summary.tone as ToneType,
        targetTone,
        preserveLength
      });
      
      // Also adapt key points if they exist
      let adaptedKeyPoints = summary.keyPoints;
      if (summary.keyPoints.length > 0) {
        const keyPointsResults = await this.toneAdapter.batchAdaptTone(
          summary.keyPoints,
          summary.tone as ToneType,
          targetTone,
          true
        );
        adaptedKeyPoints = keyPointsResults.map(result => result.adaptedContent);
      }
      
      return {
        ...summary,
        id: uuidv4(), // New ID for adapted summary
        content: adaptationResult.adaptedContent,
        keyPoints: adaptedKeyPoints,
        tone: targetTone,
        estimatedReadingTime: ReadingTimeEstimator.estimateReadingTime(adaptationResult.adaptedContent)
      };
      
    } catch (error) {
      console.error('Error adapting summary tone:', error);
      throw new Error(`Failed to adapt summary tone: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Validate tone consistency of a summary
   */
  async validateSummaryTone(summary: Summary): Promise<number> {
    return this.toneAdapter.validateToneConsistency(
      summary.content,
      summary.tone as ToneType
    );
  }
  
  /**
   * Get tone characteristics for guidance
   */
  getToneCharacteristics(tone: ToneType) {
    return this.toneAdapter.getToneCharacteristics(tone);
  }
  
  /**
   * Generate consolidated summary from multiple articles with topic grouping
   */
  async generateConsolidatedSummary(request: ConsolidationRequest): Promise<ConsolidatedSummary> {
    return this.topicConsolidator.consolidateTopics(request);
  }
  
  /**
   * Generate consolidated summary with automatic duplicate removal and topic grouping
   */
  async generateSmartSummary(
    articles: NewsArticle[],
    tone: ToneType = 'casual',
    maxReadingTime: number = 5,
    userId: string = 'system',
    similarityThreshold: number = 0.7
  ): Promise<ConsolidatedSummary> {
    const consolidationRequest: ConsolidationRequest = {
      articles,
      tone,
      maxReadingTime,
      userId,
      similarityThreshold
    };
    
    return this.generateConsolidatedSummary(consolidationRequest);
  }
  
  /**
   * Get consolidation statistics for analysis
   */
  getConsolidationStats(result: ConsolidatedSummary) {
    return this.topicConsolidator.getConsolidationStats(result);
  }
  
  /**
   * Get fallback summary when AI generation fails
   */
  getFallbackSummary(articles: NewsArticle[], tone: string): Summary {
    const firstArticle = articles[0];
    const content = firstArticle.content.substring(0, 500) + '...';
    
    return {
      id: uuidv4(),
      content: `${firstArticle.headline}\n\n${content}`,
      keyPoints: [
        'Original article content (AI summarization unavailable)',
        `Source: ${firstArticle.source}`,
        `Published: ${firstArticle.publishedAt.toLocaleDateString()}`
      ],
      sourceArticles: articles.map(article => article.id),
      estimatedReadingTime: ReadingTimeEstimator.estimateReadingTime(content),
      tone
    };
  }
}