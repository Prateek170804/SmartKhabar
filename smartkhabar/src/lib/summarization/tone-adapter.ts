/**
 * Tone adaptation service for converting content between different tones
 * Handles formal, casual, and fun tone conversions
 */

import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { config } from '../config';
import { SummarizationPrompts } from './prompts';

export type ToneType = 'formal' | 'casual' | 'fun';

export interface ToneAdaptationRequest {
  content: string;
  sourceTone: ToneType;
  targetTone: ToneType;
  preserveLength?: boolean;
}

export interface ToneAdaptationResult {
  adaptedContent: string;
  sourceTone: ToneType;
  targetTone: ToneType;
  consistencyScore: number; // 0-1 score indicating tone consistency
}

export class ToneAdapter {
  private llm: ChatOpenAI;
  
  constructor() {
    if (!config.openai.apiKey) {
      throw new Error('OpenAI API key is required for tone adaptation');
    }
    
    this.llm = new ChatOpenAI({
      openAIApiKey: config.openai.apiKey,
      modelName: 'gpt-3.5-turbo',
      temperature: 0.4, // Slightly higher for creative tone adaptation
      maxTokens: 1500,
    });
  }
  
  /**
   * Adapt content from one tone to another
   */
  async adaptTone(request: ToneAdaptationRequest): Promise<ToneAdaptationResult> {
    try {
      // If source and target tones are the same, return original content
      if (request.sourceTone === request.targetTone) {
        return {
          adaptedContent: request.content,
          sourceTone: request.sourceTone,
          targetTone: request.targetTone,
          consistencyScore: 1.0
        };
      }
      
      // Get tone adaptation prompt
      const promptTemplate = SummarizationPrompts.getToneAdaptationPrompt(request.targetTone);
      const prompt = SummarizationPrompts.formatPrompt(promptTemplate, {
        content: request.content
      });
      
      // Add length preservation instruction if requested
      if (request.preserveLength) {
        prompt.user += '\n\nIMPORTANT: Keep the adapted content approximately the same length as the original.';
      }
      
      // Generate adapted content
      const messages = [
        new SystemMessage(prompt.system),
        new HumanMessage(prompt.user)
      ];
      
      const response = await this.llm.invoke(messages);
      const adaptedContent = response.content as string;
      
      // Validate tone consistency
      const consistencyScore = await this.validateToneConsistency(
        adaptedContent,
        request.targetTone
      );
      
      return {
        adaptedContent,
        sourceTone: request.sourceTone,
        targetTone: request.targetTone,
        consistencyScore
      };
      
    } catch (error) {
      console.error('Error adapting tone:', error);
      throw new Error(`Failed to adapt tone: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Batch adapt multiple content pieces to the same tone
   */
  async batchAdaptTone(
    contents: string[],
    sourceTone: ToneType,
    targetTone: ToneType,
    preserveLength: boolean = false
  ): Promise<ToneAdaptationResult[]> {
    const adaptationPromises = contents.map(content =>
      this.adaptTone({
        content,
        sourceTone,
        targetTone,
        preserveLength
      })
    );
    
    return Promise.all(adaptationPromises);
  }
  
  /**
   * Validate tone consistency of content
   */
  async validateToneConsistency(content: string, expectedTone: ToneType): Promise<number> {
    try {
      const validationPrompt = this.getToneValidationPrompt(expectedTone);
      const prompt = SummarizationPrompts.formatPrompt(validationPrompt, { content });
      
      const messages = [
        new SystemMessage(prompt.system),
        new HumanMessage(prompt.user)
      ];
      
      const response = await this.llm.invoke(messages);
      const responseText = response.content as string;
      
      // Parse the score from the response
      const scoreMatch = responseText.match(/(\d+(?:\.\d+)?)/);
      if (scoreMatch) {
        const score = parseFloat(scoreMatch[1]);
        return Math.min(Math.max(score / 10, 0), 1); // Normalize to 0-1 range
      }
      
      // Fallback: basic keyword-based validation
      return this.basicToneValidation(content, expectedTone);
      
    } catch (error) {
      console.error('Error validating tone consistency:', error);
      // Return basic validation as fallback
      return this.basicToneValidation(content, expectedTone);
    }
  }
  
  /**
   * Get tone validation prompt
   */
  private getToneValidationPrompt(expectedTone: ToneType): { system: string; user: string } {
    const toneDescriptions = {
      formal: 'professional, objective, precise, and uses formal language structures',
      casual: 'conversational, friendly, approachable, and uses everyday language',
      fun: 'engaging, lively, entertaining, and uses creative language while remaining informative'
    };
    
    return {
      system: `You are an expert at evaluating text tone and style. Rate how well the text matches the expected tone on a scale of 1-10.`,
      user: `Evaluate how well the following text matches a ${expectedTone} tone. A ${expectedTone} tone should be ${toneDescriptions[expectedTone]}.

Text to evaluate: {content}

Rate the tone consistency on a scale of 1-10, where:
- 1-3: Does not match the expected tone at all
- 4-6: Partially matches the expected tone
- 7-8: Mostly matches the expected tone
- 9-10: Perfectly matches the expected tone

Provide only the numerical score (e.g., "7.5").`
    };
  }
  
  /**
   * Basic tone validation using keyword analysis
   */
  private basicToneValidation(content: string, expectedTone: ToneType): number {
    const lowerContent = content.toLowerCase();
    
    const toneIndicators = {
      formal: {
        positive: ['furthermore', 'therefore', 'consequently', 'moreover', 'nevertheless', 'accordingly'],
        negative: ['gonna', 'wanna', 'yeah', 'cool', 'awesome', 'hey']
      },
      casual: {
        positive: ['you', 'your', 'we', 'our', 'let\'s', 'here\'s', 'that\'s', 'it\'s'],
        negative: ['furthermore', 'consequently', 'nevertheless', 'henceforth', 'wherein']
      },
      fun: {
        positive: ['amazing', 'awesome', 'cool', 'wow', 'exciting', 'fantastic', '!'],
        negative: ['pursuant', 'aforementioned', 'heretofore', 'notwithstanding']
      }
    };
    
    const indicators = toneIndicators[expectedTone];
    let score = 0.5; // Base score
    
    // Check positive indicators
    const positiveMatches = indicators.positive.filter(word => 
      lowerContent.includes(word)
    ).length;
    
    // Check negative indicators
    const negativeMatches = indicators.negative.filter(word => 
      lowerContent.includes(word)
    ).length;
    
    // Adjust score based on matches
    score += (positiveMatches * 0.1) - (negativeMatches * 0.15);
    
    return Math.min(Math.max(score, 0), 1);
  }
  
  /**
   * Get tone characteristics for analysis
   */
  getToneCharacteristics(tone: ToneType): {
    description: string;
    keyFeatures: string[];
    avoidFeatures: string[];
  } {
    const characteristics = {
      formal: {
        description: 'Professional, objective, and precise communication',
        keyFeatures: [
          'Third-person perspective',
          'Complete sentences',
          'Technical vocabulary when appropriate',
          'Structured presentation',
          'Objective language'
        ],
        avoidFeatures: [
          'Contractions',
          'Slang or colloquialisms',
          'Personal opinions',
          'Casual expressions',
          'Incomplete sentences'
        ]
      },
      casual: {
        description: 'Conversational, friendly, and approachable communication',
        keyFeatures: [
          'Second-person perspective (you/your)',
          'Contractions and natural speech patterns',
          'Everyday vocabulary',
          'Personal connection',
          'Approachable tone'
        ],
        avoidFeatures: [
          'Overly formal language',
          'Complex sentence structures',
          'Technical jargon without explanation',
          'Distant or cold tone',
          'Excessive formality'
        ]
      },
      fun: {
        description: 'Engaging, lively, and entertaining communication',
        keyFeatures: [
          'Enthusiastic language',
          'Creative expressions',
          'Engaging storytelling',
          'Appropriate humor',
          'Dynamic vocabulary'
        ],
        avoidFeatures: [
          'Dry or boring presentation',
          'Overly serious tone',
          'Monotonous language',
          'Lack of personality',
          'Purely factual delivery'
        ]
      }
    };
    
    return characteristics[tone];
  }
}