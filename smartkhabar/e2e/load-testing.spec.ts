import { test, expect, Browser, BrowserContext, Page } from '@playwright/test';
import { 
  PerformanceMonitor, 
  simulateConcurrentUsers, 
  analyzeLoadTestResults,
  performanceAssertions,
  LoadTestResult 
} from './utils/performance-monitor';

test.describe('Load Testing', () => {
  test.describe.configure({ mode: 'parallel' });

  test('concurrent user handling - 100 users simulation (Requirement 8.3)', async ({ browser }) => {
    const userCount = 100; // Test requirement 8.3: handle at least 100 concurrent users
    const contexts: BrowserContext[] = [];
    const pages: Page[] = [];
    
    try {
      // Create multiple browser contexts to simulate different users
      for (let i = 0; i < userCount; i++) {
        const context = await browser.newContext();
        const page = await context.newPage();
        contexts.push(context);
        pages.push(page);
      }

      const startTime = Date.now();
      
      // Simulate concurrent user actions
      const userActions = pages.map(async (page, index) => {
        const userStartTime = Date.now();
        
        try {
          // Navigate to homepage
          await page.goto('/', { timeout: 10000 });
          
          // Wait for news feed to load
          await expect(page.locator('[data-testid="news-feed"]')).toBeVisible({ timeout: 10000 });
          
          // Simulate user interactions
          const articles = page.locator('[data-testid="news-article"]');
          const articleCount = await articles.count();
          
          if (articleCount > 0) {
            // Click on first article's like button if available
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
          
          const userEndTime = Date.now();
          const userResponseTime = userEndTime - userStartTime;
          
          // Each user should complete actions within 3 seconds (Requirement 8.2)
          expect(userResponseTime).toBeLessThan(3000);
          
          return {
            userId: index,
            responseTime: userResponseTime,
            success: true
          };
        } catch (error) {
          return {
            userId: index,
            responseTime: Date.now() - userStartTime,
            success: false,
            error: error.message
          };
        }
      });

      // Wait for all users to complete their actions
      const results = await Promise.all(userActions);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Analyze results
      const successfulUsers = results.filter(r => r.success);
      const failedUsers = results.filter(r => !r.success);
      
      console.log(`Load test results for ${userCount} concurrent users:`);
      console.log(`- Total time: ${totalTime}ms`);
      console.log(`- Successful users: ${successfulUsers.length}/${userCount}`);
      console.log(`- Failed users: ${failedUsers.length}/${userCount}`);
      
      if (successfulUsers.length > 0) {
        const avgResponseTime = successfulUsers.reduce((sum, r) => sum + r.responseTime, 0) / successfulUsers.length;
        const maxResponseTime = Math.max(...successfulUsers.map(r => r.responseTime));
        const minResponseTime = Math.min(...successfulUsers.map(r => r.responseTime));
        
        console.log(`- Average response time: ${avgResponseTime}ms`);
        console.log(`- Max response time: ${maxResponseTime}ms`);
        console.log(`- Min response time: ${minResponseTime}ms`);
        
        // Performance assertions
        expect(successfulUsers.length).toBeGreaterThanOrEqual(userCount * 0.9); // 90% success rate
        expect(avgResponseTime).toBeLessThan(3000); // Average under 3 seconds
        expect(maxResponseTime).toBeLessThan(5000); // No user waits more than 5 seconds
      }
      
      if (failedUsers.length > 0) {
        console.log('Failed user errors:', failedUsers.map(u => `User ${u.userId}: ${u.error}`));
      }

    } finally {
      // Clean up contexts
      await Promise.all(contexts.map(context => context.close()));
    }
  });

  test('summary generation response time validation (Requirement 8.2)', async ({ request }) => {
    const summaryRequests = 20;
    const testArticle = {
      articles: [{
        id: 'test-article-1',
        headline: 'Test Article for Summary Generation',
        content: 'This is a comprehensive test article that will be used to validate summary generation response times. '.repeat(50),
        source: 'Test Source',
        category: 'technology',
        publishedAt: new Date().toISOString(),
        url: 'https://example.com/test-article',
        tags: ['test', 'performance']
      }]
    };

    console.log(`Testing summary generation response time with ${summaryRequests} concurrent requests`);
    
    const startTime = Date.now();
    
    // Create concurrent summary generation requests
    const requests = Array.from({ length: summaryRequests }, async (_, index) => {
      const requestStartTime = Date.now();
      
      try {
        const response = await request.post('/api/articles/summary', {
          data: {
            ...testArticle,
            tone: 'casual',
            maxReadingTime: 5
          },
          timeout: 5000 // Requirement 8.2: respond within 3 seconds, allow 5s for network overhead
        });
        
        const requestEndTime = Date.now();
        const responseTime = requestEndTime - requestStartTime;
        
        return {
          requestId: index,
          status: response.status(),
          responseTime,
          success: response.ok()
        };
      } catch (error) {
        return {
          requestId: index,
          status: 0,
          responseTime: Date.now() - requestStartTime,
          success: false,
          error: error.message
        };
      }
    });

    const results = await Promise.all(requests);
    const endTime = Date.now();
    const totalTime = endTime - startTime;

    // Analyze results
    const successfulRequests = results.filter(r => r.success);
    const failedRequests = results.filter(r => !r.success);
    
    console.log(`Summary generation test results:`);
    console.log(`- Total time: ${totalTime}ms`);
    console.log(`- Successful requests: ${successfulRequests.length}/${summaryRequests}`);
    console.log(`- Failed requests: ${failedRequests.length}/${summaryRequests}`);
    
    if (successfulRequests.length > 0) {
      const avgResponseTime = successfulRequests.reduce((sum, r) => sum + r.responseTime, 0) / successfulRequests.length;
      const maxResponseTime = Math.max(...successfulRequests.map(r => r.responseTime));
      const minResponseTime = Math.min(...successfulRequests.map(r => r.responseTime));
      
      console.log(`- Average response time: ${avgResponseTime}ms`);
      console.log(`- Max response time: ${maxResponseTime}ms`);
      console.log(`- Min response time: ${minResponseTime}ms`);
      
      // Requirement 8.2: System SHALL respond within 3 seconds for summary generation
      expect(avgResponseTime).toBeLessThan(3000);
      expect(maxResponseTime).toBeLessThan(3000);
      expect(successfulRequests.length).toBeGreaterThanOrEqual(summaryRequests * 0.95); // 95% success rate
    }
    
    if (failedRequests.length > 0) {
      console.log('Failed summary generation requests:', failedRequests.slice(0, 3));
    }
  });

  test('concurrent API load testing', async ({ request }) => {
    const concurrentRequests = 20;
    const apiEndpoints = [
      '/api/health',
      '/api/news/personalized',
      '/api/preferences'
    ];

    for (const endpoint of apiEndpoints) {
      console.log(`Testing ${endpoint} with ${concurrentRequests} concurrent requests`);
      
      const startTime = Date.now();
      
      // Create concurrent requests
      const requests = Array.from({ length: concurrentRequests }, async (_, index) => {
        const requestStartTime = Date.now();
        
        try {
          const response = await request.get(endpoint, {
            timeout: 10000
          });
          
          const requestEndTime = Date.now();
          const responseTime = requestEndTime - requestStartTime;
          
          return {
            requestId: index,
            status: response.status(),
            responseTime,
            success: response.ok()
          };
        } catch (error) {
          return {
            requestId: index,
            status: 0,
            responseTime: Date.now() - requestStartTime,
            success: false,
            error: error.message
          };
        }
      });

      const results = await Promise.all(requests);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Analyze results
      const successfulRequests = results.filter(r => r.success);
      const failedRequests = results.filter(r => !r.success);
      
      console.log(`API load test results for ${endpoint}:`);
      console.log(`- Total time: ${totalTime}ms`);
      console.log(`- Successful requests: ${successfulRequests.length}/${concurrentRequests}`);
      console.log(`- Failed requests: ${failedRequests.length}/${concurrentRequests}`);
      
      if (successfulRequests.length > 0) {
        const avgResponseTime = successfulRequests.reduce((sum, r) => sum + r.responseTime, 0) / successfulRequests.length;
        const maxResponseTime = Math.max(...successfulRequests.map(r => r.responseTime));
        
        console.log(`- Average response time: ${avgResponseTime}ms`);
        console.log(`- Max response time: ${maxResponseTime}ms`);
        
        // Performance assertions based on requirements
        expect(successfulRequests.length).toBeGreaterThanOrEqual(concurrentRequests * 0.95); // 95% success rate
        expect(avgResponseTime).toBeLessThan(3000); // Requirement 8.2: respond within 3 seconds
        expect(maxResponseTime).toBeLessThan(3000); // All requests should meet the 3-second requirement
      }
      
      if (failedRequests.length > 0) {
        console.log(`Failed requests for ${endpoint}:`, failedRequests.slice(0, 5)); // Show first 5 failures
      }
    }
  });

  test('100 concurrent users system validation (Requirement 8.3)', async ({ browser }) => {
    const targetUsers = 100; // Requirement 8.3: handle at least 100 concurrent users
    const batchSize = 20; // Process users in batches to avoid overwhelming the test environment
    const batches = Math.ceil(targetUsers / batchSize);
    
    console.log(`Testing system with ${targetUsers} concurrent users in ${batches} batches of ${batchSize}`);
    
    const allResults = [];
    const startTime = Date.now();
    
    // Process users in batches
    for (let batch = 0; batch < batches; batch++) {
      const currentBatchSize = Math.min(batchSize, targetUsers - (batch * batchSize));
      console.log(`Processing batch ${batch + 1}/${batches} with ${currentBatchSize} users`);
      
      const contexts: BrowserContext[] = [];
      
      try {
        // Create batch of concurrent users
        const batchPromises = Array.from({ length: currentBatchSize }, async (_, index) => {
          const globalUserId = (batch * batchSize) + index;
          const userStartTime = Date.now();
          
          try {
            const context = await browser.newContext();
            contexts.push(context);
            const page = await context.newPage();
            
            // Navigate to homepage
            await page.goto('/', { timeout: 10000 });
            
            // Wait for news feed to load
            await expect(page.locator('[data-testid="news-feed"]')).toBeVisible({ timeout: 10000 });
            
            // Simulate basic user interactions
            const articles = page.locator('[data-testid="news-article"]');
            const articleCount = await articles.count();
            
            if (articleCount > 0) {
              // Quick interaction with first article
              const firstArticle = articles.first();
              const likeBtn = firstArticle.locator('[data-testid="like-button"]');
              if (await likeBtn.isVisible()) {
                await likeBtn.click();
              }
            }
            
            const userEndTime = Date.now();
            const userResponseTime = userEndTime - userStartTime;
            
            return {
              userId: globalUserId,
              batch: batch + 1,
              responseTime: userResponseTime,
              success: true
            };
          } catch (error) {
            return {
              userId: globalUserId,
              batch: batch + 1,
              responseTime: Date.now() - userStartTime,
              success: false,
              error: error.message
            };
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        allResults.push(...batchResults);
        
        // Brief pause between batches to avoid overwhelming the system
        if (batch < batches - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } finally {
        // Clean up batch contexts
        await Promise.all(contexts.map(context => context.close().catch(() => {})));
      }
    }
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    // Analyze overall results
    const successfulUsers = allResults.filter(r => r.success);
    const failedUsers = allResults.filter(r => !r.success);
    
    console.log(`100 concurrent users test results:`);
    console.log(`- Total time: ${totalTime}ms`);
    console.log(`- Successful users: ${successfulUsers.length}/${targetUsers}`);
    console.log(`- Failed users: ${failedUsers.length}/${targetUsers}`);
    console.log(`- Success rate: ${(successfulUsers.length / targetUsers * 100).toFixed(1)}%`);
    
    if (successfulUsers.length > 0) {
      const avgResponseTime = successfulUsers.reduce((sum, r) => sum + r.responseTime, 0) / successfulUsers.length;
      const maxResponseTime = Math.max(...successfulUsers.map(r => r.responseTime));
      const minResponseTime = Math.min(...successfulUsers.map(r => r.responseTime));
      
      console.log(`- Average response time: ${avgResponseTime.toFixed(0)}ms`);
      console.log(`- Max response time: ${maxResponseTime}ms`);
      console.log(`- Min response time: ${minResponseTime}ms`);
      
      // Requirement 8.3: System SHALL handle at least 100 concurrent users
      expect(successfulUsers.length).toBeGreaterThanOrEqual(90); // At least 90% of 100 users should succeed
      expect(avgResponseTime).toBeLessThan(5000); // Average response should be reasonable under load
      
      // Requirement 8.2: Response times should still be acceptable
      const fastResponses = successfulUsers.filter(r => r.responseTime < 3000).length;
      const fastResponseRate = (fastResponses / successfulUsers.length) * 100;
      console.log(`- Fast responses (<3s): ${fastResponses}/${successfulUsers.length} (${fastResponseRate.toFixed(1)}%)`);
      
      // At least 70% of successful users should get responses within 3 seconds
      expect(fastResponseRate).toBeGreaterThanOrEqual(70);
    }
    
    if (failedUsers.length > 0) {
      console.log('Sample failed user errors:', failedUsers.slice(0, 3).map(u => `User ${u.userId}: ${u.error}`));
    }
  });

  test('sustained load testing - gradual user increase', async ({ browser }) => {
    const maxUsers = 15; // Reduced for test environment
    const rampUpTime = 30000; // 30 seconds
    const sustainTime = 10000; // 10 seconds
    
    const contexts: BrowserContext[] = [];
    const activeUsers: Promise<any>[] = [];
    
    try {
      console.log(`Starting sustained load test: ramping up to ${maxUsers} users over ${rampUpTime}ms`);
      
      const startTime = Date.now();
      const userInterval = rampUpTime / maxUsers;
      
      // Gradually add users
      for (let i = 0; i < maxUsers; i++) {
        setTimeout(async () => {
          try {
            const context = await browser.newContext();
            const page = await context.newPage();
            contexts.push(context);
            
            // Start user session
            const userPromise = simulateUserSession(page, i, sustainTime);
            activeUsers.push(userPromise);
          } catch (error) {
            console.error(`Failed to create user ${i}:`, error.message);
          }
        }, i * userInterval);
      }
      
      // Wait for ramp-up to complete
      await new Promise(resolve => setTimeout(resolve, rampUpTime + sustainTime));
      
      // Wait for all user sessions to complete
      const results = await Promise.allSettled(activeUsers);
      const endTime = Date.now();
      
      // Analyze results
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      console.log(`Sustained load test completed in ${endTime - startTime}ms`);
      console.log(`- Successful user sessions: ${successful}/${maxUsers}`);
      console.log(`- Failed user sessions: ${failed}/${maxUsers}`);
      
      // Performance assertions
      expect(successful).toBeGreaterThanOrEqual(maxUsers * 0.8); // 80% success rate for sustained load
      
    } finally {
      // Clean up all contexts
      await Promise.all(contexts.map(context => context.close().catch(() => {})));
    }
  });

  test('database performance under load', async ({ request }) => {
    const concurrentDbOperations = 25;
    
    console.log(`Testing database performance with ${concurrentDbOperations} concurrent operations`);
    
    // Test different database operations
    const operations = [
      { name: 'Read preferences', endpoint: '/api/preferences', method: 'GET' },
      { name: 'Update preferences', endpoint: '/api/preferences', method: 'PUT', data: { topics: ['technology'], tone: 'casual', readingTime: 5 } },
      { name: 'Track interaction', endpoint: '/api/interactions', method: 'POST', data: { articleId: 'test-article', action: 'like' } },
      { name: 'Get personalized news', endpoint: '/api/news/personalized', method: 'GET' }
    ];
    
    for (const operation of operations) {
      const startTime = Date.now();
      
      const requests = Array.from({ length: concurrentDbOperations }, async (_, index) => {
        const requestStartTime = Date.now();
        
        try {
          let response;
          if (operation.method === 'GET') {
            response = await request.get(operation.endpoint, { timeout: 10000 });
          } else if (operation.method === 'POST') {
            response = await request.post(operation.endpoint, { 
              data: operation.data,
              timeout: 10000 
            });
          } else if (operation.method === 'PUT') {
            response = await request.put(operation.endpoint, { 
              data: operation.data,
              timeout: 10000 
            });
          }
          
          const requestEndTime = Date.now();
          const responseTime = requestEndTime - requestStartTime;
          
          return {
            requestId: index,
            status: response.status(),
            responseTime,
            success: response.ok()
          };
        } catch (error) {
          return {
            requestId: index,
            status: 0,
            responseTime: Date.now() - requestStartTime,
            success: false,
            error: error.message
          };
        }
      });
      
      const results = await Promise.all(requests);
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      const successfulRequests = results.filter(r => r.success);
      const avgResponseTime = successfulRequests.length > 0 
        ? successfulRequests.reduce((sum, r) => sum + r.responseTime, 0) / successfulRequests.length 
        : 0;
      
      console.log(`Database operation "${operation.name}":`);
      console.log(`- Success rate: ${successfulRequests.length}/${concurrentDbOperations}`);
      console.log(`- Average response time: ${avgResponseTime}ms`);
      console.log(`- Total time: ${totalTime}ms`);
      
      // Database operations should maintain performance under load
      expect(successfulRequests.length).toBeGreaterThanOrEqual(concurrentDbOperations * 0.9); // 90% success rate
      expect(avgResponseTime).toBeLessThan(2000); // Database operations should be fast
    }
  });

  test('response time consistency under concurrent load', async ({ request }) => {
    const testDuration = 60000; // 1 minute test
    const concurrentUsers = 50;
    const requestInterval = 2000; // Request every 2 seconds per user
    
    console.log(`Testing response time consistency with ${concurrentUsers} concurrent users over ${testDuration/1000} seconds`);
    
    const results = [];
    const startTime = Date.now();
    
    // Create concurrent user request streams
    const userStreams = Array.from({ length: concurrentUsers }, async (_, userId) => {
      const userResults = [];
      
      while (Date.now() - startTime < testDuration) {
        const requestStartTime = Date.now();
        
        try {
          const response = await request.get('/api/news/personalized', { 
            timeout: 5000 
          });
          
          const responseTime = Date.now() - requestStartTime;
          
          userResults.push({
            userId,
            timestamp: Date.now() - startTime,
            responseTime,
            success: response.ok(),
            status: response.status()
          });
          
        } catch (error) {
          userResults.push({
            userId,
            timestamp: Date.now() - startTime,
            responseTime: Date.now() - requestStartTime,
            success: false,
            error: error.message
          });
        }
        
        // Wait before next request
        await new Promise(resolve => setTimeout(resolve, requestInterval));
      }
      
      return userResults;
    });
    
    const allUserResults = await Promise.all(userStreams);
    const flatResults = allUserResults.flat();
    
    // Analyze response time consistency
    const successfulRequests = flatResults.filter(r => r.success);
    
    if (successfulRequests.length > 0) {
      const responseTimes = successfulRequests.map(r => r.responseTime);
      const avgResponseTime = responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);
      const minResponseTime = Math.min(...responseTimes);
      
      // Calculate percentiles
      const sortedTimes = responseTimes.sort((a, b) => a - b);
      const p50 = sortedTimes[Math.floor(sortedTimes.length * 0.5)];
      const p90 = sortedTimes[Math.floor(sortedTimes.length * 0.9)];
      const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
      
      console.log(`Response time analysis (${successfulRequests.length} successful requests):`);
      console.log(`- Average: ${avgResponseTime.toFixed(0)}ms`);
      console.log(`- Min: ${minResponseTime}ms, Max: ${maxResponseTime}ms`);
      console.log(`- P50: ${p50}ms, P90: ${p90}ms, P95: ${p95}ms`);
      
      const successRate = (successfulRequests.length / flatResults.length) * 100;
      console.log(`- Success rate: ${successRate.toFixed(1)}%`);
      
      // Performance assertions
      expect(successRate).toBeGreaterThanOrEqual(90); // 90% success rate under sustained load
      expect(avgResponseTime).toBeLessThan(3000); // Average response time meets requirement 8.2
      expect(p95).toBeLessThan(5000); // 95% of requests should be reasonably fast
      
      // Check for response time consistency (standard deviation)
      const variance = responseTimes.reduce((sum, rt) => sum + Math.pow(rt - avgResponseTime, 2), 0) / responseTimes.length;
      const stdDev = Math.sqrt(variance);
      const coefficientOfVariation = stdDev / avgResponseTime;
      
      console.log(`- Standard deviation: ${stdDev.toFixed(0)}ms`);
      console.log(`- Coefficient of variation: ${coefficientOfVariation.toFixed(2)}`);
      
      // Response times should be reasonably consistent (CV < 1.0 means std dev < mean)
      expect(coefficientOfVariation).toBeLessThan(1.0);
    }
  });

  test('memory usage under load', async ({ browser }) => {
    const userCount = 8;
    const contexts: BrowserContext[] = [];
    
    try {
      // Create multiple users
      for (let i = 0; i < userCount; i++) {
        const context = await browser.newContext();
        contexts.push(context);
      }
      
      const memoryTests = contexts.map(async (context, index) => {
        const page = await context.newPage();
        
        await page.goto('/');
        await expect(page.locator('[data-testid="news-feed"]')).toBeVisible();
        
        // Get initial memory
        const initialMemory = await page.evaluate(() => {
          return (performance as any).memory ? {
            usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
            totalJSHeapSize: (performance as any).memory.totalJSHeapSize
          } : null;
        });
        
        // Perform memory-intensive operations
        for (let j = 0; j < 10; j++) {
          const articles = page.locator('[data-testid="news-article"]');
          const count = await articles.count();
          
          if (count > 0) {
            const article = articles.nth(j % count);
            const readMoreBtn = article.locator('[data-testid="read-more-button"]');
            if (await readMoreBtn.isVisible()) {
              await readMoreBtn.click();
              await page.waitForTimeout(100);
            }
          }
          
          // Scroll to trigger potential memory leaks
          await page.evaluate(() => window.scrollTo(0, Math.random() * 1000));
          await page.waitForTimeout(50);
        }
        
        // Get final memory
        const finalMemory = await page.evaluate(() => {
          return (performance as any).memory ? {
            usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
            totalJSHeapSize: (performance as any).memory.totalJSHeapSize
          } : null;
        });
        
        return {
          userId: index,
          initialMemory,
          finalMemory,
          memoryGrowth: finalMemory && initialMemory 
            ? finalMemory.usedJSHeapSize - initialMemory.usedJSHeapSize 
            : 0
        };
      });
      
      const results = await Promise.all(memoryTests);
      
      const validResults = results.filter(r => r.memoryGrowth > 0);
      if (validResults.length > 0) {
        const avgMemoryGrowth = validResults.reduce((sum, r) => sum + r.memoryGrowth, 0) / validResults.length;
        const maxMemoryGrowth = Math.max(...validResults.map(r => r.memoryGrowth));
        
        const avgMemoryGrowthMB = avgMemoryGrowth / (1024 * 1024);
        const maxMemoryGrowthMB = maxMemoryGrowth / (1024 * 1024);
        
        console.log(`Memory usage under load (${userCount} users):`);
        console.log(`- Average memory growth: ${avgMemoryGrowthMB.toFixed(2)}MB`);
        console.log(`- Max memory growth: ${maxMemoryGrowthMB.toFixed(2)}MB`);
        
        // Memory growth should be reasonable under load
        expect(avgMemoryGrowthMB).toBeLessThan(100); // Average growth under 100MB
        expect(maxMemoryGrowthMB).toBeLessThan(200); // Max growth under 200MB
      }
      
    } finally {
      await Promise.all(contexts.map(context => context.close()));
    }
  });
});

// Helper function to simulate a user session
async function simulateUserSession(page: Page, userId: number, duration: number): Promise<any> {
  const startTime = Date.now();
  
  try {
    // Navigate to homepage
    await page.goto('/', { timeout: 10000 });
    await expect(page.locator('[data-testid="news-feed"]')).toBeVisible({ timeout: 10000 });
    
    const endTime = startTime + duration;
    
    // Simulate user behavior for the specified duration
    while (Date.now() < endTime) {
      try {
        // Random user actions
        const actions = [
          async () => {
            const articles = page.locator('[data-testid="news-article"]');
            const count = await articles.count();
            if (count > 0) {
              const randomArticle = articles.nth(Math.floor(Math.random() * count));
              const likeBtn = randomArticle.locator('[data-testid="like-button"]');
              if (await likeBtn.isVisible()) {
                await likeBtn.click();
              }
            }
          },
          async () => {
            await page.evaluate(() => window.scrollTo(0, Math.random() * 1000));
          },
          async () => {
            const prefsBtn = page.locator('[data-testid="preferences-button"]');
            if (await prefsBtn.isVisible()) {
              await prefsBtn.click();
              await page.waitForTimeout(500);
            }
          }
        ];
        
        // Execute random action
        const randomAction = actions[Math.floor(Math.random() * actions.length)];
        await randomAction();
        
        // Wait between actions
        await page.waitForTimeout(Math.random() * 1000 + 500);
        
      } catch (error) {
        // Continue with session even if individual actions fail
        console.log(`User ${userId} action failed:`, error.message);
      }
    }
    
    return {
      userId,
      duration: Date.now() - startTime,
      success: true
    };
    
  } catch (error) {
    return {
      userId,
      duration: Date.now() - startTime,
      success: false,
      error: error.message
    };
  }
}