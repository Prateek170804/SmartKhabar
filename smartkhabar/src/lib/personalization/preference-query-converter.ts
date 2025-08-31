import { UserPreferences } from '@/types';
import { EmbeddingService, createEmbeddingService } from '@/lib/text-processing/embedding-service';

/**
 * Configuration for preference to query conversion
 */
export interface PreferenceQueryConfig {
  topicWeight: number;
  sourceWeight: number;
  fallbackTopics: string[];
  maxQueryLength: number;
  embeddingService?: EmbeddingService;
}

/**
 * Default configuration for preference query conversion
 */
export const DEFAULT_PREFERENCE_QUERY_CONFIG: PreferenceQueryConfig = {
  topicWeight: 0.7,
  sourceWeight: 0.3,
  fallbackTopics: ['general news', 'current events', 'breaking news'],
  maxQueryLength: 500,
};

/**
 * Result of preference to query conversion
 */
export interface PreferenceQueryResult {
  queryText: string;
  queryEmbedding: number[];
  weightedTopics: Array<{ topic: string; weight: number }>;
  fallbackUsed: boolean;
  processingTime: number;
}

/**
 * Service for converting user preferences into embedding queries
 */
export class PreferenceQueryConverter {
  private embeddingService: EmbeddingService;
  private config: PreferenceQueryConfig;

  constructor(config: Partial<PreferenceQueryConfig> = {}) {
    this.config = { ...DEFAULT_PREFERENCE_QUERY_CONFIG, ...config };
    this.embeddingService = config.embeddingService || createEmbeddingService();
  }

  /**
   * Convert user preferences into an embedding query
   */
  async convertPreferencesToQuery(preferences: UserPreferences): Promise<PreferenceQueryResult> {
    const startTime = Date.now();
    
    // Build weighted query text from preferences
    const queryComponents = this.buildQueryComponents(preferences);
    const queryText = this.constructQueryText(queryComponents);
    
    // Generate embedding for the query
    const queryEmbedding = await this.embeddingService.embedQuery(queryText);
    
    const processingTime = Date.now() - startTime;
    
    return {
      queryText,
      queryEmbedding,
      weightedTopics: queryComponents.weightedTopics,
      fallbackUsed: queryComponents.fallbackUsed,
      processingTime,
    };
  }

  /**
   * Convert multiple user preferences into batch queries
   */
  async convertBatchPreferencesToQueries(
    preferencesArray: UserPreferences[]
  ): Promise<PreferenceQueryResult[]> {
    const results: PreferenceQueryResult[] = [];
    
    for (const preferences of preferencesArray) {
      const result = await this.convertPreferencesToQuery(preferences);
      results.push(result);
    }
    
    return results;
  }

  /**
   * Generate fallback query for users without preferences
   */
  async generateFallbackQuery(): Promise<PreferenceQueryResult> {
    const startTime = Date.now();
    
    const queryText = this.config.fallbackTopics.join(' ');
    const queryEmbedding = await this.embeddingService.embedQuery(queryText);
    
    const processingTime = Date.now() - startTime;
    
    return {
      queryText,
      queryEmbedding,
      weightedTopics: this.config.fallbackTopics.map(topic => ({ topic, weight: 1.0 })),
      fallbackUsed: true,
      processingTime,
    };
  }

  /**
   * Update topic weights based on user interaction history
   */
  calculateTopicWeights(
    topics: string[],
    interactionHistory?: Array<{ topic: string; positiveInteractions: number; totalInteractions: number }>
  ): Array<{ topic: string; weight: number }> {
    if (!interactionHistory || interactionHistory.length === 0) {
      // Equal weights for all topics if no interaction history
      return topics.map(topic => ({ topic, weight: 1.0 }));
    }
    
    const weightedTopics: Array<{ topic: string; weight: number }> = [];
    
    for (const topic of topics) {
      const interaction = interactionHistory.find(h => h.topic === topic);
      
      if (interaction && interaction.totalInteractions > 0) {
        // Calculate weight based on positive interaction ratio
        const positiveRatio = interaction.positiveInteractions / interaction.totalInteractions;
        // Scale weight between 0.1 and 2.0 based on positive interactions
        const weight = 0.1 + (positiveRatio * 1.9);
        weightedTopics.push({ topic, weight });
      } else {
        // Default weight for topics without interaction history
        weightedTopics.push({ topic, weight: 1.0 });
      }
    }
    
    return weightedTopics;
  }

