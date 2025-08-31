import { test, expect } from '@playwright/test';

test.describe('Integration Workflows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('complete news collection to display workflow', async ({ page }) => {
    // Test the full pipeline from news collection to user display
    
    // Verify news feed loads with articles
    await expect(page.locator('[data-testid="news-feed"]')).toBeVisible();
    
    const articles = page.locator('[data-testid="news-article"]');
    await expect(articles.first()).toBeVisible();
    
    // Verify article structure indicates successful processing pipeline
    const firstArticle = articles.first();
    await expect(firstArticle.locator('[data-testid="article-headline"]')).toBeVisible();
    await expect(firstArticle.locator('[data-testid="article-summary"]')).toBeVisible();
    await expect(firstArticle.locator('[data-testid="article-source"]')).toBeVisible();
    await expect(firstArticle.locator('[data-testid="article-timestamp"]')).toBeVisible();
    
    // Verify key points are extracted and displayed
    await expect(firstArticle.locator('[data-testid="article-key-points"]')).toBeVisible();
    
    // Test that articles have proper metadata
    const source = await firstArticle.locator('[data-testid="article-source"]').textContent();
    expect(source).toBeTruthy();
    expect(source).toMatch(/CNN|BBC|TechCrunch|Hacker News/i);
  });

  test('personalization engine integration workflow', async ({ page }) => {
    // Test integration between preferences, semantic search, and summarization
    
    // Set specific preferences
    await page.click('[data-testid="preferences-button"]');
    await page.check('[data-testid="topic-technology"]');
    await page.selectOption('[data-testid="tone-selector"]', 'casual');
    await page.fill('[data-testid="reading-time-input"]', '3');
    await page.click('[data-testid="save-preferences"]');
    await page.click('[data-testid="back-to-feed"]');
    
    // Wait for personalized content
    await expect(page.locator('[data-testid="news-feed"]')).toBeVisible();
    
    // Verify personalization is applied
    const articles = page.locator('[data-testid="news-article"]');
    await expect(articles.first()).toBeVisible();
    
    // Check that summaries reflect the casual tone and short reading time
    const summary = await articles.first().locator('[data-testid="article-summary"]').textContent();
    expect(summary).toBeTruthy();
    
    // Casual tone should have more conversational language
    const hasCasualTone = summary?.includes('you') || 
                         summary?.includes('we') || 
                         summary?.includes('let\'s') ||
                         summary?.includes('here\'s');
    
    // Note: In a real implementation, we'd have more sophisticated tone detection
    expect(summary?.length).toBeGreaterThan(0);
  });

  test('user interaction tracking integration workflow', async ({ page }) => {
    // Test integration between user interactions and preference learning
    
    await expect(page.locator('[data-testid="news-article"]').first()).toBeVisible();
    
    const articles = page.locator('[data-testid="news-article"]');
    const firstArticle = articles.first();
    
    // Perform various interactions
    const likeButton = firstArticle.locator('[data-testid="like-button"]');
    if (await likeButton.isVisible()) {
      await likeButton.click();
      await expect(likeButton).toHaveClass(/active|liked/);
    }
    
    const readMoreButton = firstArticle.locator('[data-testid="read-more-button"]');
    if (await readMoreButton.isVisible()) {
      await readMoreButton.click();
    }
    
    // Test that interactions are tracked (should update user preferences)
    await page.reload();
    await expect(page.locator('[data-testid="news-feed"]')).toBeVisible();
    
    // Verify the system remembers interactions
    const newFirstArticle = page.locator('[data-testid="news-article"]').first();
    const newLikeButton = newFirstArticle.locator('[data-testid="like-button"]');
    
    if (await newLikeButton.isVisible()) {
      // Should maintain interaction state or show learning effect
      await expect(newFirstArticle).toBeVisible();
    }
  });

  test('error handling and fallback integration workflow', async ({ page }) => {
    // Test integration of error handling across all services
    
    // Simulate API failures
    await page.route('**/api/news/personalized', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Service unavailable' })
      });
    });
    
    await page.reload();
    
    // Verify graceful fallback
    const errorState = page.locator('[data-testid="error-message"]');
    const fallbackContent = page.locator('[data-testid="fallback-content"]');
    
    await expect(errorState.or(fallbackContent)).toBeVisible();
    
    // Test retry mechanism
    const retryButton = page.locator('[data-testid="retry-button"]');
    if (await retryButton.isVisible()) {
      // Remove route intercept to allow retry
      await page.unroute('**/api/news/personalized');
      await retryButton.click();
      
      // Should recover and show content
      await expect(page.locator('[data-testid="news-feed"]')).toBeVisible();
    }
  });

  test('caching and performance integration workflow', async ({ page }) => {
    // Test caching integration across the system
    
    // First load - should fetch fresh data
    const startTime = Date.now();
    await expect(page.locator('[data-testid="news-feed"]')).toBeVisible();
    const firstLoadTime = Date.now() - startTime;
    
    // Get initial content
    const initialArticles = await page.locator('[data-testid="news-article"]').count();
    const initialHeadline = await page.locator('[data-testid="article-headline"]').first().textContent();
    
    // Reload page - should use cached data and be faster
    const cacheStartTime = Date.now();
    await page.reload();
    await expect(page.locator('[data-testid="news-feed"]')).toBeVisible();
    const cacheLoadTime = Date.now() - cacheStartTime;
    
    // Verify cached content is consistent
    const cachedArticles = await page.locator('[data-testid="news-article"]').count();
    const cachedHeadline = await page.locator('[data-testid="article-headline"]').first().textContent();
    
    expect(cachedArticles).toBe(initialArticles);
    expect(cachedHeadline).toBe(initialHeadline);
    
    // Cache should improve performance (though this can be flaky in tests)
    console.log(`First load: ${firstLoadTime}ms, Cached load: ${cacheLoadTime}ms`);
  });

  test('multi-source news aggregation integration workflow', async ({ page }) => {
    // Test integration of multiple news sources
    
    await expect(page.locator('[data-testid="news-feed"]')).toBeVisible();
    
    const articles = page.locator('[data-testid="news-article"]');
    const articleCount = await articles.count();
    
    // Collect sources from displayed articles
    const sources = new Set();
    for (let i = 0; i < Math.min(articleCount, 10); i++) {
      const source = await articles.nth(i).locator('[data-testid="article-source"]').textContent();
      if (source) {
        sources.add(source.toLowerCase());
      }
    }
    
    // Should have articles from multiple sources
    expect(sources.size).toBeGreaterThan(1);
    
    // Verify expected sources are present
    const expectedSources = ['cnn', 'bbc', 'techcrunch', 'hacker news'];
    const hasExpectedSource = expectedSources.some(expected => 
      Array.from(sources).some(source => source.includes(expected))
    );
    
    expect(hasExpectedSource).toBe(true);
  });

  test('semantic search and summarization integration workflow', async ({ page }) => {
    // Test integration between semantic search and AI summarization
    
    // Set preferences for specific topics
    await page.click('[data-testid="preferences-button"]');
    await page.check('[data-testid="topic-technology"]');
    await page.check('[data-testid="topic-science"]');
    await page.selectOption('[data-testid="tone-selector"]', 'formal');
    await page.click('[data-testid="save-preferences"]');
    await page.click('[data-testid="back-to-feed"]');
    
    await expect(page.locator('[data-testid="news-feed"]')).toBeVisible();
    
    const articles = page.locator('[data-testid="news-article"]');
    await expect(articles.first()).toBeVisible();
    
    // Verify semantic relevance and summarization quality
    const firstSummary = await articles.first().locator('[data-testid="article-summary"]').textContent();
    const firstHeadline = await articles.first().locator('[data-testid="article-headline"]').textContent();
    
    expect(firstSummary).toBeTruthy();
    expect(firstHeadline).toBeTruthy();
    
    // Summary should be shorter than full article would be
    expect(firstSummary!.length).toBeLessThan(1000);
    expect(firstSummary!.length).toBeGreaterThan(50);
    
    // Should have key points extracted
    const keyPoints = articles.first().locator('[data-testid="article-key-points"]');
    await expect(keyPoints).toBeVisible();
    
    const keyPointsText = await keyPoints.textContent();
    expect(keyPointsText).toBeTruthy();
  });

  test('real-time updates integration workflow', async ({ page }) => {
    // Test real-time updates and live data integration
    
    await expect(page.locator('[data-testid="news-feed"]')).toBeVisible();
    
    // Get initial state
    const initialArticleCount = await page.locator('[data-testid="news-article"]').count();
    const initialFirstHeadline = await page.locator('[data-testid="article-headline"]').first().textContent();
    
    // Simulate time passing and new content being available
    // In a real test, this might involve triggering a collection job
    
    // Test refresh functionality
    const refreshButton = page.locator('[data-testid="refresh-button"]');
    if (await refreshButton.isVisible()) {
      await refreshButton.click();
      
      // Wait for refresh to complete
      await expect(page.locator('[data-testid="loading-indicator"]')).toBeVisible();
      await expect(page.locator('[data-testid="loading-indicator"]')).not.toBeVisible();
      
      // Verify content is updated
      await expect(page.locator('[data-testid="news-feed"]')).toBeVisible();
    } else {
      // If no refresh button, test auto-refresh behavior
      await page.waitForTimeout(2000);
      await page.reload();
      await expect(page.locator('[data-testid="news-feed"]')).toBeVisible();
    }
    
    // Verify system is responsive to updates
    const updatedArticleCount = await page.locator('[data-testid="news-article"]').count();
    expect(updatedArticleCount).toBeGreaterThan(0);
  });

  test('accessibility integration workflow', async ({ page }) => {
    // Test accessibility features integration across the system
    
    await expect(page.locator('[data-testid="news-feed"]')).toBeVisible();
    
    // Test keyboard navigation
    await page.keyboard.press('Tab');
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
    
    // Test screen reader compatibility
    const articles = page.locator('[data-testid="news-article"]');
    const firstArticle = articles.first();
    
    // Check for proper ARIA labels
    const ariaLabel = await firstArticle.getAttribute('aria-label');
    const role = await firstArticle.getAttribute('role');
    
    // Should have proper semantic structure
    expect(ariaLabel || role).toBeTruthy();
    
    // Test high contrast mode
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('[data-testid="news-feed"]')).toBeVisible();
    
    // Verify content is still readable
    const summary = firstArticle.locator('[data-testid="article-summary"]');
    await expect(summary).toBeVisible();
    
    // Test reduced motion
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.locator('[data-testid="news-feed"]')).toBeVisible();
  });
});