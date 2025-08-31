import { UserPreferences, SearchFilters, SearchResult, TextChunk, NewsArticle } from '@/types';
import { VectorStore, createVectorStore, VectorStoreConfig } from '@/lib/text-processing/vector-store';
import { PreferenceQueryConverter, createPreferenceQueryConverter } from './preference-query-converter';

/**
 * Configuration for semantic search functionality
 */
export interface SemanticSearchConfig {
  vectorStoreConfig?: Partial<VectorStoreConfig>;
  relevanceThreshold: number;
  maxResults: number;
  enableCategoryBoost: boolean;
  categoryBoostFactor: number;
  enableSourceBoost: boolean;
  sourceBoostFactor: number;
  enableRecencyBoost: boolean;
  recencyBoostDecayDays: number;
  fallbackToPopular: boolean;
}

/**
 * Default semantic search configuration
 */
export const DEFAULT_SEMANTIC_SEARCH_CONFIG: SemanticSearchConfig = {
  relevanceThreshold: 0.3,
  maxResults: 10,
  enableCategoryBoost: true,
  categoryBoostFactor: 1.2,
  enableSourceBoost: true,
  sourceBoostFactor: 1.1,
  enableRecencyBoost: true,
  recencyBoostDecayDays: 7,
  fallbackToPopular: true,
};

/**
 * Search result with enhanced scoring
 */
export interface EnhancedSearchResult extends SearchResult {
  baseRelevanceScore: number;
  categoryBoost: number;
  sourceBoost: number;
  recencyBoost: number;
  finalScore: number;
  matchedPreferences: string[];
}

/**
 * Search metrics for monitoring and optimization
 */
export interface SemanticSearchMetrics {
  queryProcessingTime: number;
  vectorSearchTime: number;
  scoringTime: number;
  totalTime: number;
  resultsFound: number;
  resultsAfterFiltering: number;
  fallbackUsed: boolean;
  averageRelevanceScore: number;
  topCategories: Array<{ category: string; count: number }>;
  topSources: Array<{ source: string; count: number }>;
}

/**
 * Semantic search service for personalized content discovery
 */
export class SemanticSearchService {
  private vectorStore: VectorStore;
  private queryConverter: PreferenceQueryConverter;
  private config: SemanticSearchConfig;

  constructor(config: Partial<SemanticSearchConfig> = {}) {
    this.config = { ...DEFAULT_SEMANTIC_SEARCH_CONFIG, ...config };
    this.vectorStore = createVectorStore(config.vectorStoreConfig);
    this.queryConverter = createPreferenceQueryConverter();
  }

  /**
   * Initialize the semantic search service
   */
  async initialize(): Promise<void> {
    await this.vectorStore.initialize();
  }

  /**
   * Search for relevant content based on user preferences
   */
  async searchByPreferences(
    preferences: UserPreferences,
    additionalFilters?: SearchFilters
  ): Promise<{
    results: EnhancedSearchResult[];
    metrics: SemanticSearchMetrics;
  }> {
    const startTime = Date.now();
    let fallbackUsed = false;

    try {
      // Convert preferences to query
      const queryStartTime = Date.now();
      const queryResult = await this.queryConverter.convertPreferencesToQuery(preferences);
      const queryProcessingTime = Date.now() - queryStartTime;

      // Prepare search filters
      const searchFilters = this.buildSearchFilters(preferences, additionalFilters);

      // Perform vector search
      const vectorSearchStartTime = Date.now();
      const searchResult = await this.vectorStore.searchSimilar(
        queryResult.queryEmbedding,
        searchFilters
      );
      const vectorSearchTime = Date.now() - vectorSearchStartTime;

      let results = searchResult.results;

      // If no results found and fallback is enabled, try fallback query
      if (results.length === 0 && this.config.fallbackToPopular) {
        const fallbackQuery = await this.queryConverter.generateFallbackQuery();
        const fallbackSearch = await this.vectorStore.searchSimilar(
          fallbackQuery.queryEmbedding,
          { ...searchFilters, minRelevanceScore: 0.1 }
        );
        results = fallbackSearch.results;
        fallbackUsed = true;
      }

      // Enhance results with personalized scoring
      const scoringStartTime = Date.now();
      const enhancedResults = this.enhanceSearchResults(
        results,
        preferences,
        queryResult.weightedTopics
      );
      const scoringTime = Date.now() - scoringStartTime;

      // Sort by final score and limit results
      const finalResults = enhancedResults
        .sort((a, b) => b.finalScore - a.finalScore)
        .slice(0, this.config.maxResults);

      const totalTime = Date.now() - startTime;

      const metrics: SemanticSearchMetrics = {
        queryProcessingTime,
        vectorSearchTime,
        scoringTime,
        totalTime,
        resultsFound: results.length,
        resultsAfterFiltering: finalResults.length,
        fallbackUsed,
        averageRelevanceScore: this.calculateAverageScore(finalResults),
        topCategories: this.getTopCategories(finalResults),
        topSources: this.getTopSources(finalResults),
      };

      return { results: finalResults, metrics };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new SemanticSearchError(`Semantic search failed: ${errorMessage}`);
    }
  }

