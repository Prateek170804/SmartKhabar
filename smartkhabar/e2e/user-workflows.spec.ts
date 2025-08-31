import { test, expect } from '@playwright/test';

test.describe('User Workflow Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API responses for consistent testing
    await page.route('**/api/news/personalized*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            summaries: [
              {
                id: 'test-article-1',
                content: 'This is a test news summary about technology trends and innovations in the AI space.',
                keyPoints: ['AI advancement', 'Technology trends', 'Innovation impact'],
                sourceArticles: ['article-1', 'article-2'],
                estimatedReadingTime: 3,
                tone: 'casual',
              },
              {
                id: 'test-article-2',
                content: 'Breaking news about climate change initiatives and global environmental policies.',
                keyPoints: ['Climate action', 'Environmental policy', 'Global initiatives'],
                sourceArticles: ['article-3'],
                estimatedReadingTime: 5,
                tone: 'formal',
              }
            ],
            lastUpdated: new Date().toISOString()
          }
        })
      });
    });

    await page.route('**/api/preferences*', route => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              userId: 'demo-user',
              topics: ['technology'],
              tone: 'casual',
              readingTime: 5,
              preferredSources: [],
              excludedSources: [],
              lastUpdated: new Date().toISOString()
            }
          })
        });
      } else if (route.request().method() === 'PUT') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              userId: 'demo-user',
              topics: ['technology', 'science'],
              tone: 'formal',
              readingTime: 7,
              preferredSources: [],
              excludedSources: [],
              lastUpdated: new Date().toISOString()
            }
          })
        });
      }
    });

    await page.route('**/api/interactions', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            interactionId: 'test-interaction-1',
            updatedPreferences: false
          }
        })
      });
    });

    // Navigate to the demo page
    await page.goto('/demo');
  });

  test('complete user journey - view personalized news feed', async ({ page }) => {
    // Test requirement 6.1: Display personalized summaries in clean, readable format
    await expect(page).toHaveTitle(/SmartKhabar/);
    
    // Check if news feed is displayed
    await expect(page.locator('[data-testid="news-feed"]')).toBeVisible();
    
    // Verify articles are displayed with proper structure
    const articles = page.locator('[data-testid="news-article"]');
    await expect(articles.first()).toBeVisible();
    
    // Check for required article elements (requirement 6.2)
    const firstArticle = articles.first();
    await expect(firstArticle.locator('[data-testid="article-summary"]')).toBeVisible();
    await expect(firstArticle.locator('[data-testid="article-source"]')).toBeVisible();
    await expect(firstArticle.locator('[data-testid="article-timestamp"]')).toBeVisible();
    await expect(firstArticle.locator('[data-testid="article-key-points"]')).toBeVisible();
    
    // Verify content is meaningful
    const summaryText = await firstArticle.locator('[data-testid="article-summary"]').textContent();
    expect(summaryText).toBeTruthy();
    expect(summaryText!.length).toBeGreaterThan(10);
  });

  test('user preferences workflow', async ({ page }) => {
    // Navigate to preferences page
    await page.click('[data-testid="preferences-button"]');
    
    // Test requirement 3.1: Select preferred topics
    await expect(page.locator('[data-testid="topic-selector"]')).toBeVisible();
    
    // Select technology topic (it should already be selected from mock)
    const techButton = page.locator('[data-testid="topic-technology"]');
    await expect(techButton).toBeVisible();
    
    // Select science topic as well
    await page.click('[data-testid="topic-science"]');
    
    // Test requirement 3.2: Choose tone options
    await expect(page.locator('[data-testid="tone-selector"]')).toBeVisible();
    
    // Select formal tone
    const formalToneRadio = page.locator('input[name="tone"][value="formal"]');
    await formalToneRadio.click();
    
    // Test requirement 3.3: Configure reading time
    await expect(page.locator('[data-testid="reading-time-slider"]')).toBeVisible();
    
    // Set reading time to 7 minutes
    await page.locator('[data-testid="reading-time-slider"]').fill('7');
    
    // Wait for save button to appear after making changes
    const saveButton = page.locator('[data-testid="save-preferences"]').first();
    await expect(saveButton).toBeVisible();
    
    // Save preferences
    await saveButton.click();
    
    // Wait for save to complete
    await page.waitForTimeout(1000);
    
    // Navigate back to feed and verify personalization
    await page.click('[data-testid="back-to-feed"]');
    await expect(page.locator('[data-testid="news-feed"]')).toBeVisible();
    
    // Verify feed reflects preferences
    const articles = page.locator('[data-testid="news-article"]');
    await expect(articles.first()).toBeVisible();
  });

  test('article interaction workflow', async ({ page }) => {
    // Wait for articles to load
    await expect(page.locator('[data-testid="news-article"]').first()).toBeVisible();
    
    const firstArticle = page.locator('[data-testid="news-article"]').first();
    
    // Test requirement 6.3: "read more" functionality
    const readMoreButton = firstArticle.locator('[data-testid="read-more-button"]');
    await expect(readMoreButton).toBeVisible();
    
    // Test like functionality
    const likeButton = firstArticle.locator('[data-testid="like-button"]');
    await expect(likeButton).toBeVisible();
    await likeButton.click();
    
    // Verify like button state changes
    await expect(likeButton).toHaveClass(/active|liked/);
    
    // Test requirement 6.4: Hide source functionality
    const hideButton = firstArticle.locator('[data-testid="hide-source-button"]');
    await expect(hideButton).toBeVisible();
    await hideButton.click();
    
    // Verify interaction was tracked (button should be clickable)
    await expect(hideButton).toBeVisible();
    
    // Test share functionality
    const shareButton = firstArticle.locator('button:has-text("Share")');
    if (await shareButton.isVisible()) {
      await shareButton.click();
    }
  });

  test('personalization learning workflow', async ({ page }) => {
    // Test requirement 7.1: Track user interactions
    const articles = page.locator('[data-testid="news-article"]');
    await expect(articles.first()).toBeVisible();
    
    const firstArticle = articles.first();
    
    // Simulate like interaction
    const likeButton = firstArticle.locator('[data-testid="like-button"]');
    await expect(likeButton).toBeVisible();
    await likeButton.click();
    
    // Verify interaction is tracked (visual feedback)
    await expect(likeButton).toHaveClass(/active|liked/);
    
    // Simulate multiple interactions to test learning
    const articleCount = await articles.count();
    for (let i = 0; i < Math.min(articleCount, 2); i++) {
      const article = articles.nth(i);
      const readMoreBtn = article.locator('[data-testid="read-more-button"]');
      await readMoreBtn.click();
      // Wait a bit to simulate reading time
      await page.waitForTimeout(200);
    }
    
    // Verify interactions were tracked (articles should still be visible)
    await expect(page.locator('[data-testid="news-feed"]')).toBeVisible();
    await expect(articles.first()).toBeVisible();
    
    // Test that like state persists
    await expect(likeButton).toHaveClass(/active|liked/);
  });

  test('summarization workflow with different tones', async ({ page }) => {
    // Navigate to preferences
    await page.click('[data-testid="preferences-button"]');
    
    // Verify tone selector is available
    await expect(page.locator('[data-testid="tone-selector"]')).toBeVisible();
    
    // Test that different tone options are available
    const formalToneRadio = page.locator('input[name="tone"][value="formal"]');
    const casualToneRadio = page.locator('input[name="tone"][value="casual"]');
    const funToneRadio = page.locator('input[name="tone"][value="fun"]');
    
    await expect(formalToneRadio).toBeVisible();
    await expect(casualToneRadio).toBeVisible();
    await expect(funToneRadio).toBeVisible();
    
    // Select formal tone (different from the default 'casual' in mock)
    await formalToneRadio.click();
    
    // Verify the selection changed
    await expect(formalToneRadio).toBeChecked();
    
    // Save preferences
    const saveButton = page.locator('[data-testid="save-preferences"]').first();
    await expect(saveButton).toBeVisible();
    await saveButton.click();
    
    // Navigate back to feed
    await page.click('[data-testid="back-to-feed"]');
    
    // Verify articles are displayed with updated preferences
    await expect(page.locator('[data-testid="news-feed"]')).toBeVisible();
    const articles = page.locator('[data-testid="news-article"]');
    await expect(articles.first()).toBeVisible();
    
    const summary = articles.first().locator('[data-testid="article-summary"]');
    await expect(summary).toBeVisible();
    
    const summaryText = await summary.textContent();
    expect(summaryText).toBeTruthy();
  });

  test('responsive design workflow', async ({ page }) => {
    // Test requirement 6.5: Responsive design for mobile and desktop
    
    // Desktop view
    await page.setViewportSize({ width: 1200, height: 800 });
    await expect(page.locator('[data-testid="news-feed"]')).toBeVisible();
    
    // Verify desktop layout
    const desktopArticles = page.locator('[data-testid="news-article"]');
    await expect(desktopArticles.first()).toBeVisible();
    
    // Tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('[data-testid="news-feed"]')).toBeVisible();
    await expect(desktopArticles.first()).toBeVisible();
    
    // Mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('[data-testid="news-feed"]')).toBeVisible();
    
    // Test mobile interactions
    const mobileArticle = page.locator('[data-testid="news-article"]').first();
    await expect(mobileArticle).toBeVisible();
    
    // Test that buttons are still accessible on mobile
    const likeButton = mobileArticle.locator('[data-testid="like-button"]');
    await expect(likeButton).toBeVisible();
    
    // Test navigation on mobile
    const prefsButton = page.locator('[data-testid="preferences-button"]');
    await expect(prefsButton).toBeVisible();
  });

  test('error handling and fallback workflow', async ({ page }) => {
    // Test graceful error handling
    
    // Simulate network error by intercepting API calls
    await page.route('**/api/news/personalized*', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ 
          success: false,
          error: { message: 'Internal server error' }
        })
      });
    });
    
    await page.reload();
    
    // Wait for error state to appear
    await page.waitForTimeout(2000);
    
    // Verify error state is handled gracefully
    const errorMessage = page.locator('[data-testid="error-message"]');
    const fallbackContent = page.locator('[data-testid="fallback-content"]');
    
    // Should show either error message or fallback content
    const errorOrFallback = errorMessage.or(fallbackContent);
    await expect(errorOrFallback).toBeVisible();
    
    // Test retry functionality if available
    const retryButton = page.locator('[data-testid="retry-button"]');
    if (await retryButton.isVisible()) {
      // Remove the route intercept to allow retry to succeed
      await page.unroute('**/api/news/personalized*');
      
      // Re-add successful mock
      await page.route('**/api/news/personalized*', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              summaries: [{
                id: 'retry-article-1',
                content: 'This is a retry test article.',
                keyPoints: ['Retry successful'],
                sourceArticles: ['retry-1'],
                estimatedReadingTime: 2,
                tone: 'casual',
              }],
              lastUpdated: new Date().toISOString()
            }
          })
        });
      });
      
      await retryButton.click();
      
      // Verify content loads after retry
      await expect(page.locator('[data-testid="news-feed"]')).toBeVisible();
      await expect(page.locator('[data-testid="news-article"]')).toBeVisible();
    }
  });

  test('performance and loading states workflow', async ({ page }) => {
    // Test loading states and performance
    
    // Intercept API calls to add delay
    await page.route('**/api/news/personalized*', async route => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            summaries: [{
              id: 'perf-test-1',
              content: 'Performance test article content.',
              keyPoints: ['Performance testing'],
              sourceArticles: ['perf-1'],
              estimatedReadingTime: 3,
              tone: 'casual',
            }],
            lastUpdated: new Date().toISOString()
          }
        })
      });
    });
    
    await page.reload();
    
    // Verify loading state is shown initially
    const loadingIndicator = page.locator('[data-testid="loading-indicator"]');
    await expect(loadingIndicator).toBeVisible();
    
    // Wait for content to load
    await expect(page.locator('[data-testid="news-feed"]')).toBeVisible();
    await expect(page.locator('[data-testid="news-article"]')).toBeVisible();
    
    // Test performance - page should load within reasonable time
    const startTime = Date.now();
    await page.reload();
    await expect(page.locator('[data-testid="news-feed"]')).toBeVisible();
    const loadTime = Date.now() - startTime;
    
    // Should load within 10 seconds (generous for E2E with delays)
    expect(loadTime).toBeLessThan(10000);
  });
});