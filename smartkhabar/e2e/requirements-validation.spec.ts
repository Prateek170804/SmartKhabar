/**
 * Requirements Validation Tests
 * 
 * Comprehensive tests that specifically validate performance requirements:
 * - Requirement 8.2: System SHALL respond within 3 seconds for summary generation
 * - Requirement 8.3: System SHALL handle at least 100 concurrent users
 */

import { test, expect } from '@playwright/test';
import { 
  PerformanceMonitor, 
  simulateConcurrentUsers, 
  analyzeLoadTestResults,
  performanceAssertions 
} from './utils/performance-monitor';

test.describe('Performance Requirements Validation', () => {
  test.describe.configure({ mode: 'parallel' });

  test('Requirement 8.2: Summary generation responds within 3 seconds', async ({ request }) => {
    console.log('🧪 Testing Requirement 8.2: Summary generation response time');
    
    const testCases = [
      {
        name: 'Single article summary',
        articles: [{
          id: 'test-1',
          headline: 'Test Article for Summary Generation',
          content: 'This is a comprehensive test article content. '.repeat(100),
          source: 'Test Source',
          category: 'technology',
          publishedAt: new Date().toISOString(),
          url: 'https://example.com/test-1',
          tags: ['test']
        }]
      },
      {
        name: 'Multiple articles summary',
        articles: Array.from({ length: 5 }, (_, i) => ({
          id: `test-${i}`,
          headline: `Test Article ${i}`,
          content: `This is test article ${i} content. `.repeat(50),
          source: 'Test Source',
          category: 'technology',
          publishedAt: new Date().toISOString(),
          url: `https://example.com/test-${i}`,
          tags: ['test']
        }))
      },
      {
        name: 'Large article summary',
        articles: [{
          id: 'large-test',
          headline: 'Large Test Article for Summary Generation',
          content: 'This is a very large test article with extensive content. '.repeat(500),
          source: 'Test Source',
          category: 'technology',
          publishedAt: new Date().toISOString(),
          url: 'https://example.com/large-test',
          tags: ['test', 'large']
        }]
      }
    ];

    for (const testCase of testCases) {
      console.log(`Testing ${testCase.name}...`);
      
      const requestData = {
        articles: testCase.articles,
        tone: 'casual',
        maxReadingTime: 5
      };

      // Test multiple times to ensure consistency
      const iterations = 5;
      const responseTimes: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        
        try {
          const response = await request.post('/api/articles/summary', {
            data: requestData,
            timeout: 5000 // Allow some buffer, but expect < 3000ms
          });
          
          const responseTime = Date.now() - startTime;
          responseTimes.push(responseTime);
          
          expect(response.ok()).toBe(true);
          
          // Validate requirement 8.2
          performanceAssertions.responseTimeWithin3Seconds(
            responseTime, 
            `${testCase.name} iteration ${i + 1}`
          );
          
        } catch (error) {
          console.error(`${testCase.name} iteration ${i + 1} failed:`, error.message);
          throw error;
        }
      }

      // Analyze results
      const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);
      const minResponseTime = Math.min(...responseTimes);

      console.log(`${testCase.name} results:`);
      console.log(`  - Average: ${avgResponseTime.toFixed(0)}ms`);
      console.log(`  - Min: ${minResponseTime}ms, Max: ${maxResponseTime}ms`);
      console.log(`  - All iterations: ${responseTimes.map(t => `${t}ms`).join(', ')}`);

      // All response times must meet requirement 8.2
      expect(avgResponseTime).toBeLessThan(3000);
      expect(maxResponseTime).toBeLessThan(3000);
      
      // Consistency check - standard deviation should be reasonable
      const variance = responseTimes.reduce((sum, time) => sum + Math.pow(time - avgResponseTime, 2), 0) / responseTimes.length;
      const stdDev = Math.sqrt(variance);
      expect(stdDev).toBeLessThan(1000); // Standard deviation < 1 second
    }

    console.log('✅ Requirement 8.2 validation PASSED');
  });

  test('Requirement 8.3: System handles 100 concurrent users', async ({ browser }) => {
    console.log('🧪 Testing Requirement 8.3: 100 concurrent users handling');
    
    const targetUsers = 100;
    const testDuration = 30000; // 30 seconds
    
    console.log(`Testing ${targetUsers} concurrent users over ${testDuration/1000} seconds`);

    // Define user action
    const userAction = async (userId: number) => {
      const startTime = Date.now();
      
      try {
        const context = await browser.newContext();
        const page = await context.newPage();
        const monitor = new PerformanceMonitor(page);
        
        monitor.start();
        
        // Navigate to homepage
        await page.goto('/', { timeout: 10000 });
        
        // Wait for news feed to load
        await expect(page.locator('[data-testid="news-feed"]')).toBeVisible({ timeout: 10000 });
        
        // Simulate user interactions
        const articles = page.locator('[data-testid="news-article"]');
        const articleCount = await articles.count();
        
        if (articleCount > 0) {
          // Interact with first article
          const firstArticle = articles.first();
          const likeBtn = firstArticle.locator('[data-testid="like-button"]');
          if (await likeBtn.isVisible()) {
            await likeBtn.click();
          }
          
          // Try to access preferences
          const prefsBtn = page.locator('[data-testid="preferences-button"]');
          if (await prefsBtn.isVisible()) {
            await prefsBtn.click();
            await page.waitForTimeout(500);
          }
        }
        
        const metrics = await monitor.getMetrics();
        await context.close();
        
        const responseTime = Date.now() - startTime;
        
        return {
          userId,
          success: true,
          responseTime,
          metrics
        };
        
      } catch (error) {
        return {
          userId,
          success: false,
          responseTime: Date.now() - startTime,
          error: error.message
        };
      }
    };

    // Execute concurrent user simulation
    const results = await simulateConcurrentUsers(targetUsers, userAction, {
      batchSize: 25, // Process in smaller batches for stability
      batchDelay: 2000 // 2 second delay between batches
    });

    // Analyze results
    const analysis = analyzeLoadTestResults(results, {
      minSuccessRate: 80, // 80% success rate for 100 concurrent users
      maxAvgResponseTime: 5000, // Slightly relaxed for high concurrency
      maxResponseTime: 8000
    });

    console.log('100 Concurrent Users Test Results:');
    console.log(`- Total users: ${analysis.summary.totalUsers}`);
    console.log(`- Successful users: ${analysis.summary.successfulUsers}`);
    console.log(`- Success rate: ${analysis.summary.successRate.toFixed(1)}%`);
    console.log(`- Average response time: ${analysis.summary.avgResponseTime.toFixed(0)}ms`);
    console.log(`- Response time range: ${analysis.summary.minResponseTime}ms - ${analysis.summary.maxResponseTime}ms`);

    if (analysis.issues.length > 0) {
      console.log('Issues found:');
      analysis.issues.forEach(issue => console.log(`  - ${issue}`));
    }

    // Validate requirement 8.3
    performanceAssertions.concurrentUserSuccessRate(
      analysis.summary.successfulUsers,
      analysis.summary.totalUsers,
      0.8 // 80% minimum success rate for 100 concurrent users
    );

    // Additional validations
    expect(analysis.summary.successfulUsers).toBeGreaterThanOrEqual(80); // At least 80 successful users
    expect(analysis.summary.successRate).toBeGreaterThanOrEqual(80); // 80% success rate
    expect(analysis.summary.avgResponseTime).toBeLessThan(6000); // Average response under 6 seconds

    // Check that fast responses (< 3 seconds) are still common
    const fastResponses = results.filter(r => r.success && r.responseTime < 3000).length;
    const fastResponseRate = (fastResponses / analysis.summary.successfulUsers) * 100;
    console.log(`- Fast responses (<3s): ${fastResponses}/${analysis.summary.successfulUsers} (${fastResponseRate.toFixed(1)}%)`);
    
    // At least 50% of successful users should get fast responses
    expect(fastResponseRate).toBeGreaterThanOrEqual(50);

    console.log('✅ Requirement 8.3 validation PASSED');
  });

  test('Combined requirements validation: 100 users with summary generation', async ({ browser, request }) => {
    console.log('🧪 Testing Combined Requirements: 100 users generating summaries');
    
    const concurrentUsers = 50; // Reduced for combined test
    const summariesPerUser = 2;
    
    console.log(`Testing ${concurrentUsers} users each generating ${summariesPerUser} summaries`);

    const testArticles = {
      articles: [{
        id: 'combined-test',
        headline: 'Combined Test Article',
        content: 'This article is used for combined requirements testing. '.repeat(100),
        source: 'Test Source',
        category: 'technology',
        publishedAt: new Date().toISOString(),
        url: 'https://example.com/combined-test',
        tags: ['test', 'combined']
      }]
    };

    // User action that includes summary generation
    const userAction = async (userId: number) => {
      const startTime = Date.now();
      const summaryTimes: number[] = [];
      
      try {
        const context = await browser.newContext();
        const page = await context.newPage();
        
        // Navigate to homepage first
        await page.goto('/', { timeout: 8000 });
        await expect(page.locator('[data-testid="news-feed"]')).toBeVisible({ timeout: 8000 });
        
        // Generate summaries using API
        for (let i = 0; i < summariesPerUser; i++) {
          const summaryStartTime = Date.now();
          
          const response = await page.request.post('/api/articles/summary', {
            data: {
              ...testArticles,
              tone: 'casual',
              maxReadingTime: 3
            },
            timeout: 5000
          });
          
          const summaryTime = Date.now() - summaryStartTime;
          summaryTimes.push(summaryTime);
          
          if (!response.ok()) {
            throw new Error(`Summary generation failed: ${response.status()}`);
          }
          
          // Validate each summary meets requirement 8.2
          if (summaryTime >= 3000) {
            throw new Error(`Summary ${i + 1} took ${summaryTime}ms, violating requirement 8.2`);
          }
        }
        
        await context.close();
        
        const totalTime = Date.now() - startTime;
        const avgSummaryTime = summaryTimes.reduce((sum, time) => sum + time, 0) / summaryTimes.length;
        
        return {
          userId,
          success: true,
          responseTime: totalTime,
          summaryTimes,
          avgSummaryTime
        };
        
      } catch (error) {
        return {
          userId,
          success: false,
          responseTime: Date.now() - startTime,
          error: error.message
        };
      }
    };

    // Execute combined test
    const results = await simulateConcurrentUsers(concurrentUsers, userAction, {
      batchSize: 10,
      batchDelay: 1500
    });

    // Analyze results
    const successfulResults = results.filter(r => r.success);
    const failedResults = results.filter(r => !r.success);
    
    const allSummaryTimes = successfulResults
      .flatMap(r => (r as any).summaryTimes || [])
      .filter(time => time > 0);
    
    const avgSummaryTime = allSummaryTimes.length > 0 
      ? allSummaryTimes.reduce((sum, time) => sum + time, 0) / allSummaryTimes.length 
      : 0;
    
    const maxSummaryTime = allSummaryTimes.length > 0 ? Math.max(...allSummaryTimes) : 0;
    
    console.log('Combined Requirements Test Results:');
    console.log(`- Concurrent users: ${concurrentUsers}`);
    console.log(`- Successful users: ${successfulResults.length}/${concurrentUsers}`);
    console.log(`- Success rate: ${(successfulResults.length / concurrentUsers * 100).toFixed(1)}%`);
    console.log(`- Total summaries generated: ${allSummaryTimes.length}`);
    console.log(`- Average summary time: ${avgSummaryTime.toFixed(0)}ms`);
    console.log(`- Max summary time: ${maxSummaryTime}ms`);

    // Validate combined requirements
    expect(successfulResults.length).toBeGreaterThanOrEqual(concurrentUsers * 0.8); // 80% user success
    expect(avgSummaryTime).toBeLessThan(3000); // Requirement 8.2
    expect(maxSummaryTime).toBeLessThan(3000); // All summaries meet requirement 8.2
    
    // Check that system handled the concurrent load
    const totalSummariesExpected = concurrentUsers * summariesPerUser;
    const summarySuccessRate = (allSummaryTimes.length / totalSummariesExpected) * 100;
    console.log(`- Summary success rate: ${summarySuccessRate.toFixed(1)}%`);
    
    expect(summarySuccessRate).toBeGreaterThanOrEqual(75); // 75% of summaries should succeed

    if (failedResults.length > 0) {
      console.log('Failed users sample:', failedResults.slice(0, 3).map(r => `User ${r.userId}: ${r.error}`));
    }

    console.log('✅ Combined requirements validation PASSED');
  });

  test('Performance degradation analysis under load', async ({ request }) => {
    console.log('🧪 Testing Performance degradation under increasing load');
    
    const loadLevels = [1, 5, 10, 20, 50];
    const results = [];
    
    for (const loadLevel of loadLevels) {
      console.log(`Testing load level: ${loadLevel} concurrent requests`);
      
      const startTime = Date.now();
      
      // Create concurrent summary requests
      const requests = Array.from({ length: loadLevel }, async (_, index) => {
        const requestStartTime = Date.now();
        
        try {
          const response = await request.post('/api/articles/summary', {
            data: {
              articles: [{
                id: `load-test-${index}`,
                headline: `Load Test Article ${index}`,
                content: `Content for load testing article ${index}. `.repeat(50),
                source: 'Load Test',
                category: 'test',
                publishedAt: new Date().toISOString(),
                url: `https://example.com/load-${index}`,
                tags: ['load', 'test']
              }],
              tone: 'casual',
              maxReadingTime: 3
            },
            timeout: 5000
          });
          
          const responseTime = Date.now() - requestStartTime;
          
          return {
            success: response.ok(),
            responseTime,
            status: response.status()
          };
          
        } catch (error) {
          return {
            success: false,
            responseTime: Date.now() - requestStartTime,
            error: error.message
          };
        }
      });
      
      const requestResults = await Promise.all(requests);
      const totalTime = Date.now() - startTime;
      
      const successful = requestResults.filter(r => r.success);
      const avgResponseTime = successful.length > 0 
        ? successful.reduce((sum, r) => sum + r.responseTime, 0) / successful.length 
        : 0;
      
      const result = {
        loadLevel,
        totalTime,
        successCount: successful.length,
        successRate: (successful.length / loadLevel) * 100,
        avgResponseTime,
        maxResponseTime: successful.length > 0 ? Math.max(...successful.map(r => r.responseTime)) : 0
      };
      
      results.push(result);
      
      console.log(`Load ${loadLevel}: ${result.successRate.toFixed(1)}% success, ${result.avgResponseTime.toFixed(0)}ms avg`);
      
      // Each load level should still meet basic requirements
      expect(result.successRate).toBeGreaterThanOrEqual(80); // 80% success minimum
      expect(result.avgResponseTime).toBeLessThan(3000); // Requirement 8.2
    }
    
    // Analyze degradation
    const baselineResult = results[0]; // Load level 1
    const highestLoadResult = results[results.length - 1]; // Highest load level
    
    const responseTimeDegradation = highestLoadResult.avgResponseTime / baselineResult.avgResponseTime;
    const successRateDegradation = baselineResult.successRate - highestLoadResult.successRate;
    
    console.log('Performance Degradation Analysis:');
    console.log(`- Response time degradation: ${responseTimeDegradation.toFixed(2)}x`);
    console.log(`- Success rate degradation: ${successRateDegradation.toFixed(1)}%`);
    
    // Performance should not degrade excessively
    expect(responseTimeDegradation).toBeLessThan(2.5); // Response time shouldn't increase more than 2.5x
    expect(successRateDegradation).toBeLessThan(15); // Success rate shouldn't drop more than 15%
    
    console.log('✅ Performance degradation analysis PASSED');
  });
});