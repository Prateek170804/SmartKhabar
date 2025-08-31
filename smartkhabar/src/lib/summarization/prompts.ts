/**
 * Summarization prompts for different tones and use cases
 */

export interface PromptTemplate {
  system: string;
  user: string;
}

export class SummarizationPrompts {
  /**
   * Get tone-specific summarization prompt
   */
  static getTonePrompt(tone: 'formal' | 'casual' | 'fun'): PromptTemplate {
    const baseInstructions = `You are an expert news summarizer. Create a concise, accurate summary that captures the key information and main points.`;
    
    switch (tone) {
      case 'formal':
        return {
          system: `${baseInstructions} Use a professional, objective tone. Write in third person. Use precise language and maintain journalistic standards.`,
          user: `Please summarize the following news article in a formal, professional tone. Focus on facts, key developments, and implications. Avoid casual language or personal opinions.

Article: {content}

Target reading time: {targetMinutes} minutes
Required format: Structured summary with key points`
        };
        
      case 'casual':
        return {
          system: `${baseInstructions} Use a conversational, approachable tone. Write as if explaining to a friend. Keep it engaging but informative.`,
          user: `Please summarize the following news article in a casual, conversational tone. Make it easy to understand and engaging, like you're telling a friend about what happened.

Article: {content}

Target reading time: {targetMinutes} minutes
Required format: Friendly summary with main takeaways`
        };
        
      case 'fun':
        return {
          system: `${baseInstructions} Use an engaging, lively tone with appropriate humor where suitable. Make it interesting and memorable while staying accurate.`,
          user: `Please summarize the following news article in a fun, engaging tone. Add some personality and make it interesting to read, but keep all the important facts accurate.

Article: {content}

Target reading time: {targetMinutes} minutes
Required format: Engaging summary with personality`
        };
        
      default:
        return this.getTonePrompt('casual');
    }
  }
  
  /**
   * Get key points extraction prompt
   */
  static getKeyPointsPrompt(): PromptTemplate {
    return {
      system: `You are an expert at extracting key information from news articles. Identify the most important points that readers need to know.`,
      user: `Extract 3-5 key points from the following news article. Each point should be a concise, standalone fact or development.

Article: {content}

Format your response as a JSON array of strings, like this:
["Key point 1", "Key point 2", "Key point 3"]`
    };
  }
  
  /**
   * Get topic consolidation prompt
   */
  static getConsolidationPrompt(): PromptTemplate {
    return {
      system: `You are an expert at consolidating multiple news articles about the same topic into a comprehensive summary.`,
      user: `Create a consolidated summary from these related news articles. Combine the information while avoiding redundancy. Highlight different perspectives or new developments.

Articles:
{articles}

Target reading time: {targetMinutes} minutes
Tone: {tone}

Create a unified summary that captures all important information from these sources.`
    };
  }
  
  /**
   * Get tone adaptation prompt
   */
  static getToneAdaptationPrompt(targetTone: 'formal' | 'casual' | 'fun'): PromptTemplate {
    const toneDescriptions = {
      formal: 'professional, objective, and precise',
      casual: 'conversational, friendly, and approachable',
      fun: 'engaging, lively, and entertaining while remaining accurate'
    };
    
    return {
      system: `You are an expert at adapting text tone while preserving all factual content and meaning.`,
      user: `Rewrite the following text to be ${toneDescriptions[targetTone]}. Keep all facts and key information exactly the same, only change the tone and style.

Original text: {content}

Rewrite this in a ${targetTone} tone.`
    };
  }
  
  /**
   * Format prompt with variables
   */
  static formatPrompt(template: PromptTemplate, variables: Record<string, string>): PromptTemplate {
    let formattedSystem = template.system;
    let formattedUser = template.user;
    
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{${key}}`;
      formattedSystem = formattedSystem.replace(new RegExp(placeholder, 'g'), value);
      formattedUser = formattedUser.replace(new RegExp(placeholder, 'g'), value);
    });
    
    return {
      system: formattedSystem,
      user: formattedUser
    };
  }
}