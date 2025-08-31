import { test, expect } from '@playwright/test';

test.describe('Scalability Tests', () => {
  test.describe.configure({ mode: 'parallel' });

  test('API endpoint scalability under increasing load', async ({ request }) => {
    const loadLevels = [10, 25, 50, 100]; // Concurrent requests per level, testing up to 100 (Requirement 8.3)
    const endpoints = [
      { path: '/api/health', name: 'Health Check' },
      { path: '/api/news/personalized', name: 'Personalized News' },
      { path: '/api/preferences', name: 'User Preferences' }
    ];

    for (const endpoint of endpoints) {
      console.log(`\nTesting scalability for ${endpoint.name} (${endpoint.path})`);
      
      const results = [];
      
      for (const loadLevel of loadLevels) {
        console.log(`Testing with ${loadLevel} concurrent requests...`);
        
        const startTime = Date.now();
        
        // Create concurrent requests
        const requests = Array.from({ length: loadLevel }, async (_, index) => {
          const requestStartTime = Date.now();
          
          try {
            const response = await request.get(endpoint.path, {
              timeout: 15000
            });
            
            const responseTime = Date.now() - requestStartTime;
            
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

        const requestResults = await Promise.all(requests);
        const totalTime = Date.now() - startTime;
        
        const successful = requestResults.filter(r => r.success);
        const avgResponseTime = successful.length > 0 
          ? successful.reduce((sum, r) => sum + r.responseTime, 0) / successful.length 
          : 0;
        const maxResponseTime = successful.length > 0 
          ? Math.max(...successful.map(r => r.responseTime)) 
          : 0;
        const successRate = (successful.length / loadLevel) * 100;
        
        const result = {
          loadLevel,
          totalTime,
          successRate,
          avgResponseTime,
          maxResponseTime,
          throughput: (successful.length / totalTime) * 1000 // requests per second
        };
        
        results.push(result);
        
        console.log(`  Load Level ${loadLevel}: ${successRate.toFixed(1)}% success, ` +
                   `${avgResponseTime.toFixed(0)}ms avg, ${result.throughput.toFixed(2)} req/s`);
        
        // Performance should not degrade significantly with increased load
        expect(successRate).toBeGreaterThanOrEqual(85); // 85% success rate minimum under high load
        expect(avgResponseTime).toBeLessThan(3000); // Response time should meet requirement 8.2
      }
      
      // Analyze scalability trends
      console.log(`\nScalability analysis for ${endpoint.name}:`);
      
      // Check if performance degrades linearly or worse
      const firstResult = results[0];
      const lastResult = results[results.length - 1];
      
      const loadIncrease = lastResult.loadLevel / firstResult.loadLevel;
      const responseTimeIncrease = lastResult.avgResponseTime / firstResult.avgResponseTime;
      
      console.log(`  Load increased by ${loadIncrease}x, response time increased by ${responseTimeIncrease.toFixed(2)}x`);
      
      // Response time should not increase more than 3x when load increases
      expect(responseTimeIncrease).toBeLessThan(3);
      
      // Success rate should remain stable
      expect(lastResult.successRate).toBeGreaterThanOrEqual(firstResult.successRate - 10);
    }
  });

  test('database connection scalability', async ({ request }) => {
    const connectionLevels = [5, 10, 15, 20];
    
    console.log('\nTesting database connection scalability...');
    
    for (const connectionLevel of connectionLevels) {
      console.log(`Testing with ${connectionLevel} concurrent database operations...`);
      
      const startTime = Date.now();
      
      // Mix of database operations
      const operations = Array.from({ length: connectionLevel }, (_, index) => {
        const operationType = index % 4;
        
        switch (operationType) {
          case 0:
            return request.get('/api/preferences');
          case 1:
            return request.put('/api/preferences', {
              data: { topics: ['technology'], tone: 'casual', readingTime: 5 }
            });
          case 2:
            return request.post('/api/interactions', {
              data: { articleId: `test-${index}`, action: 'like' }
            });
          case 3:
            return request.get('/api/news/personalized');
          default:
            return request.get('/api/health');
        }
      });
      
      try {
        const results = await Promise.allSettled(operations);
        const totalTime = Date.now() - startTime;
        
        const successful = results.filter(r => r.status === 'fulfilled').length;
        const successRate = (successful / connectionLevel) * 100;
        const throughput = (successful / totalTime) * 1000;
        
        console.log(`  ${connectionLevel} connections: ${successRate.toFixed(1)}% success, ` +
                   `${totalTime}ms total, ${throughput.toFixed(2)} ops/s`);
        
        // Database should handle concurrent connections well
        expect(successRate).toBeGreaterThanOrEqual(85); // 85% success rate for DB operations
        expect(totalTime).toBeLessThan(10000); // Should complete within 10 seconds
        
      } catch (error) {
        console.error(`Database scalability test failed at ${connectionLevel} connections:`, error.message);
        throw error;
      }
    }
  });

  test('memory scalability with increasing data size', async ({ page }) => {
    const dataSizes = [10, 25, 50, 100]; // Number of articles to simulate
    
    console.log('\nTesting memory scalability with increasing data sizes...');
    
    for (const dataSize of dataSizes) {
      console.log(`Testing with ${dataSize} articles...`);
      
      // Mock API to return specified number of articles
      await page.route('**/api/news/personalized', route => {
        const articles = Array.from({ length: dataSize }, (_, i) => ({
          id: `article-${i}`,
          headline: `Test Article ${i} - ${new Array(20).fill('word').join(' ')}`,
          summary: `This is a comprehensive test summary for article ${i}. `.repeat(15),
          source: `Test Source ${i % 5}`,
          timestamp: new Date().toISOString(),
          keyPoints: Array.from({ length: 5 }, (_, j) => `Key point ${j + 1} for article ${i}`),
          url: `https://example.com/article-${i}`
        }));
        
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ articles })
        });
      });
      
      const startTime = Date.now();
      
      await page.goto('/');
      await expect(page.locator('[data-testid="news-feed"]')).toBeVisible({ timeout: 15000 });
      
      const loadTime = Date.now() - startTime;
      
      // Get memory usage
      const memoryUsage = await page.evaluate(() => {
        return (performance as any).memory ? {
          usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
          totalJSHeapSize: (performance as any).memory.totalJSHeapSize
        } : null;
      });
      
      // Check DOM size
      const domSize = await page.evaluate(() => {
        return document.querySelectorAll('*').length;
      });
      
      // Verify articles are rendered
      const renderedArticles = await page.locator('[data-testid="news-article"]').count();
      
      console.log(`  ${dataSize} articles: ${loadTime}ms load time, ` +
                 `${renderedArticles} rendered, ${domSize} DOM elements`);
      
      if (memoryUsage) {
        const memoryMB = memoryUsage.usedJSHeapSize / (1024 * 1024);
        console.log(`    Memory usage: ${memoryMB.toFixed(2)}MB`);
        
        // Memory usage should scale reasonably
        expect(memoryMB).toBeLessThan(dataSize * 2); // Rough heuristic: less than 2MB per article
      }
      
      // Performance should remain acceptable even with large datasets
      expect(loadTime).toBeLessThan(8000); // Should load within 8 seconds
      expect(renderedArticles).toBeGreaterThan(0); // Articles should be rendered
      
      // Test scrolling performance with large dataset
      const scrollStartTime = Date.now();
      
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight / 2);
      });
      
      await page.waitForTimeout(500);
      
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      
      const scrollTime = Date.now() - scrollStartTime;
      
      // Scrolling should remain smooth
      expect(scrollTime).toBeLessThan(2000);
      
      // Clean up for next iteration
      await page.unroute('**/api/news/personalized');
    }
  });

  test('concurrent user session scalability up to 100 users (Requirement 8.3)', async ({ browser }) => {
    const userCounts = [10, 25, 50, 100]; // Progressive user counts up to requirement 8.3
    
    console.log('\nTesting concurrent user session scalability...');
    
    for (const userCount of userCounts) {
      console.log(`Testing with ${userCount} concurrent users...`);
      
      const contexts = [];
      const startTime = Date.now();
      
      try {
        // Create user sessions
        const userSessions = Array.from({ length: userCount }, async (_, index) => {
          const context = await browser.newContext();
          contexts.push(context);
          const page = await context.newPage();
          
          const userStartTime = Date.now();
          
          try {
            // Navigate and interact
            await page.goto('/', { timeout: 15000 });
            await expect(page.locator('[data-testid="news-feed"]')).toBeVisible({ timeout: 15000 });
            
            // Simulate user interactions
            const articles = page.locator('[data-testid="news-article"]');
            const articleCount = await articles.count();
            
            if (articleCount > 0) {
              // Interact with a few articles
              for (let i = 0; i < Math.min(3, articleCount); i++) {
                const article = articles.nth(i);
                const likeBtn = article.locator('[data-testid="like-button"]');
                if (await likeBtn.isVisible()) {
                  await likeBtn.click();
                  await page.waitForTimeout(200);
                }
              }
              
              // Try preferences
              const prefsBtn = page.locator('[data-testid="preferences-button"]');
              if (await prefsBtn.isVisible()) {
                await prefsBtn.click();
                await page.waitForTimeout(500);
              }
            }
            
            const userEndTime = Date.now();
            
            return {
              userId: index,
              responseTime: userEndTime - userStartTime,
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
        
        const results = await Promise.all(userSessions);
        const totalTime = Date.now() - startTime;
        
        const successful = results.filter(r => r.success);
        const successRate = (successful.length / userCount) * 100;
        const avgResponseTime = successful.length > 0 
          ? successful.reduce((sum, r) => sum + r.responseTime, 0) / successful.length 
          : 0;
        
        console.log(`  ${userCount} users: ${successRate.toFixed(1)}% success, ` +
                   `${avgResponseTime.toFixed(0)}ms avg response, ${totalTime}ms total`);
        
        // System should handle concurrent users well (Requirements 8.2 and 8.3)
        if (userCount === 100) {
          // Special validation for 100 concurrent users (Requirement 8.3)
          expect(successRate).toBeGreaterThanOrEqual(75); // 75% success rate for 100 users
          expect(avgResponseTime).toBeLessThan(5000); // Slightly relaxed for 100 users
        } else {
          expect(successRate).toBeGreaterThanOrEqual(85); // 85% success rate for lower loads
          expect(avgResponseTime).toBeLessThan(3000); // Meet requirement 8.2
        }
        expect(totalTime).toBeLessThan(30000); // Total test time reasonable
        
      } finally {
        // Clean up contexts
        await Promise.all(contexts.map(context => context.close().catch(() => {})));
      }
    }
  });

  test('API response time consistency under varying load', async ({ request }) => {
    const testDuration = 30000; // 30 seconds
    const requestInterval = 500; // Request every 500ms
    const burstInterval = 5000; // Burst every 5 seconds
    const burstSize = 10; // 10 requests per burst
    
    console.log('\nTesting API response time consistency under varying load...');
    
    const results = [];
    const startTime = Date.now();
    
    // Regular requests
    const regularRequestInterval = setInterval(async () => {
      if (Date.now() - startTime >= testDuration) {
        clearInterval(regularRequestInterval);
        return;
      }
      
      const requestStartTime = Date.now();
      
      try {
        const response = await request.get('/api/news/personalized', { timeout: 10000 });
        const responseTime = Date.now() - requestStartTime;
        
        results.push({
          type: 'regular',
          timestamp: Date.now() - startTime,
          responseTime,
          success: response.ok()
        });
      } catch (error) {
        results.push({
          type: 'regular',
          timestamp: Date.now() - startTime,
          responseTime: Date.now() - requestStartTime,
          success: false
        });
      }
    }, requestInterval);
    
    // Burst requests
    const burstInterval_id = setInterval(async () => {
      if (Date.now() - startTime >= testDuration) {
        clearInterval(burstInterval_id);
        return;
      }
      
      console.log(`Sending burst of ${burstSize} requests...`);
      
      const burstPromises = Array.from({ length: burstSize }, async () => {
        const requestStartTime = Date.now();
        
        try {
          const response = await request.get('/api/health', { timeout: 10000 });
          const responseTime = Date.now() - requestStartTime;
          
          return {
            type: 'burst',
            timestamp: Date.now() - startTime,
            responseTime,
            success: response.ok()
          };
        } catch (error) {
          return {
            type: 'burst',
            timestamp: Date.now() - startTime,
            responseTime: Date.now() - requestStartTime,
            success: false
          };
        }
      });
      
      const burstResults = await Promise.all(burstPromises);
      results.push(...burstResults);
      
    }, burstInterval);
    
    // Wait for test duration
    await new Promise(resolve => setTimeout(resolve, testDuration));
    
    // Clean up intervals
    clearInterval(regularRequestInterval);
    clearInterval(burstInterval_id);
    
    // Analyze results
    const regularRequests = results.filter(r => r.type === 'regular' && r.success);
    const burstRequests = results.filter(r => r.type === 'burst' && r.success);
    
    if (regularRequests.length > 0 && burstRequests.length > 0) {
      const regularAvg = regularRequests.reduce((sum, r) => sum + r.responseTime, 0) / regularRequests.length;
      const burstAvg = burstRequests.reduce((sum, r) => sum + r.responseTime, 0) / burstRequests.length;
      
      const regularMax = Math.max(...regularRequests.map(r => r.responseTime));
      const burstMax = Math.max(...burstRequests.map(r => r.responseTime));
      
      console.log(`Regular requests: ${regularAvg.toFixed(0)}ms avg, ${regularMax}ms max`);
      console.log(`Burst requests: ${burstAvg.toFixed(0)}ms avg, ${burstMax}ms max`);
      
      // Response times should remain consistent
      expect(regularAvg).toBeLessThan(3000); // Regular requests under 3s
      expect(burstAvg).toBeLessThan(5000); // Burst requests under 5s
      
      // Burst shouldn't cause excessive degradation
      const degradationRatio = burstAvg / regularAvg;
      expect(degradationRatio).toBeLessThan(3); // Burst shouldn't be more than 3x slower
    }
    
    const totalSuccessRate = (results.filter(r => r.success).length / results.length) * 100;
    console.log(`Overall success rate: ${totalSuccessRate.toFixed(1)}%`);
    
    expect(totalSuccessRate).toBeGreaterThanOrEqual(85); // 85% overall success rate
  });

  test('system recovery after load spikes', async ({ request }) => {
    console.log('\nTesting system recovery after load spikes...');
    
    // Phase 1: Normal load
    console.log('Phase 1: Establishing baseline performance...');
    const baselineRequests = Array.from({ length: 5 }, () => 
      request.get('/api/health', { timeout: 10000 })
    );
    
    const baselineResults = await Promise.allSettled(baselineRequests);
    const baselineSuccess = baselineResults.filter(r => r.status === 'fulfilled').length;
    
    console.log(`Baseline: ${baselineSuccess}/5 requests successful`);
    
    // Phase 2: Load spike
    console.log('Phase 2: Generating load spike...');
    const spikeSize = 25;
    const spikeRequests = Array.from({ length: spikeSize }, () => 
      request.get('/api/news/personalized', { timeout: 15000 })
    );
    
    const spikeStartTime = Date.now();
    const spikeResults = await Promise.allSettled(spikeRequests);
    const spikeTime = Date.now() - spikeStartTime;
    const spikeSuccess = spikeResults.filter(r => r.status === 'fulfilled').length;
    
    console.log(`Load spike: ${spikeSuccess}/${spikeSize} requests successful in ${spikeTime}ms`);
    
    // Phase 3: Recovery period
    console.log('Phase 3: Testing recovery...');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    
    const recoveryRequests = Array.from({ length: 5 }, () => 
      request.get('/api/health', { timeout: 10000 })
    );
    
    const recoveryResults = await Promise.allSettled(recoveryRequests);
    const recoverySuccess = recoveryResults.filter(r => r.status === 'fulfilled').length;
    
    console.log(`Recovery: ${recoverySuccess}/5 requests successful`);
    
    // System should recover to baseline performance
    expect(recoverySuccess).toBeGreaterThanOrEqual(baselineSuccess); // Should recover to baseline
    expect(spikeSuccess).toBeGreaterThanOrEqual(spikeSize * 0.7); // Spike should have reasonable success rate
  });
});