  /**
   * Search for similar articles to a given article
   */
  async findSimilarArticles(
    articleId: string,
    limit: number = 5,
    excludeCategories?: string[]
  ): Promise<{
    results: SearchResult[];
    metrics: Pick<SemanticSearchMetrics, 'vectorSearchTime' | 'resultsFound'>;
  }> {
    const startTime = Date.now();

    try {
      // First, find the article chunks
      const allResults = await this.vectorStore.searchSimilar('', {
        minRelevanceScore: 0,
      });

      const articleChunks = allResults.results.filter(
        result => result.chunk.articleId === articleId
      );

      if (articleChunks.length === 0) {
        return {
          results: [],
          metrics: {
            vectorSearchTime: Date.now() - startTime,
            resultsFound: 0,
          },
        };
      }

      // Use the first chunk's embedding to find similar content
      const referenceChunk = articleChunks[0];
      const searchFilters: SearchFilters = {
        minRelevanceScore: this.config.relevanceThreshold,
      };

      if (excludeCategories && excludeCategories.length > 0) {
        // Get all categories except excluded ones
        const allCategories = ['technology', 'business', 'science', 'sports', 'politics', 'entertainment'];
        searchFilters.categories = allCategories.filter(cat => !excludeCategories.includes(cat));
      }

      const searchResult = await this.vectorStore.searchSimilar(
        referenceChunk.chunk.content,
        searchFilters
      );

      // Filter out chunks from the same article
      const similarResults = searchResult.results
        .filter(result => result.chunk.articleId !== articleId)
        .slice(0, limit);

      const vectorSearchTime = Date.now() - startTime;

      return {
        results: similarResults,
        metrics: {
          vectorSearchTime,
          resultsFound: similarResults.length,
        },
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new SemanticSearchError(`Similar articles search failed: ${errorMessage}`);
    }
  }

  /**
   * Get trending topics based on recent search patterns
   */
  async getTrendingTopics(
    timeWindowHours: number = 24,
    limit: number = 10
  ): Promise<Array<{ topic: string; score: number; articleCount: number }>> {
    try {
      // Get recent articles
      const recentDate = new Date(Date.now() - timeWindowHours * 60 * 60 * 1000);
      const searchResult = await this.vectorStore.searchSimilar('', {
        dateRange: { start: recentDate, end: new Date() },
        minRelevanceScore: 0,
      });

      // Analyze categories and sources to identify trends
      const categoryCount = new Map<string, number>();
      const topicKeywords = new Map<string, number>();

      for (const result of searchResult.results) {
        const category = result.chunk.metadata.category;
        categoryCount.set(category, (categoryCount.get(category) || 0) + 1);

        // Extract potential topic keywords from content
        const words = result.chunk.content
          .toLowerCase()
          .split(/\W+/)
          .filter(word => word.length > 3);

        for (const word of words) {
          topicKeywords.set(word, (topicKeywords.get(word) || 0) + 1);
        }
      }

      // Combine categories and keywords to create trending topics
      const trendingTopics: Array<{ topic: string; score: number; articleCount: number }> = [];

      // Add categories as topics
      for (const [category, count] of categoryCount.entries()) {
        trendingTopics.push({
          topic: category,
          score: count / searchResult.results.length,
          articleCount: count,
        });
      }

      // Add top keywords as topics
      const sortedKeywords = Array.from(topicKeywords.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, limit);

      for (const [keyword, count] of sortedKeywords) {
        if (count > 2) { // Only include keywords that appear multiple times
          trendingTopics.push({
            topic: keyword,
            score: count / searchResult.results.length,
            articleCount: count,
          });
        }
      }

      return trendingTopics
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new SemanticSearchError(`Trending topics analysis failed: ${errorMessage}`);
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<SemanticSearchConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.vectorStoreConfig) {
      this.vectorStore.updateConfig(newConfig.vectorStoreConfig);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): SemanticSearchConfig {
    return { ...this.config };
  }

  /**
   * Build search filters from user preferences
   */
  private buildSearchFilters(
    preferences: UserPreferences,
    additionalFilters?: SearchFilters
  ): SearchFilters {
    const filters: SearchFilters = {
      minRelevanceScore: this.config.relevanceThreshold,
    };

    // Apply preferred sources
    if (preferences.preferredSources && preferences.preferredSources.length > 0) {
      filters.sources = preferences.preferredSources;
    }

    // Exclude unwanted sources
    if (preferences.excludedSources && preferences.excludedSources.length > 0) {
      // If we have preferred sources, remove excluded ones from them
      if (filters.sources) {
        filters.sources = filters.sources.filter(
          source => !preferences.excludedSources.includes(source)
        );
      }
      // Note: FAISS doesn't support negative filtering directly,
      // so we'll handle excluded sources in post-processing
    }

    // Merge with additional filters
    if (additionalFilters) {
      return { ...filters, ...additionalFilters };
    }

    return filters;
  }

  /**
   * Enhance search results with personalized scoring
   */
  private enhanceSearchResults(
    results: SearchResult[],
    preferences: UserPreferences,
    weightedTopics: Array<{ topic: string; weight: number }>
  ): EnhancedSearchResult[] {
    return results.map(result => {
      const baseScore = result.relevanceScore;
      let categoryBoost = 1.0;
      let sourceBoost = 1.0;
      let recencyBoost = 1.0;
      const matchedPreferences: string[] = [];

      // Category boost
      if (this.config.enableCategoryBoost) {
        const categoryMatch = weightedTopics.find(
          topic => topic.topic.toLowerCase() === result.chunk.metadata.category.toLowerCase()
        );
        if (categoryMatch) {
          categoryBoost = this.config.categoryBoostFactor * categoryMatch.weight;
          matchedPreferences.push(`category:${result.chunk.metadata.category}`);
        }
      }

      // Source boost
      if (this.config.enableSourceBoost && preferences.preferredSources) {
        if (preferences.preferredSources.includes(result.chunk.metadata.source)) {
          sourceBoost = this.config.sourceBoostFactor;
          matchedPreferences.push(`source:${result.chunk.metadata.source}`);
        }
      }

      // Recency boost
      if (this.config.enableRecencyBoost) {
        const daysSincePublished = (Date.now() - result.chunk.metadata.publishedAt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSincePublished <= this.config.recencyBoostDecayDays) {
          recencyBoost = 1 + (1 - daysSincePublished / this.config.recencyBoostDecayDays) * 0.2;
        }
      }

      const finalScore = baseScore * categoryBoost * sourceBoost * recencyBoost;

      return {
        ...result,
        baseRelevanceScore: baseScore,
        categoryBoost,
        sourceBoost,
        recencyBoost,
        finalScore,
        matchedPreferences,
      };
    });
  }

  /**
   * Calculate average relevance score
   */
  private calculateAverageScore(results: EnhancedSearchResult[]): number {
    if (results.length === 0) return 0;
    const sum = results.reduce((acc, result) => acc + result.baseRelevanceScore, 0);
    return sum / results.length;
  }

  /**
   * Get top categories from results
   */
  private getTopCategories(results: EnhancedSearchResult[]): Array<{ category: string; count: number }> {
    const categoryCount = new Map<string, number>();
    
    for (const result of results) {
      const category = result.chunk.metadata.category;
      categoryCount.set(category, (categoryCount.get(category) || 0) + 1);
    }

    return Array.from(categoryCount.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  /**
   * Get top sources from results
   */
  private getTopSources(results: EnhancedSearchResult[]): Array<{ source: string; count: number }> {
    const sourceCount = new Map<string, number>();
    
    for (const result of results) {
      const source = result.chunk.metadata.source;
      sourceCount.set(source, (sourceCount.get(source) || 0) + 1);
    }

    return Array.from(sourceCount.entries())
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }
}

/**
 * Custom error class for semantic search operations
 */
export class SemanticSearchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SemanticSearchError';
  }
}

/**
 * Factory function to create a semantic search service
 */
export function createSemanticSearchService(
  config?: Partial<SemanticSearchConfig>
): SemanticSearchService {
  return new SemanticSearchService(config);
}

/**
 * Utility function to create and initialize a semantic search service
 */
export async function createAndInitializeSemanticSearchService(
  config?: Partial<SemanticSearchConfig>
): Promise<SemanticSearchService> {
  const service = createSemanticSearchService(config);
  await service.initialize();
  return service;
}

/**
 * Utility function to search by preferences with default settings
 */
export async function searchByPreferences(
  preferences: UserPreferences,
  additionalFilters?: SearchFilters
): Promise<EnhancedSearchResult[]> {
  const service = createSemanticSearchService();
  await service.initialize();
  const result = await service.searchByPreferences(preferences, additionalFilters);
  return result.results;
}