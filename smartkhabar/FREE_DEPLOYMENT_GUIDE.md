# Free Deployment Guide for SmartKhabar

This guide shows how to deploy SmartKhabar using completely free alternatives to paid APIs.

## Free API Alternatives

### 1. News Sources (Replace NewsAPI)

#### Option A: RSS Feeds (Completely Free)
```javascript
// Free RSS feeds to use:
const FREE_RSS_FEEDS = [
  'https://rss.cnn.com/rss/edition.rss',
  'https://feeds.bbci.co.uk/news/rss.xml',
  'https://techcrunch.com/feed/',
  'https://hnrss.org/frontpage', // Hacker News
  'https://www.reddit.com/r/technology/.rss',
  'https://www.wired.com/feed/rss'
];
```

#### Option B: GNews API (100 requests/day free)
```bash
# Sign up at: https://gnews.io/
# Free tier: 100 requests/day
GNEWS_API_KEY=your_gnews_api_key
```

### 2. LLM Services (Replace OpenAI)

#### Option A: Google Gemini (Free)
```bash
# Sign up at: https://makersuite.google.com/app/apikey
# Free tier: 15 requests/minute, 1500 requests/day
GOOGLE_GEMINI_API_KEY=your_gemini_api_key
```

#### Option B: Hugging Face (Free)
```bash
# Sign up at: https://huggingface.co/settings/tokens
# Completely free for inference API
HUGGINGFACE_API_KEY=your_huggingface_token
```

### 3. Web Scraping (Replace Firecrawl)

#### Option A: Built-in Scraping (Free)
- Use Puppeteer or Playwright for scraping
- No external API needed

#### Option B: ScrapingBee (1000 requests/month free)
```bash
# Sign up at: https://www.scrapingbee.com/
SCRAPINGBEE_API_KEY=your_scrapingbee_key
```

## Implementation Steps

### Step 1: Update Environment Variables

Create a `.env.local` file with free alternatives:

```bash
# Database (Supabase - Free tier)
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key

# News API (Choose one)
GNEWS_API_KEY=your_gnews_key  # Option A: GNews
# OR use RSS feeds (no key needed)

# LLM Service (Choose one)
GOOGLE_GEMINI_API_KEY=your_gemini_key  # Option A: Google Gemini
# OR
HUGGINGFACE_API_KEY=your_huggingface_token  # Option B: Hugging Face

# Web Scraping (Choose one)
SCRAPINGBEE_API_KEY=your_scrapingbee_key  # Option A: ScrapingBee
# OR use built-in scraping (no key needed)

# Application
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
NODE_ENV=production
```

### Step 2: Update Code for Free APIs

The application is already designed to work with these alternatives. The configuration will automatically detect and use available APIs.

### Step 3: Deploy to Vercel

```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Set environment variables
npm run env:commands

# 3. Deploy
npm run vercel:deploy
```

## Cost Breakdown

### Current Setup (Paid)
- NewsAPI: $449/month
- OpenAI: ~$50-200/month (depending on usage)
- Firecrawl: $20/month
- **Total: ~$519-669/month**

### Free Setup
- RSS Feeds: $0
- Google Gemini: $0 (within limits)
- Built-in scraping: $0
- Supabase: $0 (free tier)
- Vercel: $0 (hobby plan)
- **Total: $0/month**

## Free Tier Limitations

### GNews API (if used)
- 100 requests/day
- No commercial use without upgrade

### Google Gemini
- 15 requests/minute
- 1,500 requests/day
- Rate limiting may apply

### Supabase Free Tier
- 500MB database storage
- 2GB bandwidth/month
- 50,000 monthly active users

### Vercel Free Tier
- 100GB bandwidth/month
- 1,000 serverless function invocations/day
- Custom domains supported

## Scaling Strategy

When you outgrow free tiers:

1. **News**: Upgrade to GNews Pro ($9/month) or Currents API
2. **LLM**: Switch to OpenAI Pay-as-you-go
3. **Database**: Upgrade Supabase to Pro ($25/month)
4. **Hosting**: Upgrade Vercel to Pro ($20/month)

## Getting API Keys

### 1. GNews API (Free)
1. Go to [gnews.io](https://gnews.io/)
2. Sign up for free account
3. Get API key from dashboard
4. 100 requests/day limit

### 2. Google Gemini (Free)
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with Google account
3. Create new API key
4. 15 requests/minute, 1500/day limit

### 3. Hugging Face (Free)
1. Go to [Hugging Face](https://huggingface.co/settings/tokens)
2. Create account
3. Generate access token
4. Use inference API for free

### 4. ScrapingBee (Free Tier)
1. Go to [ScrapingBee](https://www.scrapingbee.com/)
2. Sign up for free account
3. Get API key
4. 1,000 requests/month limit

### 5. Supabase (Free)
1. Go to [Supabase](https://supabase.com/)
2. Create new project
3. Get URL and anon key from settings
4. 500MB storage, 2GB bandwidth

## Deployment Commands

```bash
# Validate environment
npm run env:validate

# Generate Vercel environment commands
npm run env:commands

# Deploy to production
npm run vercel:deploy

# Test deployment
npm run test:deployment https://your-app.vercel.app
```

## Monitoring Free Usage

Monitor your API usage to stay within free limits:

```bash
# Check production metrics
npm run monitor:production

# Check health status
npm run monitor:health
```

The application includes built-in monitoring to track API usage and alert you when approaching limits.