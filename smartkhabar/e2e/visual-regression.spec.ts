import { test, expect } from '@playwright/test';

test.describe('Visual Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mock consistent data for visual tests
    await page.route('**/api/news/personalized', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          articles: [
            {
              id: 'visual-test-1',
              headline: 'Technology Breakthrough in AI Research',
              summary: 'Scientists have made significant progress in artificial intelligence research, developing new algorithms that could revolutionize machine learning.',
              source: 'Tech News',
              timestamp: '2024-01-15T10:00:00Z',
              keyPoints: [
                'New AI algorithms developed',
                'Potential for machine learning revolution',
                'Research published in top journal'
              ],
              url: 'https://example.com/ai-breakthrough'
            },
            {
              id: 'visual-test-2',
              headline: 'Climate Change Summit Reaches Agreement',
              summary: 'World leaders have reached a consensus on new climate policies aimed at reducing global carbon emissions by 50% over the next decade.',
              source: 'Global News',
              timestamp: '2024-01-15T08:30:00Z',
              keyPoints: [
                '50% carbon emission reduction target',
                'Global consensus achieved',
                'Implementation timeline set'
              ],
              url: 'https://example.com/climate-summit'
            },
            {
              id: 'visual-test-3',
              headline: 'Space Exploration Mission Launches Successfully',
              summary: 'The latest space mission has launched successfully, carrying advanced scientific instruments to study distant planets.',
              source: 'Space Today',
              timestamp: '2024-01-15T06:15:00Z',
              keyPoints: [
                'Successful mission launch',
                'Advanced scientific instruments',
                'Distant planet research'
              ],
              url: 'https://example.com/space-mission'
            }
          ]
        })
      });
    });

    await page.goto('/');
    await expect(page.locator('[data-testid="news-feed"]')).toBeVisible();
  });

  test('homepage layout is consistent', async ({ page }) => {
    // Take screenshot of full page
    await expect(page).toHaveScreenshot('homepage-full.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });

  test('news feed component visual consistency', async ({ page }) => {
    const newsFeed = page.locator('[data-testid="news-feed"]');
    await expect(newsFeed).toHaveScreenshot('news-feed-component.png', {
      animations: 'disabled'
    });
  });

  test('individual article card layout', async ({ page }) => {
    const firstArticle = page.locator('[data-testid="news-article"]').first();
    await expect(firstArticle).toHaveScreenshot('article-card.png', {
      animations: 'disabled'
    });
  });

  test('preferences page layout', async ({ page }) => {
    const prefsButton = page.locator('[data-testid="preferences-button"]');
    if (await prefsButton.isVisible()) {
      await prefsButton.click();
      
      await expect(page.locator('[data-testid="preferences-form"]')).toBeVisible();
      
      await expect(page).toHaveScreenshot('preferences-page.png', {
        animations: 'disabled'
      });
    }
  });

  test('mobile layout consistency', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await expect(page.locator('[data-testid="news-feed"]')).toBeVisible();
    
    await expect(page).toHaveScreenshot('mobile-homepage.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });

  test('tablet layout consistency', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    
    await expect(page.locator('[data-testid="news-feed"]')).toBeVisible();
    
    await expect(page).toHaveScreenshot('tablet-homepage.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });

  test('dark mode visual consistency', async ({ page }) => {
    // Enable dark mode
    await page.emulateMedia({ colorScheme: 'dark' });
    
    await expect(page.locator('[data-testid="news-feed"]')).toBeVisible();
    
    await expect(page).toHaveScreenshot('dark-mode-homepage.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });

  test('loading state visual consistency', async ({ page }) => {
    // Intercept API to add delay
    await page.route('**/api/news/personalized', async route => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      route.continue();
    });
    
    // Navigate and capture loading state
    await page.goto('/');
    
    const loadingIndicator = page.locator('[data-testid="loading-indicator"]');
    if (await loadingIndicator.isVisible()) {
      await expect(loadingIndicator).toHaveScreenshot('loading-state.png', {
        animations: 'disabled'
      });
    }
  });

  test('error state visual consistency', async ({ page }) => {
    // Mock error response
    await page.route('**/api/news/personalized', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Server error' })
      });
    });
    
    await page.goto('/');
    
    // Wait for error state
    const errorMessage = page.locator('[data-testid="error-message"]');
    const fallbackContent = page.locator('[data-testid="fallback-content"]');
    
    if (await errorMessage.isVisible()) {
      await expect(errorMessage).toHaveScreenshot('error-state.png', {
        animations: 'disabled'
      });
    } else if (await fallbackContent.isVisible()) {
      await expect(fallbackContent).toHaveScreenshot('fallback-state.png', {
        animations: 'disabled'
      });
    }
  });

  test('article interaction states', async ({ page }) => {
    const firstArticle = page.locator('[data-testid="news-article"]').first();
    
    // Default state
    await expect(firstArticle).toHaveScreenshot('article-default-state.png', {
      animations: 'disabled'
    });
    
    // Hover state (if applicable)
    await firstArticle.hover();
    await expect(firstArticle).toHaveScreenshot('article-hover-state.png', {
      animations: 'disabled'
    });
    
    // Liked state
    const likeButton = firstArticle.locator('[data-testid="like-button"]');
    if (await likeButton.isVisible()) {
      await likeButton.click();
      await expect(firstArticle).toHaveScreenshot('article-liked-state.png', {
        animations: 'disabled'
      });
    }
  });

  test('preferences form states', async ({ page }) => {
    const prefsButton = page.locator('[data-testid="preferences-button"]');
    if (await prefsButton.isVisible()) {
      await prefsButton.click();
      
      // Default form state
      const prefsForm = page.locator('[data-testid="preferences-form"]');
      await expect(prefsForm).toHaveScreenshot('preferences-form-default.png', {
        animations: 'disabled'
      });
      
      // Form with selections
      await page.check('[data-testid="topic-technology"]');
      await page.selectOption('[data-testid="tone-selector"]', 'casual');
      await page.fill('[data-testid="reading-time-input"]', '7');
      
      await expect(prefsForm).toHaveScreenshot('preferences-form-filled.png', {
        animations: 'disabled'
      });
      
      // Success state
      await page.click('[data-testid="save-preferences"]');
      
      const successMessage = page.locator('[data-testid="preferences-saved"]');
      if (await successMessage.isVisible()) {
        await expect(prefsForm).toHaveScreenshot('preferences-form-success.png', {
          animations: 'disabled'
        });
      }
    }
  });

  test('responsive breakpoint consistency', async ({ page }) => {
    const breakpoints = [
      { width: 320, height: 568, name: 'small-mobile' },
      { width: 375, height: 667, name: 'mobile' },
      { width: 414, height: 896, name: 'large-mobile' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 1024, height: 768, name: 'small-desktop' },
      { width: 1440, height: 900, name: 'desktop' },
      { width: 1920, height: 1080, name: 'large-desktop' }
    ];

    for (const breakpoint of breakpoints) {
      await page.setViewportSize({ 
        width: breakpoint.width, 
        height: breakpoint.height 
      });
      
      await expect(page.locator('[data-testid="news-feed"]')).toBeVisible();
      
      await expect(page).toHaveScreenshot(`breakpoint-${breakpoint.name}.png`, {
        animations: 'disabled'
      });
    }
  });

  test('typography and spacing consistency', async ({ page }) => {
    // Focus on text elements
    const headlines = page.locator('[data-testid="article-headline"]');
    const summaries = page.locator('[data-testid="article-summary"]');
    const sources = page.locator('[data-testid="article-source"]');
    
    if (await headlines.count() > 0) {
      await expect(headlines.first()).toHaveScreenshot('headline-typography.png', {
        animations: 'disabled'
      });
    }
    
    if (await summaries.count() > 0) {
      await expect(summaries.first()).toHaveScreenshot('summary-typography.png', {
        animations: 'disabled'
      });
    }
    
    if (await sources.count() > 0) {
      await expect(sources.first()).toHaveScreenshot('source-typography.png', {
        animations: 'disabled'
      });
    }
  });

  test('button and interactive element consistency', async ({ page }) => {
    // Test various button states
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    
    if (buttonCount > 0) {
      const firstButton = buttons.first();
      
      // Default state
      await expect(firstButton).toHaveScreenshot('button-default.png', {
        animations: 'disabled'
      });
      
      // Hover state
      await firstButton.hover();
      await expect(firstButton).toHaveScreenshot('button-hover.png', {
        animations: 'disabled'
      });
      
      // Focus state
      await firstButton.focus();
      await expect(firstButton).toHaveScreenshot('button-focus.png', {
        animations: 'disabled'
      });
    }
  });

  test('color scheme consistency', async ({ page }) => {
    // Test light mode
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('[data-testid="news-feed"]')).toBeVisible();
    
    const lightModeColors = await page.evaluate(() => {
      const feed = document.querySelector('[data-testid="news-feed"]');
      if (feed) {
        const styles = window.getComputedStyle(feed);
        return {
          backgroundColor: styles.backgroundColor,
          color: styles.color
        };
      }
      return null;
    });
    
    await expect(page).toHaveScreenshot('light-mode-colors.png', {
      animations: 'disabled'
    });
    
    // Test dark mode
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('[data-testid="news-feed"]')).toBeVisible();
    
    const darkModeColors = await page.evaluate(() => {
      const feed = document.querySelector('[data-testid="news-feed"]');
      if (feed) {
        const styles = window.getComputedStyle(feed);
        return {
          backgroundColor: styles.backgroundColor,
          color: styles.color
        };
      }
      return null;
    });
    
    await expect(page).toHaveScreenshot('dark-mode-colors.png', {
      animations: 'disabled'
    });
    
    // Colors should be different between modes
    if (lightModeColors && darkModeColors) {
      expect(lightModeColors.backgroundColor).not.toBe(darkModeColors.backgroundColor);
    }
  });
});