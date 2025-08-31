/**
 * Topic consolidation service for grouping similar articles and creating unified summaries
 * Handles duplicate detection, topic grouping, and consolidated summary generation
 */

import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { NewsArticle, Summary } from '../../types';
import { SummarizationPrompts } from './prompts';
import { ReadingTimeEstimator } from './reading-time-estimator';
import { ToneType } from './tone-adapter';

export interface TopicGroup {
  id: string;
  topic: string;
  articles: NewsArticle[];
  similarity: number; // 0-1 score indicating how similar articles are
  keywords: string[];
}

export interface ConsolidationRequest {
  articles: NewsArticle[];
  tone: ToneType;
  maxReadingTime: number;
  userId: string;
  similarityThreshold?: number; // Minimum similarity to group articles (default: 0.7)
}

export interface ConsolidatedSummary extends Summary {
  topicGroups: TopicGroup[];
  consolidatedArticleCount: number;
  duplicatesRemoved: number;
}

export class TopicConsolidator {
  private llm: ChatOpenAI;
  private readonly DEFAULT_SIMILARITY_THRESHOLD = 0.7;
  
  constructor() {
    if (!config.openai.apiKey) {
      throw new Error('OpenAI API key is required for topic consolidation');
    }
    
    this.llm = new ChatOpenAI({
      openAIApiKey: config.openai.apiKey,
      modelName: 'gpt-3.5-turbo',
      temperature: 0.2, // Lower temperature for consistent grouping
      maxTokens: 2000, // Higher limit for consolidated summaries
    });
  }
  
