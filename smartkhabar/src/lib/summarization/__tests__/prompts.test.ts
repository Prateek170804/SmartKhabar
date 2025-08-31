/**
 * Unit tests for SummarizationPrompts
 */

import { describe, it, expect } from 'vitest';
import { SummarizationPrompts } from '../prompts';

describe('SummarizationPrompts', () => {
  describe('getTonePrompt', () => {
    it('should return formal tone prompt', () => {
      const prompt = SummarizationPrompts.getTonePrompt('formal');
      
      expect(prompt.system).toContain('professional');
      expect(prompt.system).toContain('objective');
      expect(prompt.user).toContain('formal');
      expect(prompt.user).toContain('{content}');
      expect(prompt.user).toContain('{targetMinutes}');
    });

    it('should return casual tone prompt', () => {
      const prompt = SummarizationPrompts.getTonePrompt('casual');
      
      expect(prompt.system).toContain('conversational');
      expect(prompt.system).toContain('approachable');
      expect(prompt.user).toContain('casual');
      expect(prompt.user).toContain('friend');
    });

    it('should return fun tone prompt', () => {
      const prompt = SummarizationPrompts.getTonePrompt('fun');
      
      expect(prompt.system).toContain('engaging');
      expect(prompt.system).toContain('lively');
      expect(prompt.user).toContain('fun');
      expect(prompt.user).toContain('personality');
    });

    it('should default to casual for unknown tone', () => {
      const prompt = SummarizationPrompts.getTonePrompt('unknown' as any);
      const casualPrompt = SummarizationPrompts.getTonePrompt('casual');
      
      expect(prompt).toEqual(casualPrompt);
    });
  });

  describe('getKeyPointsPrompt', () => {
    it('should return key points extraction prompt', () => {
      const prompt = SummarizationPrompts.getKeyPointsPrompt();
      
      expect(prompt.system).toContain('key information');
      expect(prompt.user).toContain('3-5 key points');
      expect(prompt.user).toContain('JSON array');
      expect(prompt.user).toContain('{content}');
    });
  });

  describe('getConsolidationPrompt', () => {
    it('should return consolidation prompt', () => {
      const prompt = SummarizationPrompts.getConsolidationPrompt();
      
      expect(prompt.system).toContain('consolidating');
      expect(prompt.system).toContain('multiple news articles');
      expect(prompt.user).toContain('{articles}');
      expect(prompt.user).toContain('{targetMinutes}');
      expect(prompt.user).toContain('{tone}');
    });
  });

  describe('getToneAdaptationPrompt', () => {
    it('should return formal adaptation prompt', () => {
      const prompt = SummarizationPrompts.getToneAdaptationPrompt('formal');
      
      expect(prompt.system).toContain('adapting text tone');
      expect(prompt.user).toContain('professional, objective, and precise');
      expect(prompt.user).toContain('{content}');
    });

    it('should return casual adaptation prompt', () => {
      const prompt = SummarizationPrompts.getToneAdaptationPrompt('casual');
      
      expect(prompt.user).toContain('conversational, friendly, and approachable');
    });

    it('should return fun adaptation prompt', () => {
      const prompt = SummarizationPrompts.getToneAdaptationPrompt('fun');
      
      expect(prompt.user).toContain('engaging, lively, and entertaining');
    });
  });

  describe('formatPrompt', () => {
    it('should replace variables in prompt template', () => {
      const template = {
        system: 'System prompt with {variable1}',
        user: 'User prompt with {variable1} and {variable2}'
      };

      const variables = {
        variable1: 'test value 1',
        variable2: 'test value 2'
      };

      const result = SummarizationPrompts.formatPrompt(template, variables);

      expect(result.system).toBe('System prompt with test value 1');
      expect(result.user).toBe('User prompt with test value 1 and test value 2');
    });

    it('should handle multiple occurrences of same variable', () => {
      const template = {
        system: 'System with {var} and {var} again',
        user: 'User with {var}'
      };

      const variables = { var: 'replaced' };
      const result = SummarizationPrompts.formatPrompt(template, variables);

      expect(result.system).toBe('System with replaced and replaced again');
      expect(result.user).toBe('User with replaced');
    });

    it('should handle missing variables gracefully', () => {
      const template = {
        system: 'System with {missing}',
        user: 'User with {existing}'
      };

      const variables = { existing: 'found' };
      const result = SummarizationPrompts.formatPrompt(template, variables);

      expect(result.system).toBe('System with {missing}'); // Unchanged
      expect(result.user).toBe('User with found');
    });

    it('should handle empty variables object', () => {
      const template = {
        system: 'System prompt',
        user: 'User prompt'
      };

      const result = SummarizationPrompts.formatPrompt(template, {});

      expect(result).toEqual(template);
    });

    it('should handle special characters in variables', () => {
      const template = {
        system: 'System with {special}',
        user: 'User with {special}'
      };

      const variables = { special: '$pecial ch@rs & symbols!' };
      const result = SummarizationPrompts.formatPrompt(template, variables);

      expect(result.system).toBe('System with $pecial ch@rs & symbols!');
      expect(result.user).toBe('User with $pecial ch@rs & symbols!');
    });
  });

  describe('prompt structure validation', () => {
    it('should ensure all tone prompts have required placeholders', () => {
      const tones: Array<'formal' | 'casual' | 'fun'> = ['formal', 'casual', 'fun'];
      
      tones.forEach(tone => {
        const prompt = SummarizationPrompts.getTonePrompt(tone);
        
        expect(prompt.user).toContain('{content}');
        expect(prompt.user).toContain('{targetMinutes}');
        expect(prompt.system).toBeTruthy();
        expect(prompt.user).toBeTruthy();
      });
    });

    it('should ensure consolidation prompt has all required placeholders', () => {
      const prompt = SummarizationPrompts.getConsolidationPrompt();
      
      expect(prompt.user).toContain('{articles}');
      expect(prompt.user).toContain('{targetMinutes}');
      expect(prompt.user).toContain('{tone}');
    });

    it('should ensure adaptation prompts have content placeholder', () => {
      const tones: Array<'formal' | 'casual' | 'fun'> = ['formal', 'casual', 'fun'];
      
      tones.forEach(tone => {
        const prompt = SummarizationPrompts.getToneAdaptationPrompt(tone);
        expect(prompt.user).toContain('{content}');
      });
    });
  });
});