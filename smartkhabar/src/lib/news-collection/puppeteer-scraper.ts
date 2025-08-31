/**
 * Free Puppeteer-based web scraper
 * Replaces Firecrawl API with completely free solution
 */

import puppeteer, { Browser, Page } from 'puppeteer';

export interface ScrapingConfig {
  timeout: number;
  waitForSelector?: string;
  userAgent: string;
  viewport: {
    width: number;
    height: number;
  };
  enableJavaScript: boolean;
  enableImages: boolean;
}

export interface ScrapedContent {
  url: string;
  title: string;
  content: string;
  description?: string;
  publishedAt?: string;
  author?: string;
  imageUrl?: string;
  success: boolean;
  error?: string;
}

export class PuppeteerScraper {
  private browser: Browser | null = null;
  private config: ScrapingConfig;

  constructor(config?: Partial<ScrapingConfig>) {
    this.config = {
      timeout: 30000,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      enableJavaScript: true,
      enableImages: false, // Disable images for faster scraping
      ...config
    };
  }

  /**
   * Initialize browser instance
   */
  async initialize(): Promise<void> {
    if (this.browser) return;

    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });
  }

  /**
   * Scrape content from a single URL
   */
  async scrapeUrl(url: string): Promise<ScrapedContent> {
    try {
      await this.initialize();

      if (!this.browser) {
        throw new Error('Failed to initialize browser');
      }

      const page = await this.browser.newPage();

      // Configure page
      await this.configurePage(page);

      // Navigate to URL
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: this.config.timeout
      });

      // Wait for content to load
      if (this.config.waitForSelector) {
        await page.waitForSelector(this.config.waitForSelector, {
          timeout: 10000
        });
      }

      // Extract content
      const content = await this.extractContent(page, url);

      await page.close();
      return content;

    } catch (error) {
      return {
        url,
        title: '',
        content: '',
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Scrape multiple URLs concurrently
   */
  async scrapeUrls(urls: string[], concurrency: number = 3): Promise<ScrapedContent[]> {
    const results: ScrapedContent[] = [];

    // Process URLs in batches to avoid overwhelming the browser
    for (let i = 0; i < urls.length; i += concurrency) {
      const batch = urls.slice(i, i + concurrency);
      const batchPromises = batch.map(url => this.scrapeUrl(url));
      const batchResults = await Promise.allSettled(batchPromises);

      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            url: batch[index],
            title: '',
            content: '',
            success: false,
            error: result.reason?.message || 'Unknown error'
          });
        }
      });
    }

    return results;
  }

  /**
   * Configure page settings
   */
  private async configurePage(page: Page): Promise<void> {
    // Set viewport
    await page.setViewport(this.config.viewport);

    // Set user agent
    await page.setUserAgent(this.config.userAgent);

    // Disable images if configured
    if (!this.config.enableImages) {
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        if (req.resourceType() === 'image') {
          req.abort();
        } else {
          req.continue();
        }
      });
    }

    // Disable JavaScript if configured
    if (!this.config.enableJavaScript) {
      await page.setJavaScriptEnabled(false);
    }
  }

  /**
   * Extract content from page
   */
  private async extractContent(page: Page, url: string): Promise<ScrapedContent> {
    const content = await page.evaluate(() => {
      // Helper function to clean text
      const cleanText = (text: string): string => {
        return text
          .replace(/\s+/g, ' ')
          .replace(/\n+/g, '\n')
          .trim();
      };

      // Extract title
      let title = '';
      const titleElement = document.querySelector('title');
      const h1Element = document.querySelector('h1');
      const ogTitleElement = document.querySelector('[property="og:title"]');

      if (titleElement) {
        title = titleElement.textContent || '';
      } else if (h1Element) {
        title = h1Element.textContent || '';
      } else if (ogTitleElement && ogTitleElement.tagName === 'META') {
        title = (ogTitleElement as HTMLMetaElement).content || '';
      }

      // Extract description
      const descElement = document.querySelector('meta[name="description"]') ||
        document.querySelector('meta[property="og:description"]');
      const description = (descElement as HTMLMetaElement)?.content || '';

      // Extract main content
      const contentSelectors = [
        'article',
        '[role="main"]',
        '.content',
        '.article-content',
        '.post-content',
        '.entry-content',
        'main',
        '#content'
      ];

      let mainContent = '';
      for (const selector of contentSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          // Remove script and style elements
          const scripts = element.querySelectorAll('script, style, nav, header, footer, aside');
          scripts.forEach(el => el.remove());

          mainContent = element.textContent || '';
          if (mainContent.length > 100) break;
        }
      }

      // Fallback to body content if no main content found
      if (!mainContent || mainContent.length < 100) {
        const body = document.body.cloneNode(true) as HTMLElement;
        const unwanted = body.querySelectorAll('script, style, nav, header, footer, aside, .sidebar, .menu');
        unwanted.forEach(el => el.remove());
        mainContent = body.textContent || '';
      }

      // Extract published date
      const dateSelectors = [
        'meta[property="article:published_time"]',
        'meta[name="publish-date"]',
        'time[datetime]',
        '.published',
        '.date'
      ];

      let publishedAt = '';
      for (const selector of dateSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          publishedAt = (element as HTMLMetaElement).content ||
            (element as HTMLTimeElement).dateTime ||
            element.textContent || '';
          if (publishedAt) break;
        }
      }

      // Extract author
      const authorSelectors = [
        'meta[name="author"]',
        'meta[property="article:author"]',
        '.author',
        '.byline',
        '[rel="author"]'
      ];

      let author = '';
      for (const selector of authorSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          author = (element as HTMLMetaElement).content || element.textContent || '';
          if (author) break;
        }
      }

      // Extract image
      const imageSelectors = [
        'meta[property="og:image"]',
        'meta[name="twitter:image"]',
        '.featured-image img',
        'article img',
        '.content img'
      ];

      let imageUrl = '';
      for (const selector of imageSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          imageUrl = (element as HTMLMetaElement).content ||
            (element as HTMLImageElement).src || '';
          if (imageUrl) break;
        }
      }

      return {
        title: cleanText(title),
        content: cleanText(mainContent),
        description: cleanText(description),
        publishedAt: publishedAt.trim(),
        author: cleanText(author),
        imageUrl: imageUrl.trim()
      };
    });

    return {
      url,
      title: content.title,
      content: content.content,
      description: content.description,
      publishedAt: content.publishedAt,
      author: content.author,
      imageUrl: content.imageUrl,
      success: true
    };
  }

  /**
   * Close browser instance
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Get browser status
   */
  isInitialized(): boolean {
    return this.browser !== null;
  }
}

// Default scraper instance
let defaultScraper: PuppeteerScraper | null = null;

/**
 * Get or create default scraper instance
 */
export function getScraper(config?: Partial<ScrapingConfig>): PuppeteerScraper {
  if (!defaultScraper) {
    defaultScraper = new PuppeteerScraper(config);
  }
  return defaultScraper;
}

/**
 * Scrape a single URL (convenience function)
 */
export async function scrapeUrl(url: string, config?: Partial<ScrapingConfig>): Promise<ScrapedContent> {
  const scraper = getScraper(config);
  return scraper.scrapeUrl(url);
}

/**
 * Scrape multiple URLs (convenience function)
 */
export async function scrapeUrls(urls: string[], concurrency?: number, config?: Partial<ScrapingConfig>): Promise<ScrapedContent[]> {
  const scraper = getScraper(config);
  return scraper.scrapeUrls(urls, concurrency);
}

/**
 * Clean up scraper resources
 */
export async function closeScraper(): Promise<void> {
  if (defaultScraper) {
    await defaultScraper.close();
    defaultScraper = null;
  }
}