  /**
   * Consolidate articles by topic and generate unified summary
   */
  async consolidateTopics(request: ConsolidationRequest): Promise<ConsolidatedSummary> {
    try {
      // Remove duplicates first
      const { uniqueArticles, duplicatesRemoved } = this.removeDuplicates(request.articles);
      
      if (uniqueArticles.length === 0) {
        throw new Error('No unique articles to consolidate');
      }
      
      // Group articles by topic
      const topicGroups = await this.groupArticlesByTopic(
        uniqueArticles,
        request.similarityThreshold || this.DEFAULT_SIMILARITY_THRESHOLD
      );
      
      // Generate consolidated summary
      const consolidatedContent = await this.generateConsolidatedSummary(
        topicGroups,
        request.tone,
        request.maxReadingTime
      );
      
      // Extract key points from all groups
      const keyPoints = await this.extractConsolidatedKeyPoints(topicGroups);
      
      // Calculate reading time
      const estimatedReadingTime = ReadingTimeEstimator.estimateReadingTime(consolidatedContent);
      
      return {
        id: uuidv4(),
        content: consolidatedContent,
        keyPoints,
        sourceArticles: uniqueArticles.map(article => article.id),
        estimatedReadingTime,
        tone: request.tone,
        topicGroups,
        consolidatedArticleCount: uniqueArticles.length,
        duplicatesRemoved
      };
      
    } catch (error) {
      console.error('Error consolidating topics:', error);
      throw new Error(`Failed to consolidate topics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Remove duplicate articles based on content similarity
   */
  removeDuplicates(articles: NewsArticle[]): {
    uniqueArticles: NewsArticle[];
    duplicatesRemoved: number;
  } {
    const uniqueArticles: NewsArticle[] = [];
    const seenContent = new Set<string>();
    
    for (const article of articles) {
      // Create a normalized version of the content for comparison
      const normalizedContent = this.normalizeContentForComparison(article.content);
      const contentHash = this.generateContentHash(normalizedContent);
      
      if (!seenContent.has(contentHash)) {
        seenContent.add(contentHash);
        uniqueArticles.push(article);
      }
    }
    
    return {
      uniqueArticles,
      duplicatesRemoved: articles.length - uniqueArticles.length
    };
  }
  
  /**
   * Group articles by topic using AI-based similarity analysis
   */
  async groupArticlesByTopic(
    articles: NewsArticle[],
    similarityThreshold: number
  ): Promise<TopicGroup[]> {
    if (articles.length <= 1) {
      return articles.map(article => ({
        id: uuidv4(),
        topic: this.extractTopicFromArticle(article),
        articles: [article],
        similarity: 1.0,
        keywords: this.extractKeywords(article.content)
      }));
    }
    
    try {
      // Use AI to analyze and group articles
      const groupingAnalysis = await this.analyzeArticleGrouping(articles);
      
      // Parse the grouping results
      const groups = this.parseGroupingResults(groupingAnalysis, articles, similarityThreshold);
      
      return groups;
      
    } catch (error) {
      console.error('Error in AI grouping, falling back to basic grouping:', error);
      // Fallback to basic category-based grouping
      return this.basicTopicGrouping(articles);
    }
  }
  
  /**
   * Generate consolidated summary from topic groups
   */
  private async generateConsolidatedSummary(
    topicGroups: TopicGroup[],
    tone: ToneType,
    maxReadingTime: number
  ): Promise<string> {
    // Prepare articles data for the prompt
    const articlesData = topicGroups.map((group, index) => {
      const articlesText = group.articles.map(article => 
        `Title: ${article.headline}\nContent: ${article.content}`
      ).join('\n\n');
      
      return `Topic ${index + 1}: ${group.topic}\nKeywords: ${group.keywords.join(', ')}\n\nArticles:\n${articlesText}`;
    }).join('\n\n---\n\n');
    
    const promptTemplate = SummarizationPrompts.getConsolidationPrompt();
    const prompt = SummarizationPrompts.formatPrompt(promptTemplate, {
      articles: articlesData,
      targetMinutes: maxReadingTime.toString(),
      tone
    });
    
    const messages = [
      new SystemMessage(prompt.system),
      new HumanMessage(prompt.user)
    ];
    
    const response = await this.llm.invoke(messages);
    let consolidatedContent = response.content as string;
    
    // Adjust content length to fit reading time
    consolidatedContent = ReadingTimeEstimator.adjustContentLength(
      consolidatedContent,
      maxReadingTime
    );
    
    return consolidatedContent;
  }
  
  /**
   * Extract key points from all topic groups
   */
  private async extractConsolidatedKeyPoints(topicGroups: TopicGroup[]): Promise<string[]> {
    const allKeyPoints: string[] = [];
    
    for (const group of topicGroups) {
      // Add topic-specific key points
      allKeyPoints.push(`${group.topic}: ${group.articles.length} related articles`);
      
      // Add top keywords as key points
      if (group.keywords.length > 0) {
        allKeyPoints.push(`Key themes: ${group.keywords.slice(0, 3).join(', ')}`);
      }
    }
    
    // Limit to most important key points
    return allKeyPoints.slice(0, 6);
  }
  
  /**
   * Analyze article grouping using AI
   */
  private async analyzeArticleGrouping(articles: NewsArticle[]): Promise<string> {
    const articlesText = articles.map((article, index) => 
      `Article ${index + 1}:\nTitle: ${article.headline}\nCategory: ${article.category}\nContent: ${article.content.substring(0, 500)}...`
    ).join('\n\n');
    
    const prompt = {
      system: `You are an expert at analyzing news articles and identifying similar topics. Group articles that cover the same or closely related topics.`,
      user: `Analyze these news articles and group them by topic. Articles should be grouped together if they discuss the same event, person, company, or closely related themes.

${articlesText}

For each group, provide:
1. A descriptive topic name
2. The article numbers that belong to this group
3. A similarity score (0-1) indicating how closely related the articles are
4. 3-5 key keywords that represent the topic

Format your response as JSON:
{
  "groups": [
    {
      "topic": "Topic name",
      "articleIndices": [1, 3, 5],
      "similarity": 0.85,
      "keywords": ["keyword1", "keyword2", "keyword3"]
    }
  ]
}`
    };
    
    const messages = [
      new SystemMessage(prompt.system),
      new HumanMessage(prompt.user)
    ];
    
    const response = await this.llm.invoke(messages);
    return response.content as string;
  }
  
  /**
   * Parse AI grouping results
   */
  private parseGroupingResults(
    groupingAnalysis: string,
    articles: NewsArticle[],
    similarityThreshold: number
  ): TopicGroup[] {
    try {
      const parsed = JSON.parse(groupingAnalysis);
      const groups: TopicGroup[] = [];
      const usedArticleIndices = new Set<number>();
      
      for (const group of parsed.groups) {
        if (group.similarity >= similarityThreshold) {
          const groupArticles = group.articleIndices
            .filter((index: number) => index >= 1 && index <= articles.length && !usedArticleIndices.has(index))
            .map((index: number) => {
              usedArticleIndices.add(index);
              return articles[index - 1]; // Convert to 0-based index
            });
          
          if (groupArticles.length > 0) {
            groups.push({
              id: uuidv4(),
              topic: group.topic,
              articles: groupArticles,
              similarity: group.similarity,
              keywords: group.keywords || []
            });
          }
        }
      }
      
      // Add remaining articles as individual groups
      articles.forEach((article, index) => {
        if (!usedArticleIndices.has(index + 1)) {
          groups.push({
            id: uuidv4(),
            topic: this.extractTopicFromArticle(article),
            articles: [article],
            similarity: 1.0,
            keywords: this.extractKeywords(article.content)
          });
        }
      });
      
      return groups;
      
    } catch (error) {
      console.error('Error parsing grouping results:', error);
      return this.basicTopicGrouping(articles);
    }
  }
  
  /**
   * Basic topic grouping fallback based on categories
   */
  private basicTopicGrouping(articles: NewsArticle[]): TopicGroup[] {
    const categoryGroups = new Map<string, NewsArticle[]>();
    
    // Group by category
    articles.forEach(article => {
      const category = article.category || 'general';
      if (!categoryGroups.has(category)) {
        categoryGroups.set(category, []);
      }
      categoryGroups.get(category)!.push(article);
    });
    
    // Convert to TopicGroup format
    return Array.from(categoryGroups.entries()).map(([category, categoryArticles]) => ({
      id: uuidv4(),
      topic: this.formatCategoryName(category),
      articles: categoryArticles,
      similarity: 0.8, // Assume moderate similarity for same category
      keywords: this.extractCategoryKeywords(categoryArticles)
    }));
  }
  
  /**
   * Extract topic from single article
   */
  private extractTopicFromArticle(article: NewsArticle): string {
    // Use headline as topic, cleaned up
    return article.headline.length > 50 
      ? article.headline.substring(0, 50) + '...'
      : article.headline;
  }
  
  /**
   * Extract keywords from content
   */
  private extractKeywords(content: string): string[] {
    // Simple keyword extraction - in production, could use more sophisticated NLP
    const words = content.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 4)
      .filter(word => !this.isStopWord(word));
    
    // Count word frequency
    const wordCount = new Map<string, number>();
    words.forEach(word => {
      wordCount.set(word, (wordCount.get(word) || 0) + 1);
    });
    
    // Return top 5 most frequent words
    return Array.from(wordCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
  }
  
  /**
   * Check if word is a stop word
   */
  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'this', 'that', 'these', 'those', 'is', 'are', 'was', 'were', 'been', 'have',
      'has', 'had', 'will', 'would', 'could', 'should', 'may', 'might', 'can',
      'said', 'says', 'also', 'more', 'most', 'some', 'many', 'much', 'very'
    ]);
    return stopWords.has(word);
  }
  
  /**
   * Extract keywords from multiple articles in a category
   */
  private extractCategoryKeywords(articles: NewsArticle[]): string[] {
    const allContent = articles.map(article => article.content).join(' ');
    return this.extractKeywords(allContent);
  }
  
  /**
   * Format category name for display
   */
  private formatCategoryName(category: string): string {
    return category.charAt(0).toUpperCase() + category.slice(1).replace(/[-_]/g, ' ');
  }
  
  /**
   * Normalize content for duplicate detection
   */
  private normalizeContentForComparison(content: string): string {
    return content
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  /**
   * Generate hash for content comparison
   */
  private generateContentHash(content: string): string {
    // Simple hash function - in production, could use crypto.createHash
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }
  
  /**
   * Get consolidation statistics
   */
  getConsolidationStats(result: ConsolidatedSummary): {
    totalArticles: number;
    uniqueArticles: number;
    duplicatesRemoved: number;
    topicGroups: number;
    averageGroupSize: number;
  } {
    return {
      totalArticles: result.consolidatedArticleCount + result.duplicatesRemoved,
      uniqueArticles: result.consolidatedArticleCount,
      duplicatesRemoved: result.duplicatesRemoved,
      topicGroups: result.topicGroups.length,
      averageGroupSize: result.consolidatedArticleCount / result.topicGroups.length
    };
  }
}