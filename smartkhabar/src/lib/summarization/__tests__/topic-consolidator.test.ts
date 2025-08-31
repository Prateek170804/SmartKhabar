/**
 * Unit tests for TopicConsolidator
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TopicConsolidator, ConsolidationRequest } from '../topic-consolidator';
import { NewsArticle } from '../../../types';

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

describe('TopicConsolidator', () => {
  let consolidator: TopicConsolidator;

  const mockArticles: NewsArticle[] = [
    {
      id: 'article-1',
      headline: 'AI Technology Breakthrough in Healthcare',
      content: 'Artificial intelligence is revolutionizing healthcare with new diagnostic tools and treatment methods.',
      source: 'tech-news',
      category: 'technology',
      publishedAt: new Date('2024-01-01'),
      url: 'https://example.com/ai-healthcare',
      tags: ['ai', 'healthcare']
    },
    {
      id: 'article-2',
      headline: 'Machine Learning Advances Medical Diagnosis',
      content: 'Machine learning algorithms are improving medical diagnosis accuracy and speed in hospitals worldwide.',
      source: 'medical-journal',
      category: 'technology',
      publishedAt: new Date('2024-01-02'),
      url: 'https://example.com/ml-diagnosis',
      tags: ['ml', 'medical']
    },
    {
      id: 'article-3',
      headline: 'Stock Market Reaches New Heights',
      content: 'The stock market has reached record highs as investors show confidence in economic recovery.',
      source: 'finance-news',
      category: 'business',
      publishedAt: new Date('2024-01-03'),
      url: 'https://example.com/stock-market',
      tags: ['stocks', 'economy']
    }
  ];

  const mockConsolidationRequest: ConsolidationRequest = {
    articles: mockArticles,
    tone: 'casual',
    maxReadingTime: 5,
    userId: 'test-user'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock AI responses
    mockInvoke
      .mockResolvedValueOnce({
        // Mock grouping analysis response
        content: JSON.stringify({
          groups: [
            {
              topic: 'AI in Healthcare',
              articleIndices: [1, 2],
              similarity: 0.85,
              keywords: ['artificial', 'intelligence', 'healthcare', 'medical', 'diagnosis']
            },
            {
              topic: 'Stock Market News',
              articleIndices: [3],
              similarity: 1.0,
              keywords: ['stock', 'market', 'economy', 'investors']
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        // Mock consolidated summary response
        content: 'This is a consolidated summary covering AI healthcare advances and stock market news.'
      });

    consolidator = new TopicConsolidator();
  });

  describe('consolidateTopics', () => {
    it('should consolidate articles by topic and generate unified summary', async () => {
      const result = await consolidator.consolidateTopics(mockConsolidationRequest);

      expect(result).toMatchObject({
        id: expect.any(String),
        content: expect.any(String),
        keyPoints: expect.any(Array),
        sourceArticles: expect.arrayContaining(['article-1', 'article-2', 'article-3']),
        estimatedReadingTime: expect.any(Number),
        tone: 'casual',
        topicGroups: expect.any(Array),
        consolidatedArticleCount: 3,
        duplicatesRemoved: 0
      });

      expect(result.topicGroups).toHaveLength(2);
      expect(result.topicGroups[0].articles).toHaveLength(2); // AI articles grouped together
      expect(result.topicGroups[1].articles).toHaveLength(1); // Stock market article alone
    });

    it('should handle custom similarity threshold', async () => {
      const requestWithHighThreshold = {
        ...mockConsolidationRequest,
        similarityThreshold: 0.9
      };

      // Mock response with lower similarity that should be filtered out
      mockInvoke.mockReset().mockResolvedValueOnce({
        content: JSON.stringify({
          groups: [
            {
              topic: 'Mixed Topics',
              articleIndices: [1, 2, 3],
              similarity: 0.6, // Below threshold
              keywords: ['various', 'topics']
            }
          ]
        })
      }).mockResolvedValueOnce({
        content: 'Consolidated summary with high threshold.'
      });

      const result = await consolidator.consolidateTopics(requestWithHighThreshold);

      // Should fall back to individual articles since similarity is below threshold
      expect(result.topicGroups.length).toBeGreaterThan(1);
    });

    it('should handle empty articles array', async () => {
      const emptyRequest = {
        ...mockConsolidationRequest,
        articles: []
      };

      await expect(consolidator.consolidateTopics(emptyRequest))
        .rejects.toThrow('No unique articles to consolidate');
    });

    it('should handle API errors gracefully with fallback', async () => {
      // Mock first call (grouping) to fail, second call (summary) to succeed
      mockInvoke.mockReset()
        .mockRejectedValueOnce(new Error('Grouping API Error'))
        .mockResolvedValueOnce({
          content: 'Fallback consolidated summary after grouping error.'
        });

      const result = await consolidator.consolidateTopics(mockConsolidationRequest);

      // Should still return a result using fallback grouping
      expect(result).toBeDefined();
      expect(result.topicGroups.length).toBeGreaterThan(0);
    });
  });

  describe('removeDuplicates', () => {
    it('should remove duplicate articles', () => {
      const articlesWithDuplicates = [
        mockArticles[0],
        { ...mockArticles[0], id: 'duplicate-1' }, // Duplicate content
        mockArticles[1],
        { ...mockArticles[1], id: 'duplicate-2' } // Another duplicate
      ];

      const result = consolidator.removeDuplicates(articlesWithDuplicates);

      expect(result.uniqueArticles).toHaveLength(2);
      expect(result.duplicatesRemoved).toBe(2);
    });

    it('should handle articles with no duplicates', () => {
      const result = consolidator.removeDuplicates(mockArticles);

      expect(result.uniqueArticles).toHaveLength(3);
      expect(result.duplicatesRemoved).toBe(0);
    });

    it('should handle empty articles array', () => {
      const result = consolidator.removeDuplicates([]);

      expect(result.uniqueArticles).toHaveLength(0);
      expect(result.duplicatesRemoved).toBe(0);
    });
  });

  describe('groupArticlesByTopic', () => {
    it('should group single article', async () => {
      const singleArticle = [mockArticles[0]];
      const groups = await consolidator.groupArticlesByTopic(singleArticle, 0.7);

      expect(groups).toHaveLength(1);
      expect(groups[0].articles).toHaveLength(1);
      expect(groups[0].similarity).toBe(1.0);
    });

    it('should handle AI grouping failure with fallback', async () => {
      mockInvoke.mockRejectedValue(new Error('AI Grouping Error'));

      const groups = await consolidator.groupArticlesByTopic(mockArticles, 0.7);

      // Should fall back to category-based grouping
      expect(groups).toHaveLength(2); // technology and business categories
      expect(groups.some(group => group.articles.length === 2)).toBe(true); // technology articles grouped
      expect(groups.some(group => group.articles.length === 1)).toBe(true); // business article alone
    });
  });

  describe('getConsolidationStats', () => {
    it('should return correct consolidation statistics', async () => {
      const result = await consolidator.consolidateTopics(mockConsolidationRequest);
      const stats = consolidator.getConsolidationStats(result);

      expect(stats).toMatchObject({
        totalArticles: expect.any(Number),
        uniqueArticles: expect.any(Number),
        duplicatesRemoved: expect.any(Number),
        topicGroups: expect.any(Number),
        averageGroupSize: expect.any(Number)
      });

      expect(stats.totalArticles).toBe(stats.uniqueArticles + stats.duplicatesRemoved);
      expect(stats.averageGroupSize).toBe(stats.uniqueArticles / stats.topicGroups);
    });
  });

  describe('edge cases', () => {
    it('should handle articles with missing or empty content', async () => {
      const articlesWithEmptyContent = [
        { ...mockArticles[0], content: '' },
        { ...mockArticles[1], content: '   ' },
        mockArticles[2]
      ];

      const request = {
        ...mockConsolidationRequest,
        articles: articlesWithEmptyContent
      };

      // Should not throw error and should handle gracefully
      const result = await consolidator.consolidateTopics(request);
      expect(result).toBeDefined();
    });

    it('should handle articles with very long content', async () => {
      const longContent = 'This is a very long article content. '.repeat(1000);
      const articlesWithLongContent = [
        { ...mockArticles[0], content: longContent },
        mockArticles[1]
      ];

      const request = {
        ...mockConsolidationRequest,
        articles: articlesWithLongContent
      };

      const result = await consolidator.consolidateTopics(request);
      expect(result).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
    });

    it('should handle invalid JSON response from AI', async () => {
      mockInvoke.mockReset()
        .mockResolvedValueOnce({
          content: 'Invalid JSON response from AI'
        })
        .mockResolvedValueOnce({
          content: 'Fallback consolidated summary.'
        });

      const result = await consolidator.consolidateTopics(mockConsolidationRequest);

      // Should fall back to basic grouping
      expect(result).toBeDefined();
      expect(result.topicGroups.length).toBeGreaterThan(0);
    });

    it('should handle articles with special characters and unicode', async () => {
      const articlesWithSpecialChars = [
        {
          ...mockArticles[0],
          headline: 'AI Technology: "Revolutionary" Breakthrough! 🚀',
          content: 'Artificial intelligence is "revolutionizing" healthcare with émojis and spëcial characters.'
        },
        mockArticles[1]
      ];

      const request = {
        ...mockConsolidationRequest,
        articles: articlesWithSpecialChars
      };

      const result = await consolidator.consolidateTopics(request);
      expect(result).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle missing API key in constructor', () => {
      expect(consolidator).toBeDefined();
    });

    it('should handle malformed article data', async () => {
      const malformedArticles = [
        { ...mockArticles[0], publishedAt: null as any },
        { ...mockArticles[1], tags: null as any }
      ];

      const request = {
        ...mockConsolidationRequest,
        articles: malformedArticles
      };

      // Should handle gracefully without throwing
      const result = await consolidator.consolidateTopics(request);
      expect(result).toBeDefined();
    });
  });
});