import { test, expect } from '@playwright/test';

test.describe('Performance Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Enable performance monitoring
    await page.goto('/', { waitUntil: 'networkidle' });
  });

  test('page load performance meets requirements', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/');
    await expect(page.locator('[data-testid="news-feed"]')).toBeVisible();
    
    const loadTime = Date.now() - startTime;
    
    // Requirement 8.2: Respond within 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });

  test('API response times are acceptable', async ({ page }) => {
    const apiResponses: number[] = [];
    
    // Monitor API response times
    page.on('response', response => {
      if (response.url().includes('/api/')) {
        const timing = response.timing();
        if (timing) {
          apiResponses.push(timing.responseEnd - timing.requestStart);
        }
      }
    });
    
    await page.goto('/');
    await expect(page.locator('[data-testid="news-feed"]')).toBeVisible();
    
    // Wait for API calls to complete
    await page.waitForTimeout(2000);
    
    if (apiResponses.length > 0) {
      const avgResponseTime = apiResponses.reduce((a, b) => a + b, 0) / apiResponses.length;
      
      // API responses should be under 3 seconds on average
      expect(avgResponseTime).toBeLessThan(3000);
      
      // No single API call should take more than 5 seconds
      const maxResponseTime = Math.max(...apiResponses);
      expect(maxResponseTime).toBeLessThan(5000);
    }
  });

  test('memory usage is reasonable', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-testid="news-feed"]')).toBeVisible();
    
    // Get initial memory usage
    const initialMemory = await page.evaluate(() => {
      return (performance as any).memory ? {
        usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
        totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
        jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
      } : null;
    });
    
    if (initialMemory) {
      // Interact with the page to generate some memory usage
      const articles = page.locator('[data-testid="news-article"]');
      const articleCount = await articles.count();
      
      for (let i = 0; i < Math.min(articleCount, 5); i++) {
        const article = articles.nth(i);
        const readMoreBtn = article.locator('[data-testid="read-more-button"]');
        if (await readMoreBtn.isVisible()) {
          await readMoreBtn.click();
          await page.waitForTimeout(100);
        }
      }
      
      // Check memory after interactions
      const finalMemory = await page.evaluate(() => {
        return (performance as any).memory ? {
          usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
          totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
          jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
        } : null;
      });
      
      if (finalMemory) {
        // Memory usage shouldn't grow excessively
        const memoryGrowth = finalMemory.usedJSHeapSize - initialMemory.usedJSHeapSize;
        const memoryGrowthMB = memoryGrowth / (1024 * 1024);
        
        // Memory growth should be reasonable (less than 50MB for basic interactions)
        expect(memoryGrowthMB).toBeLessThan(50);
      }
    }
  });

  test('Core Web Vitals are within acceptable ranges', async ({ page }) => {
    await page.goto('/');
    
    // Wait for page to fully load
    await expect(page.locator('[data-testid="news-feed"]')).toBeVisible();
    await page.waitForTimeout(3000);
    
    const webVitals = await page.evaluate(() => {
      return new Promise((resolve) => {
        const vitals: any = {};
        
        // Largest Contentful Paint (LCP)
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          vitals.lcp = lastEntry.startTime;
        }).observe({ entryTypes: ['largest-contentful-paint'] });
        
        // First Input Delay (FID) - simulated
        vitals.fid = 0; // Will be 0 in automated tests
        
        // Cumulative Layout Shift (CLS)
        let clsValue = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              clsValue += (entry as any).value;
            }
          }
          vitals.cls = clsValue;
        }).observe({ entryTypes: ['layout-shift'] });
        
        // First Contentful Paint (FCP)
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          vitals.fcp = entries[0].startTime;
        }).observe({ entryTypes: ['paint'] });
        
        setTimeout(() => resolve(vitals), 2000);
      });
    });
    
    const vitals = webVitals as any;
    
    // LCP should be under 2.5 seconds (good)
    if (vitals.lcp) {
      expect(vitals.lcp).toBeLessThan(2500);
    }
    
    // FCP should be under 1.8 seconds (good)
    if (vitals.fcp) {
      expect(vitals.fcp).toBeLessThan(1800);
    }
    
    // CLS should be under 0.1 (good)
    if (vitals.cls !== undefined) {
      expect(vitals.cls).toBeLessThan(0.1);
    }
  });

  test('page handles rapid interactions without performance degradation', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-testid="news-feed"]')).toBeVisible();
    
    const startTime = Date.now();
    
    // Perform rapid interactions
    const articles = page.locator('[data-testid="news-article"]');
    const articleCount = await articles.count();
    
    for (let round = 0; round < 3; round++) {
      for (let i = 0; i < Math.min(articleCount, 5); i++) {
        const article = articles.nth(i);
        
        // Rapid clicking on various elements
        const likeBtn = article.locator('[data-testid="like-button"]');
        if (await likeBtn.isVisible()) {
          await likeBtn.click();
        }
        
        const hideBtn = article.locator('[data-testid="hide-source-button"]');
        if (await hideBtn.isVisible()) {
          await hideBtn.click();
        }
        
        // Small delay to prevent overwhelming
        await page.waitForTimeout(50);
      }
    }
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    // Rapid interactions should complete within reasonable time
    expect(totalTime).toBeLessThan(10000); // 10 seconds max
    
    // Page should still be responsive
    await expect(page.locator('[data-testid="news-feed"]')).toBeVisible();
  });

  test('large dataset handling performance', async ({ page }) => {
    // Mock API to return large dataset
    await page.route('**/api/news/personalized', route => {
      const largeDataset = {
        articles: Array.from({ length: 100 }, (_, i) => ({
          id: `article-${i}`,
          headline: `Test Article ${i}`,
          summary: `This is a test summary for article ${i}. `.repeat(10),
          source: 'Test Source',
          timestamp: new Date().toISOString(),
          keyPoints: [`Point 1 for article ${i}`, `Point 2 for article ${i}`],
          url: `https://example.com/article-${i}`
        }))
      };
      
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(largeDataset)
      });
    });
    
    const startTime = Date.now();
    
    await page.goto('/');
    await expect(page.locator('[data-testid="news-feed"]')).toBeVisible();
    
    const loadTime = Date.now() - startTime;
    
    // Should handle large datasets within reasonable time
    expect(loadTime).toBeLessThan(5000);
    
    // Check that articles are rendered
    const articles = page.locator('[data-testid="news-article"]');
    const articleCount = await articles.count();
    expect(articleCount).toBeGreaterThan(0);
    
    // Scrolling should be smooth with large datasets
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    
    await page.waitForTimeout(500);
    
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    
    await page.waitForTimeout(500);
    
    // Page should still be responsive after scrolling
    await expect(page.locator('[data-testid="news-feed"]')).toBeVisible();
  });

  test('network error recovery performance', async ({ page }) => {
    let requestCount = 0;
    
    // Simulate intermittent network failures
    await page.route('**/api/news/personalized', route => {
      requestCount++;
      
      if (requestCount <= 2) {
        // Fail first two requests
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Network error' })
        });
      } else {
        // Succeed on third request
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            articles: [{
              id: 'test-1',
              headline: 'Test Article',
              summary: 'Test summary',
              source: 'Test Source',
              timestamp: new Date().toISOString(),
              keyPoints: ['Test point'],
              url: 'https://example.com'
            }]
          })
        });
      }
    });
    
    const startTime = Date.now();
    
    await page.goto('/');
    
    // Should eventually show content despite initial failures
    await expect(page.locator('[data-testid="news-feed"]')).toBeVisible({ timeout: 10000 });
    
    const recoveryTime = Date.now() - startTime;
    
    // Recovery should happen within reasonable time
    expect(recoveryTime).toBeLessThan(10000);
    expect(requestCount).toBeGreaterThanOrEqual(3); // Should have retried
  });

  test('concurrent user simulation', async ({ page, context }) => {
    // Simulate multiple concurrent operations
    const promises = [];
    
    // Navigate to page
    promises.push(page.goto('/'));
    
    // Wait for initial load
    await Promise.all(promises);
    await expect(page.locator('[data-testid="news-feed"]')).toBeVisible();
    
    // Simulate concurrent user actions
    const concurrentActions = [];
    
    // Action 1: Navigate to preferences
    concurrentActions.push(async () => {
      const prefsBtn = page.locator('[data-testid="preferences-button"]');
      if (await prefsBtn.isVisible()) {
        await prefsBtn.click();
        await page.waitForTimeout(100);
      }
    });
    
    // Action 2: Interact with articles
    concurrentActions.push(async () => {
      const articles = page.locator('[data-testid="news-article"]');
      const count = await articles.count();
      if (count > 0) {
        const likeBtn = articles.first().locator('[data-testid="like-button"]');
        if (await likeBtn.isVisible()) {
          await likeBtn.click();
        }
      }
    });
    
    // Action 3: Scroll page
    concurrentActions.push(async () => {
      await page.evaluate(() => window.scrollTo(0, 500));
      await page.waitForTimeout(100);
    });
    
    const startTime = Date.now();
    
    // Execute all actions concurrently
    await Promise.all(concurrentActions.map(action => action()));
    
    const executionTime = Date.now() - startTime;
    
    // Concurrent actions should complete quickly
    expect(executionTime).toBeLessThan(2000);
    
    // Page should remain functional
    await expect(page.locator('body')).toBeVisible();
  });

  test('resource loading optimization', async ({ page }) => {
    const resourceSizes: number[] = [];
    const resourceTypes: string[] = [];
    
    // Monitor resource loading
    page.on('response', response => {
      const contentLength = response.headers()['content-length'];
      if (contentLength) {
        resourceSizes.push(parseInt(contentLength));
      }
      
      const contentType = response.headers()['content-type'];
      if (contentType) {
        resourceTypes.push(contentType);
      }
    });
    
    await page.goto('/');
    await expect(page.locator('[data-testid="news-feed"]')).toBeVisible();
    
    // Wait for all resources to load
    await page.waitForTimeout(3000);
    
    if (resourceSizes.length > 0) {
      const totalSize = resourceSizes.reduce((a, b) => a + b, 0);
      const totalSizeMB = totalSize / (1024 * 1024);
      
      // Total page size should be reasonable (under 5MB)
      expect(totalSizeMB).toBeLessThan(5);
      
      // Check for appropriate resource types
      const hasHTML = resourceTypes.some(type => type.includes('text/html'));
      const hasCSS = resourceTypes.some(type => type.includes('text/css'));
      const hasJS = resourceTypes.some(type => type.includes('javascript'));
      
      expect(hasHTML).toBe(true);
      // CSS and JS might be inlined in Next.js, so we don't strictly require them
    }
  });
});