/**
 * Hugging Face Transformers Client
 * Free alternative to OpenAI API
 */

import axios, { AxiosInstance } from 'axios';

export interface HuggingFaceConfig {
  apiKey: string;
  baseUrl: string;
  timeout: number;
  maxRetries: number;
}

export interface GenerationParams {
  inputs: string;
  parameters?: {
    max_length?: number;
    min_length?: number;
    temperature?: number;
    top_p?: number;
    top_k?: number;
    repetition_penalty?: number;
    do_sample?: boolean;
    return_full_text?: boolean;
  };
  options?: {
    wait_for_model?: boolean;
    use_cache?: boolean;
  };
}

export interface EmbeddingParams {
  inputs: string | string[];
  options?: {
    wait_for_model?: boolean;
    use_cache?: boolean;
  };
}

export class HuggingFaceClient {
  private client: AxiosInstance;
  private config: HuggingFaceConfig;

  // Model endpoints
  private models = {
    // Text generation models
    textGeneration: 'microsoft/DialoGPT-medium',
    summarization: 'facebook/bart-large-cnn',
    
    // Embedding models
    embeddings: 'sentence-transformers/all-MiniLM-L6-v2',
    
    // Classification models
    sentiment: 'cardiffnlp/twitter-roberta-base-sentiment-latest',
    classification: 'facebook/bart-large-mnli'
  };

  constructor(config: Partial<HuggingFaceConfig> = {}) {
    this.config = {
      apiKey: process.env.HUGGINGFACE_API_KEY || '',
      baseUrl: 'https://api-inference.huggingface.co',
      timeout: 30000,
      maxRetries: 3,
      ...config
    };

    if (!this.config.apiKey) {
      throw new Error('Hugging Face API key is required');
    }

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Generate text completion
   */
  async generateText(prompt: string, params?: Partial<GenerationParams['parameters']>): Promise<string> {
    try {
      const response = await this.client.post(`/models/${this.models.textGeneration}`, {
        inputs: prompt,
        parameters: {
          max_length: 150,
          temperature: 0.7,
          do_sample: true,
          return_full_text: false,
          ...params
        },
        options: {
          wait_for_model: true,
          use_cache: true
        }
      });

      const result = response.data;
      if (Array.isArray(result) && result.length > 0) {
        return result[0].generated_text || '';
      }
      
      return '';
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Hugging Face API error: ${error.response?.data?.error || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Summarize text
   */
  async summarizeText(text: string, maxLength: number = 150, minLength: number = 30): Promise<string> {
    try {
      const response = await this.client.post(`/models/${this.models.summarization}`, {
        inputs: text,
        parameters: {
          max_length: maxLength,
          min_length: minLength,
          do_sample: false
        },
        options: {
          wait_for_model: true,
          use_cache: true
        }
      });

      const result = response.data;
      if (Array.isArray(result) && result.length > 0) {
        return result[0].summary_text || '';
      }
      
      return '';
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Hugging Face summarization error: ${error.response?.data?.error || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Generate embeddings
   */
  async generateEmbeddings(texts: string | string[]): Promise<number[][]> {
    try {
      const response = await this.client.post(`/models/${this.models.embeddings}`, {
        inputs: texts,
        options: {
          wait_for_model: true,
          use_cache: true
        }
      });

      const result = response.data;
      
      // Handle single text input
      if (typeof texts === 'string') {
        return [result];
      }
      
      // Handle array of texts
      return result;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Hugging Face embeddings error: ${error.response?.data?.error || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Analyze sentiment
   */
  async analyzeSentiment(text: string): Promise<{ label: string; score: number }> {
    try {
      const response = await this.client.post(`/models/${this.models.sentiment}`, {
        inputs: text,
        options: {
          wait_for_model: true,
          use_cache: true
        }
      });

      const result = response.data;
      if (Array.isArray(result) && result.length > 0 && Array.isArray(result[0])) {
        const topResult = result[0][0];
        return {
          label: topResult.label,
          score: topResult.score
        };
      }
      
      return { label: 'NEUTRAL', score: 0.5 };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Hugging Face sentiment error: ${error.response?.data?.error || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Classify text
   */
  async classifyText(text: string, labels: string[]): Promise<Array<{ label: string; score: number }>> {
    try {
      const response = await this.client.post(`/models/${this.models.classification}`, {
        inputs: text,
        parameters: {
          candidate_labels: labels
        },
        options: {
          wait_for_model: true,
          use_cache: true
        }
      });

      const result = response.data;
      if (result.labels && result.scores) {
        return result.labels.map((label: string, index: number) => ({
          label,
          score: result.scores[index]
        }));
      }
      
      return [];
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Hugging Face classification error: ${error.response?.data?.error || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Generate article summary with tone adaptation
   */
  async generateArticleSummary(
    article: string, 
    tone: 'formal' | 'casual' | 'fun' = 'casual',
    maxLength: number = 150
  ): Promise<string> {
    try {
      // First, get basic summary
      const basicSummary = await this.summarizeText(article, maxLength);
      
      if (!basicSummary) {
        return '';
      }

      // Then adapt tone if needed
      if (tone !== 'formal') {
        const tonePrompt = this.getTonePrompt(basicSummary, tone);
        const adaptedSummary = await this.generateText(tonePrompt, {
          max_length: maxLength + 50,
          temperature: tone === 'fun' ? 0.8 : 0.6
        });
        
        return adaptedSummary || basicSummary;
      }
      
      return basicSummary;
    } catch (error) {
      throw new Error(`Failed to generate article summary: ${(error as Error).message}`);
    }
  }

  /**
   * Get tone adaptation prompt
   */
  private getTonePrompt(summary: string, tone: 'casual' | 'fun'): string {
    const prompts = {
      casual: `Rewrite this news summary in a casual, conversational tone: "${summary}"`,
      fun: `Rewrite this news summary in a fun, engaging way with some personality: "${summary}"`
    };
    
    return prompts[tone];
  }

  /**
   * Check if API is available
   */
  async checkHealth(): Promise<boolean> {
    try {
      await this.generateText('Hello', { max_length: 10 });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get model information
   */
  getModels() {
    return { ...this.models };
  }

  /**
   * Update model for specific task
   */
  setModel(task: keyof typeof this.models, modelName: string): void {
    this.models[task] = modelName;
  }
}

// Default client instance
let defaultClient: HuggingFaceClient | null = null;

/**
 * Get or create default Hugging Face client
 */
export function getHuggingFaceClient(config?: Partial<HuggingFaceConfig>): HuggingFaceClient {
  if (!defaultClient) {
    defaultClient = new HuggingFaceClient(config);
  }
  return defaultClient;
}

/**
 * Generate text (convenience function)
 */
export async function generateText(prompt: string, params?: Partial<GenerationParams['parameters']>): Promise<string> {
  const client = getHuggingFaceClient();
  return client.generateText(prompt, params);
}

/**
 * Summarize text (convenience function)
 */
export async function summarizeText(text: string, maxLength?: number, minLength?: number): Promise<string> {
  const client = getHuggingFaceClient();
  return client.summarizeText(text, maxLength, minLength);
}

/**
 * Generate embeddings (convenience function)
 */
export async function generateEmbeddings(texts: string | string[]): Promise<number[][]> {
  const client = getHuggingFaceClient();
  return client.generateEmbeddings(texts);
}