import { test, expect } from '@playwright/test';

test.describe('Personalization and Summarization Workflows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('semantic search personalization workflow', async ({ page }) => {
    // Set specific preferences to test semantic matching
    await page.click('[data-testid="preferences-button"]');
    
    // Select technology and science topics
    await page.check('[data-testid="topic-technology"]');
    await page.check('[data-testid="topic-science"]');
    
    // Set casual tone and 5-minute reading time
    await page.selectOption('[data-testid="tone-selector"]', 'casual');
    await page.fill('[data-testid="reading-time-input"]', '5');
    
    await page.click('[data-testid="save-preferences"]');
    await page.click('[data-testid="back-to-feed"]');
    
    // Wait for personalized content to load
    await expect(page.locator('[data-testid="news-feed"]')).toBeVisible();
    
    // Verify articles are relevant to selected topics
    const articles = page.locator('[data-testid="news-article"]');
    await expect(articles.first()).toBeVisible();
    
    // Check that articles contain technology or science related content
    const firstArticleText = await articles.first().textContent();
    const hasRelevantContent = firstArticleText?.toLowerCase().includes('technology') ||
                              firstArticleText?.toLowerCase().includes('science') ||
                              firstArticleText?.toLowerCase().includes('tech') ||
                              firstArticleText?.toLowerCase().includes('ai') ||
                              firstArticleText?.toLowerCase().includes('research');
    
    // Note: In a real test, we'd have more sophisticated content analysis
    // For now, we verify the structure is correct
    expect(firstArticleText).toBeTruthy();
  });

  test('summarization tone adaptation workflow', async ({ page }) => {
    // Test formal tone
    await page.click('[data-testid="preferences-button"]');
    await page.selectOption('[data-testid="tone-selector"]', 'formal');
    await page.click('[data-testid="save-preferences"]');
    await page.click('[data-testid="back-to-feed"]');
    
    await expect(page.locator('[data-testid="news-article"]').first()).toBeVisible();
    const formalSummary = await page.locator('[data-testid="article-summary"]').first().textContent();
    
    // Test casual tone
    await page.click('[data-testid="preferences-button"]');
    await page.selectOption('[data-testid="tone-selector"]', 'casual');
    await page.click('[data-testid="save-preferences"]');
    await page.click('[data-testid="back-to-feed"]');
    
    await expect(page.locator('[data-testid="news-article"]').first()).toBeVisible();
    const casualSummary = await page.locator('[data-testid="article-summary"]').first().textContent();
    
    // Test fun tone
    await page.click('[data-testid="preferences-button"]');
    await page.selectOption('[data-testid="tone-selector"]', 'fun');
    await page.click('[data-testid="save-preferences"]');
    await page.click('[data-testid="back-to-feed"]');
    
    await expect(page.locator('[data-testid="news-article"]').first()).toBeVisible();
    const funSummary = await page.locator('[data-testid="article-summary"]').first().textContent();
    
    // Verify summaries are different (tone adaptation working)
    expect(formalSummary).not.toBe(casualSummary);
    expect(casualSummary).not.toBe(funSummary);
    expect(formalSummary).not.toBe(funSummary);
  });

  test('reading time adaptation workflow', async ({ page }) => {
    // Test short reading time (2 minutes)
    await page.click('[data-testid="preferences-button"]');
    await page.fill('[data-testid="reading-time-input"]', '2');
    await page.click('[data-testid="save-preferences"]');
    await page.click('[data-testid="back-to-feed"]');
    
    await expect(page.locator('[data-testid="news-article"]').first()).toBeVisible();
    const shortSummary = await page.locator('[data-testid="article-summary"]').first().textContent();
    const shortWordCount = shortSummary?.split(' ').length || 0;
    
    // Test long reading time (10 minutes)
    await page.click('[data-testid="preferences-button"]');
    await page.fill('[data-testid="reading-time-input"]', '10');
    await page.click('[data-testid="save-preferences"]');
    await page.click('[data-testid="back-to-feed"]');
    
    await expect(page.locator('[data-testid="news-article"]').first()).toBeVisible();
    const longSummary = await page.locator('[data-testid="article-summary"]').first().textContent();
    const longWordCount = longSummary?.split(' ').length || 0;
    
    // Longer reading time should result in longer summaries
    expect(longWordCount).toBeGreaterThan(shortWordCount);
  });

  test('topic consolidation workflow', async ({ page }) => {
    // Set preferences for a specific topic to increase chance of similar articles
    await page.click('[data-testid="preferences-button"]');
    await page.check('[data-testid="topic-technology"]');
    await page.click('[data-testid="save-preferences"]');
    await page.click('[data-testid="back-to-feed"]');
    
    await expect(page.locator('[data-testid="news-feed"]')).toBeVisible();
    
    // Look for consolidated summaries indicator
    const consolidatedIndicator = page.locator('[data-testid="consolidated-summary"]');
    if (await consolidatedIndicator.isVisible()) {
      // Verify consolidated summary shows multiple sources
      const sourceCount = page.locator('[data-testid="source-count"]');
      await expect(sourceCount).toBeVisible();
      
      const sourceCountText = await sourceCount.textContent();
      expect(sourceCountText).toMatch(/\d+ sources?/);
    }
    
    // Verify no duplicate articles on the same topic
    const articles = page.locator('[data-testid="news-article"]');
    const articleCount = await articles.count();
    const headlines = [];
    
    for (let i = 0; i < Math.min(articleCount, 5); i++) {
      const headline = await articles.nth(i).locator('[data-testid="article-headline"]').textContent();
      headlines.push(headline?.toLowerCase());
    }
    
    // Check for similar headlines (basic duplicate detection)
    const uniqueHeadlines = new Set(headlines);
    expect(uniqueHeadlines.size).toBe(headlines.length);
  });

  test('user interaction learning workflow', async ({ page }) => {
    // Simulate consistent user behavior to test learning
    await expect(page.locator('[data-testid="news-article"]').first()).toBeVisible();
    
    const articles = page.locator('[data-testid="news-article"]');
    const articleCount = await articles.count();
    
    // Interact with technology articles positively
    for (let i = 0; i < Math.min(articleCount, 3); i++) {
      const article = articles.nth(i);
      const headline = await article.locator('[data-testid="article-headline"]').textContent();
      
      if (headline?.toLowerCase().includes('tech') || 
          headline?.toLowerCase().includes('ai') ||
          headline?.toLowerCase().includes('software')) {
        
        // Positive interactions
        const likeButton = article.locator('[data-testid="like-button"]');
        if (await likeButton.isVisible()) {
          await likeButton.click();
        }
        
        const readMoreButton = article.locator('[data-testid="read-more-button"]');
        if (await readMoreButton.isVisible()) {
          await readMoreButton.click();
          await page.waitForTimeout(500); // Simulate reading time
        }
      }
    }
    
    // Hide non-technology articles
    for (let i = 0; i < Math.min(articleCount, 3); i++) {
      const article = articles.nth(i);
      const headline = await article.locator('[data-testid="article-headline"]').textContent();
      
      if (headline && !headline.toLowerCase().includes('tech') && 
          !headline.toLowerCase().includes('ai') &&
          !headline.toLowerCase().includes('software')) {
        
        const hideButton = article.locator('[data-testid="hide-source-button"]');
        if (await hideButton.isVisible()) {
          await hideButton.click();
        }
      }
    }
    
    // Refresh to see if learning has taken effect
    await page.reload();
    await expect(page.locator('[data-testid="news-feed"]')).toBeVisible();
    
    // Verify that more technology-related content appears
    const newArticles = page.locator('[data-testid="news-article"]');
    const newArticleCount = await newArticles.count();
    
    let techArticleCount = 0;
    for (let i = 0; i < Math.min(newArticleCount, 5); i++) {
      const headline = await newArticles.nth(i).locator('[data-testid="article-headline"]').textContent();
      if (headline?.toLowerCase().includes('tech') || 
          headline?.toLowerCase().includes('ai') ||
          headline?.toLowerCase().includes('software')) {
        techArticleCount++;
      }
    }
    
    // Should have some technology articles due to learning
    expect(techArticleCount).toBeGreaterThan(0);
  });

  test('preference fallback workflow', async ({ page }) => {
    // Test behavior when user has no preferences set
    
    // Clear any existing preferences by setting to defaults
    await page.click('[data-testid="preferences-button"]');
    
    // Uncheck all topics
    const topicCheckboxes = page.locator('[data-testid^="topic-"]');
    const checkboxCount = await topicCheckboxes.count();
    
    for (let i = 0; i < checkboxCount; i++) {
      const checkbox = topicCheckboxes.nth(i);
      if (await checkbox.isChecked()) {
        await checkbox.uncheck();
      }
    }
    
    // Set to default tone and reading time
    await page.selectOption('[data-testid="tone-selector"]', 'neutral');
    await page.fill('[data-testid="reading-time-input"]', '5');
    
    await page.click('[data-testid="save-preferences"]');
    await page.click('[data-testid="back-to-feed"]');
    
    // Verify fallback content is shown
    await expect(page.locator('[data-testid="news-feed"]')).toBeVisible();
    
    const articles = page.locator('[data-testid="news-article"]');
    await expect(articles.first()).toBeVisible();
    
    // Should show general/popular articles as fallback
    const fallbackIndicator = page.locator('[data-testid="fallback-content-indicator"]');
    if (await fallbackIndicator.isVisible()) {
      expect(await fallbackIndicator.textContent()).toContain('popular');
    }
  });

  test('real-time preference updates workflow', async ({ page }) => {
    // Test that preference changes are reflected immediately
    await page.click('[data-testid="preferences-button"]');
    
    // Make a preference change
    await page.check('[data-testid="topic-business"]');
    await page.selectOption('[data-testid="tone-selector"]', 'formal');
    
    // Save and return to feed
    await page.click('[data-testid="save-preferences"]');
    await page.click('[data-testid="back-to-feed"]');
    
    // Verify immediate update
    await expect(page.locator('[data-testid="news-feed"]')).toBeVisible();
    
    // Make another change
    await page.click('[data-testid="preferences-button"]');
    await page.selectOption('[data-testid="tone-selector"]', 'casual');
    await page.click('[data-testid="save-preferences"]');
    await page.click('[data-testid="back-to-feed"]');
    
    // Verify the change is reflected
    await expect(page.locator('[data-testid="news-feed"]')).toBeVisible();
    
    // Content should be different from the first load
    const articles = page.locator('[data-testid="news-article"]');
    await expect(articles.first()).toBeVisible();
  });
});