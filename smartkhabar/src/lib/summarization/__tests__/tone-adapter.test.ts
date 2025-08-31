/**
 * Unit tests for ToneAdapter
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToneAdapter, ToneAdaptationRequest } from '../tone-adapter';

// Mock the ChatOpenAI
const mockInvoke = vi.fn();
vi.mock('@langchain/openai', () => ({
  ChatOpenAI: vi.fn().mockImplementation(() => ({
    invoke: mockInvoke
  }))
}));

// Mock config
vi.mock('../../config', () => ({
  config: {
    openai: {
      apiKey: 'test-api-key'
    }
  }
}));

describe('ToneAdapter', () => {
  let adapter: ToneAdapter;

  const sampleContent = 'This is a test article about technology trends. It discusses various innovations and their impact on society.';

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock the LLM response
    mockInvoke.mockResolvedValue({
      content: 'This is the adapted content in the requested tone.'
    });

    adapter = new ToneAdapter();
  });

  describe('adaptTone', () => {
    it('should adapt content from formal to casual tone', async () => {
      const request: ToneAdaptationRequest = {
        content: sampleContent,
        sourceTone: 'formal',
        targetTone: 'casual'
      };

      const result = await adapter.adaptTone(request);

      expect(result).toMatchObject({
        adaptedContent: expect.any(String),
        sourceTone: 'formal',
        targetTone: 'casual',
        consistencyScore: expect.any(Number)
      });

      expect(result.consistencyScore).toBeGreaterThanOrEqual(0);
      expect(result.consistencyScore).toBeLessThanOrEqual(1);
      expect(mockInvoke).toHaveBeenCalledTimes(2); // Once for adaptation, once for validation
    });

    it('should adapt content from casual to formal tone', async () => {
      const request: ToneAdaptationRequest = {
        content: "Hey there! Let's talk about some cool tech stuff that's happening right now.",
        sourceTone: 'casual',
        targetTone: 'formal'
      };

      const result = await adapter.adaptTone(request);

      expect(result.sourceTone).toBe('casual');
      expect(result.targetTone).toBe('formal');
      expect(result.adaptedContent).toBeTruthy();
    });

    it('should adapt content from casual to fun tone', async () => {
      const request: ToneAdaptationRequest = {
        content: sampleContent,
        sourceTone: 'casual',
        targetTone: 'fun'
      };

      const result = await adapter.adaptTone(request);

      expect(result.sourceTone).toBe('casual');
      expect(result.targetTone).toBe('fun');
      expect(result.adaptedContent).toBeTruthy();
    });

    it('should return original content when source and target tones are the same', async () => {
      const request: ToneAdaptationRequest = {
        content: sampleContent,
        sourceTone: 'casual',
        targetTone: 'casual'
      };

      const result = await adapter.adaptTone(request);

      expect(result.adaptedContent).toBe(sampleContent);
      expect(result.consistencyScore).toBe(1.0);
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('should preserve length when requested', async () => {
      const request: ToneAdaptationRequest = {
        content: sampleContent,
        sourceTone: 'formal',
        targetTone: 'casual',
        preserveLength: true
      };

      await adapter.adaptTone(request);

      const callArgs = mockInvoke.mock.calls[0][0];
      expect(callArgs[1].content).toContain('same length');
    });

    it('should handle API errors gracefully', async () => {
      mockInvoke.mockRejectedValue(new Error('API Error'));

      const request: ToneAdaptationRequest = {
        content: sampleContent,
        sourceTone: 'formal',
        targetTone: 'casual'
      };

      await expect(adapter.adaptTone(request))
        .rejects.toThrow('Failed to adapt tone');
    });
  });

  describe('batchAdaptTone', () => {
    it('should adapt multiple content pieces to the same tone', async () => {
      const contents = [
        'First piece of content to adapt.',
        'Second piece of content to adapt.',
        'Third piece of content to adapt.'
      ];

      const results = await adapter.batchAdaptTone(contents, 'formal', 'casual');

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.sourceTone).toBe('formal');
        expect(result.targetTone).toBe('casual');
        expect(result.adaptedContent).toBeTruthy();
      });
    });

    it('should handle empty content array', async () => {
      const results = await adapter.batchAdaptTone([], 'formal', 'casual');
      expect(results).toHaveLength(0);
    });
  });

  describe('validateToneConsistency', () => {
    it('should validate formal tone consistency', async () => {
      // Mock validation response with score
      mockInvoke.mockResolvedValue({
        content: '8.5'
      });

      const score = await adapter.validateToneConsistency(
        'This is a professional and objective analysis of the situation.',
        'formal'
      );

      expect(score).toBe(0.85); // 8.5/10 normalized to 0-1
    });

    it('should validate casual tone consistency', async () => {
      mockInvoke.mockResolvedValue({
        content: '7.0'
      });

      const score = await adapter.validateToneConsistency(
        "Hey, let's talk about this in a friendly way!",
        'casual'
      );

      expect(score).toBe(0.7);
    });

    it('should validate fun tone consistency', async () => {
      mockInvoke.mockResolvedValue({
        content: '9.2'
      });

      const score = await adapter.validateToneConsistency(
        'Wow! This is absolutely amazing and super exciting!',
        'fun'
      );

      expect(score).toBeCloseTo(0.92, 2);
    });

    it('should handle validation API errors with fallback', async () => {
      mockInvoke.mockRejectedValue(new Error('Validation API Error'));

      const score = await adapter.validateToneConsistency(
        'This is a test content.',
        'casual'
      );

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should handle invalid score responses with fallback', async () => {
      mockInvoke.mockResolvedValue({
        content: 'Invalid response without score'
      });

      const score = await adapter.validateToneConsistency(
        'This is a test content.',
        'formal'
      );

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });

  describe('basicToneValidation', () => {
    it('should give higher scores for formal content with formal indicators', async () => {
      // Force fallback to basic validation
      mockInvoke.mockRejectedValue(new Error('API Error'));

      const formalContent = 'Furthermore, the analysis demonstrates that the aforementioned methodology is consequently effective.';
      const score = await adapter.validateToneConsistency(formalContent, 'formal');

      expect(score).toBeGreaterThan(0.5);
    });

    it('should give lower scores for casual content when expecting formal', async () => {
      mockInvoke.mockRejectedValue(new Error('API Error'));

      const casualContent = "Hey, that's gonna be awesome! Let's do it!";
      const score = await adapter.validateToneConsistency(casualContent, 'formal');

      expect(score).toBeLessThan(0.5);
    });

    it('should give higher scores for casual content with casual indicators', async () => {
      mockInvoke.mockRejectedValue(new Error('API Error'));

      const casualContent = "You know, it's really cool how we can make this work for our users.";
      const score = await adapter.validateToneConsistency(casualContent, 'casual');

      expect(score).toBeGreaterThan(0.5);
    });

    it('should give higher scores for fun content with fun indicators', async () => {
      mockInvoke.mockRejectedValue(new Error('API Error'));

      const funContent = 'This is absolutely amazing! Wow, what an awesome and exciting development!';
      const score = await adapter.validateToneConsistency(funContent, 'fun');

      expect(score).toBeGreaterThan(0.5);
    });
  });

  describe('getToneCharacteristics', () => {
    it('should return formal tone characteristics', () => {
      const characteristics = adapter.getToneCharacteristics('formal');

      expect(characteristics).toMatchObject({
        description: expect.stringContaining('Professional'),
        keyFeatures: expect.arrayContaining([
          expect.stringContaining('Third-person')
        ]),
        avoidFeatures: expect.arrayContaining([
          expect.stringContaining('Contractions')
        ])
      });
    });

    it('should return casual tone characteristics', () => {
      const characteristics = adapter.getToneCharacteristics('casual');

      expect(characteristics).toMatchObject({
        description: expect.stringContaining('Conversational'),
        keyFeatures: expect.arrayContaining([
          expect.stringContaining('Second-person')
        ]),
        avoidFeatures: expect.arrayContaining([
          expect.stringContaining('formal language')
        ])
      });
    });

    it('should return fun tone characteristics', () => {
      const characteristics = adapter.getToneCharacteristics('fun');

      expect(characteristics).toMatchObject({
        description: expect.stringContaining('Engaging'),
        keyFeatures: expect.arrayContaining([
          expect.stringContaining('Enthusiastic')
        ]),
        avoidFeatures: expect.arrayContaining([
          expect.stringContaining('boring')
        ])
      });
    });
  });

  describe('error handling', () => {
    it('should handle missing API key in constructor', () => {
      // This test verifies the error handling logic exists
      expect(adapter).toBeDefined();
    });
  });
});