  /**
   * Validate and sanitize user preferences before conversion
   */
  validatePreferences(preferences: UserPreferences): {
    isValid: boolean;
    sanitizedPreferences: UserPreferences;
    issues: string[];
  } {
    const issues: string[] = [];
    const sanitized = { ...preferences };
    
    // Validate topics
    if (!preferences.topics || preferences.topics.length === 0) {
      issues.push('No topics specified, will use fallback');
      sanitized.topics = [];
    } else {
      // Remove empty or invalid topics
      sanitized.topics = preferences.topics
        .filter(topic => typeof topic === 'string' && topic.trim().length > 0)
        .map(topic => topic.trim().toLowerCase());
      
      if (sanitized.topics.length === 0) {
        issues.push('All topics were invalid, will use fallback');
      }
    }
    
    // Validate tone
    if (!['formal', 'casual', 'fun'].includes(preferences.tone)) {
      issues.push(`Invalid tone "${preferences.tone}", using default "casual"`);
      sanitized.tone = 'casual';
    }
    
    // Validate reading time
    if (preferences.readingTime < 1 || preferences.readingTime > 15) {
      issues.push(`Invalid reading time ${preferences.readingTime}, using default 5 minutes`);
      sanitized.readingTime = 5;
    }
    
    // Validate sources
    if (preferences.preferredSources) {
      sanitized.preferredSources = preferences.preferredSources
        .filter(source => typeof source === 'string' && source.trim().length > 0)
        .map(source => source.trim().toLowerCase());
    }
    
    if (preferences.excludedSources) {
      sanitized.excludedSources = preferences.excludedSources
        .filter(source => typeof source === 'string' && source.trim().length > 0)
        .map(source => source.trim().toLowerCase());
    }
    
    return {
      isValid: issues.length === 0,
      sanitizedPreferences: sanitized,
      issues,
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): PreferenceQueryConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<PreferenceQueryConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.embeddingService) {
      this.embeddingService = newConfig.embeddingService;
    }
  }

  /**
   * Build query components from user preferences
   */
  private buildQueryComponents(preferences: UserPreferences): {
    weightedTopics: Array<{ topic: string; weight: number }>;
    queryParts: string[];
    fallbackUsed: boolean;
  } {
    const validation = this.validatePreferences(preferences);
    const sanitized = validation.sanitizedPreferences;
    
    let weightedTopics: Array<{ topic: string; weight: number }>;
    let fallbackUsed = false;
    
    if (sanitized.topics.length === 0) {
      // Use fallback topics
      weightedTopics = this.config.fallbackTopics.map(topic => ({ topic, weight: 1.0 }));
      fallbackUsed = true;
    } else {
      // Use user's topics with equal weights (interaction-based weighting will be added later)
      weightedTopics = this.calculateTopicWeights(sanitized.topics);
    }
    
    // Build query parts
    const queryParts: string[] = [];
    
    // Add weighted topics
    for (const { topic, weight } of weightedTopics) {
      // Repeat topics based on weight to emphasize them in the query
      const repetitions = Math.max(1, Math.round(weight * this.config.topicWeight * 3));
      for (let i = 0; i < repetitions; i++) {
        queryParts.push(topic);
      }
    }
    
    // Add preferred sources with lower weight
    if (sanitized.preferredSources && sanitized.preferredSources.length > 0) {
      const sourceWeight = Math.round(this.config.sourceWeight * 2);
      for (let i = 0; i < sourceWeight; i++) {
        queryParts.push(...sanitized.preferredSources);
      }
    }
    
    return {
      weightedTopics,
      queryParts,
      fallbackUsed,
    };
  }

  /**
   * Construct final query text from components
   */
  private constructQueryText(components: {
    weightedTopics: Array<{ topic: string; weight: number }>;
    queryParts: string[];
    fallbackUsed: boolean;
  }): string {
    // Join query parts and limit length
    let queryText = components.queryParts.join(' ');
    
    if (queryText.length > this.config.maxQueryLength) {
      queryText = queryText.substring(0, this.config.maxQueryLength).trim();
      
      // Ensure we don't cut off in the middle of a word
      const lastSpaceIndex = queryText.lastIndexOf(' ');
      if (lastSpaceIndex > this.config.maxQueryLength * 0.8) {
        queryText = queryText.substring(0, lastSpaceIndex);
      }
    }
    
    return queryText || this.config.fallbackTopics.join(' ');
  }
}

/**
 * Factory function to create a preference query converter
 */
export function createPreferenceQueryConverter(
  config?: Partial<PreferenceQueryConfig>
): PreferenceQueryConverter {
  return new PreferenceQueryConverter(config);
}

/**
 * Utility function to convert preferences to query with default settings
 */
export async function convertPreferencesToQuery(
  preferences: UserPreferences
): Promise<PreferenceQueryResult> {
  const converter = createPreferenceQueryConverter();
  return converter.convertPreferencesToQuery(preferences);
}

/**
 * Utility function to generate fallback query
 */
export async function generateFallbackQuery(): Promise<PreferenceQueryResult> {
  const converter = createPreferenceQueryConverter();
  return converter.generateFallbackQuery();
}