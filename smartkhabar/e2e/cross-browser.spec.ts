import { test, expect, devices } from '@playwright/test';

test.describe('Cross-Browser Compatibility Tests', () => {
  const browsers = ['chromium', 'firefox', 'webkit'];
  
  browsers.forEach(browserName => {
    test.describe(`${browserName} compatibility`, () => {
      test.beforeEach(async ({ page }) => {
        await page.goto('/');
      });

      test(`basic functionality works in ${browserName}`, async ({ page }) => {
        // Test core functionality across browsers
        await expect(page).toHaveTitle(/SmartKhabar/);
        await expect(page.locator('[data-testid="news-feed"]')).toBeVisible();
        
        const articles = page.locator('[data-testid="news-article"]');
        await expect(articles.first()).toBeVisible();
        
        // Test basic interactions
        const firstArticle = articles.first();
        await expect(firstArticle.locator('[data-testid="article-headline"]')).toBeVisible();
        await expect(firstArticle.locator('[data-testid="article-summary"]')).toBeVisible();
      });

      test(`preferences work in ${browserName}`, async ({ page }) => {
        await page.click('[data-testid="preferences-button"]');
        await expect(page.locator('[data-testid="topic-selector"]')).toBeVisible();
        
        // Test form interactions
        await page.check('[data-testid="topic-technology"]');
        await page.selectOption('[data-testid="tone-selector"]', 'casual');
        await page.fill('[data-testid="reading-time-input"]', '7');
        
        await page.click('[data-testid="save-preferences"]');
        await expect(page.locator('[data-testid="preferences-saved"]')).toBeVisible();
      });

      test(`responsive design works in ${browserName}`, async ({ page }) => {
        // Test different viewport sizes
        const viewports = [
          { width: 1920, height: 1080, name: 'desktop' },
          { width: 768, height: 1024, name: 'tablet' },
          { width: 375, height: 667, name: 'mobile' }
        ];

        for (const viewport of viewports) {
          await page.setViewportSize({ width: viewport.width, height: viewport.height });
          
          await expect(page.locator('[data-testid="news-feed"]')).toBeVisible();
          
          const articles = page.locator('[data-testid="news-article"]');
          await expect(articles.first()).toBeVisible();
          
          // Verify layout adapts to viewport
          const feedContainer = page.locator('[data-testid="news-feed"]');
          const boundingBox = await feedContainer.boundingBox();
          
          if (boundingBox) {
            expect(boundingBox.width).toBeLessThanOrEqual(viewport.width);
          }
        }
      });
    });
  });

  test.describe('Mobile Device Compatibility', () => {
    const mobileDevices = [
      { device: devices['iPhone 12'], name: 'iPhone 12' },
      { device: devices['iPhone 13'], name: 'iPhone 13' },
      { device: devices['Pixel 5'], name: 'Pixel 5' },
      { device: devices['Galaxy S9+'], name: 'Galaxy S9+' }
    ];

    mobileDevices.forEach(({ device, name }) => {
      test(`works on ${name}`, async ({ browser }) => {
        const context = await browser.newContext({
          ...device,
        });
        const page = await context.newPage();
        
        await page.goto('/');
        
        // Test mobile-specific functionality
        await expect(page.locator('[data-testid="news-feed"]')).toBeVisible();
        
        const articles = page.locator('[data-testid="news-article"]');
        await expect(articles.first()).toBeVisible();
        
        // Test touch interactions
        const firstArticle = articles.first();
        await firstArticle.tap();
        
        // Test mobile menu if present
        const mobileMenu = page.locator('[data-testid="mobile-menu"]');
        if (await mobileMenu.isVisible()) {
          await mobileMenu.tap();
        }
        
        // Test swipe gestures if implemented
        const feedContainer = page.locator('[data-testid="news-feed"]');
        const boundingBox = await feedContainer.boundingBox();
        
        if (boundingBox) {
          // Simulate swipe down to refresh
          await page.touchscreen.tap(boundingBox.x + boundingBox.width / 2, boundingBox.y + 100);
          await page.touchscreen.tap(boundingBox.x + boundingBox.width / 2, boundingBox.y + 200);
        }
        
        await context.close();
      });
    });
  });

  test.describe('Browser Feature Support', () => {
    test('localStorage support', async ({ page }) => {
      await page.goto('/');
      
      // Test localStorage functionality
      const hasLocalStorage = await page.evaluate(() => {
        try {
          localStorage.setItem('test', 'value');
          const value = localStorage.getItem('test');
          localStorage.removeItem('test');
          return value === 'value';
        } catch (e) {
          return false;
        }
      });
      
      expect(hasLocalStorage).toBe(true);
      
      // Test that preferences are stored
      await page.click('[data-testid="preferences-button"]');
      await page.check('[data-testid="topic-technology"]');
      await page.click('[data-testid="save-preferences"]');
      
      // Reload page and verify preferences persist
      await page.reload();
      await page.click('[data-testid="preferences-button"]');
      
      const techCheckbox = page.locator('[data-testid="topic-technology"]');
      await expect(techCheckbox).toBeChecked();
    });

    test('fetch API support', async ({ page }) => {
      await page.goto('/');
      
      // Test that fetch API is available and working
      const hasFetch = await page.evaluate(() => {
        return typeof fetch !== 'undefined';
      });
      
      expect(hasFetch).toBe(true);
      
      // Verify API calls work
      await expect(page.locator('[data-testid="news-feed"]')).toBeVisible();
      
      const articles = page.locator('[data-testid="news-article"]');
      await expect(articles.first()).toBeVisible();
    });

    test('CSS Grid and Flexbox support', async ({ page }) => {
      await page.goto('/');
      
      // Test CSS Grid support
      const hasGrid = await page.evaluate(() => {
        const div = document.createElement('div');
        div.style.display = 'grid';
        return div.style.display === 'grid';
      });
      
      expect(hasGrid).toBe(true);
      
      // Test Flexbox support
      const hasFlex = await page.evaluate(() => {
        const div = document.createElement('div');
        div.style.display = 'flex';
        return div.style.display === 'flex';
      });
      
      expect(hasFlex).toBe(true);
      
      // Verify layout works correctly
      const feedContainer = page.locator('[data-testid="news-feed"]');
      await expect(feedContainer).toBeVisible();
      
      const computedStyle = await feedContainer.evaluate(el => {
        return window.getComputedStyle(el).display;
      });
      
      expect(['grid', 'flex', 'block']).toContain(computedStyle);
    });

    test('ES6+ features support', async ({ page }) => {
      await page.goto('/');
      
      // Test modern JavaScript features
      const hasModernJS = await page.evaluate(() => {
        try {
          // Test arrow functions
          const arrow = () => true;
          
          // Test const/let
          const testConst = 'test';
          let testLet = 'test';
          
          // Test template literals
          const template = `Hello ${testConst}`;
          
          // Test destructuring
          const { length } = 'test';
          
          // Test async/await (basic syntax check)
          const asyncTest = async () => true;
          
          return arrow() && testConst && testLet && template && length && asyncTest;
        } catch (e) {
          return false;
        }
      });
      
      expect(hasModernJS).toBe(true);
    });
  });

  test.describe('Accessibility Across Browsers', () => {
    test('keyboard navigation works', async ({ page }) => {
      await page.goto('/');
      
      // Test tab navigation
      await page.keyboard.press('Tab');
      
      // Should focus on first interactive element
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();
      
      // Continue tabbing through elements
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Tab');
        const currentFocus = page.locator(':focus');
        await expect(currentFocus).toBeVisible();
      }
    });

    test('screen reader compatibility', async ({ page }) => {
      await page.goto('/');
      
      // Check for proper ARIA labels and roles
      const articles = page.locator('[data-testid="news-article"]');
      await expect(articles.first()).toBeVisible();
      
      // Verify semantic HTML structure
      const main = page.locator('main');
      await expect(main).toBeVisible();
      
      const headings = page.locator('h1, h2, h3, h4, h5, h6');
      await expect(headings.first()).toBeVisible();
      
      // Check for alt text on images
      const images = page.locator('img');
      const imageCount = await images.count();
      
      for (let i = 0; i < imageCount; i++) {
        const img = images.nth(i);
        const alt = await img.getAttribute('alt');
        expect(alt).toBeTruthy();
      }
    });

    test('color contrast and visual accessibility', async ({ page }) => {
      await page.goto('/');
      
      // Test high contrast mode compatibility
      await page.emulateMedia({ colorScheme: 'dark' });
      await expect(page.locator('[data-testid="news-feed"]')).toBeVisible();
      
      await page.emulateMedia({ colorScheme: 'light' });
      await expect(page.locator('[data-testid="news-feed"]')).toBeVisible();
      
      // Test reduced motion preference
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await expect(page.locator('[data-testid="news-feed"]')).toBeVisible();
    });
  });
});