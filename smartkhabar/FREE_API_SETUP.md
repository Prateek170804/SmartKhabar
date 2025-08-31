# Free API Setup Guide

Complete guide to set up SmartKhabar with **100% free APIs**.

## Your Free Stack
- **News**: GNews API (100 requests/day free)
- **LLM**: Hugging Face Transformers (free)
- **Database**: Neon PostgreSQL (free tier)
- **Scraping**: Puppeteer (built-in, no API needed)
- **Hosting**: Vercel (free tier)

## Step 1: Get GNews API Key (Free)

1. Go to [gnews.io](https://gnews.io/)
2. Click "Get API Key"
3. Sign up with email
4. Verify email
5. Copy your API key from dashboard
6. **Limit**: 100 requests/day free

```bash
GNEWS_API_KEY=your_gnews_api_key_here
```

## Step 2: Get Hugging Face Token (Free)

1. Go to [huggingface.co](https://huggingface.co/)
2. Create account
3. Go to Settings → Access Tokens
4. Create new token with "Read" permission
5. Copy the token
6. **Limit**: Unlimited free inference API

```bash
HUGGINGFACE_API_KEY=your_huggingface_token_here
```

## Step 3: Set up Neon Database (Free)

1. Go to [neon.tech](https://neon.tech/)
2. Sign up with GitHub/Google
3. Create new project
4. Copy connection string from dashboard
5. **Limit**: 3GB storage, 100 hours compute/month free

```bash
DATABASE_URL=postgresql://username:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
```

## Step 4: Configure Environment Variables

Create `.env.local` file:

```bash
# Database (Neon)
DATABASE_URL=postgresql://your-neon-connection-string

# News API (GNews - 100 requests/day free)
GNEWS_API_KEY=your_gnews_api_key

# LLM Service (Hugging Face - Free)
HUGGINGFACE_API_KEY=your_huggingface_token

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development

# Optional: Backup APIs (if you have them)
NEWS_API_KEY=your_newsapi_key_if_you_have_it
OPENAI_API_KEY=your_openai_key_if_you_have_it
```

## Step 5: Update Database Configuration

Since you're using Neon instead of Supabase, update the database config:

```typescript
// src/lib/config.ts
export const config = {
  database: {
    url: process.env.DATABASE_URL || '',
    // Remove Supabase-specific config
  },
  apis: {
    gnews: {
      apiKey: process.env.GNEWS_API_KEY || '',
      baseUrl: 'https://gnews.io/api/v4'
    },
    huggingface: {
      apiKey: process.env.HUGGINGFACE_API_KEY || '',
      baseUrl: 'https://api-inference.huggingface.co'
    }
  }
};
```

## Step 6: Install Dependencies

```bash
# Install Puppeteer for free web scraping
npm install puppeteer --legacy-peer-deps

# Install PostgreSQL client for Neon
npm install pg @types/pg
```

## Step 7: Test Your Setup

```bash
# Test environment variables
npm run env:validate

# Test APIs
node -e "
const { getGNewsClient } = require('./src/lib/news-collection/gnews-client.ts');
const { getHuggingFaceClient } = require('./src/lib/llm/huggingface-client.ts');

async function test() {
  try {
    const gnews = getGNewsClient();
    const hf = getHuggingFaceClient();
    
    console.log('Testing GNews API...');
    const articles = await gnews.search({ q: 'technology', max: 1 });
    console.log('✅ GNews working:', articles.length, 'articles');
    
    console.log('Testing Hugging Face...');
    const summary = await hf.summarizeText('This is a test article about technology.');
    console.log('✅ Hugging Face working:', summary.length, 'chars');
    
    console.log('🎉 All APIs working!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

test();
"
```

## Step 8: Deploy to Vercel

```bash
# Set environment variables in Vercel
vercel env add DATABASE_URL
vercel env add GNEWS_API_KEY  
vercel env add HUGGINGFACE_API_KEY
vercel env add NEXT_PUBLIC_APP_URL

# Deploy
npm run vercel:deploy
```

## API Usage Limits & Monitoring

### GNews API (100 requests/day)
```javascript
// Check remaining requests
const gnews = getGNewsClient();
console.log('Remaining requests:', gnews.getRemainingRequests());
```

### Hugging Face (Free, but rate limited)
- ~1000 requests/hour per model
- May have cold start delays
- Use caching to minimize requests

### Neon Database (Free tier)
- 3GB storage
- 100 compute hours/month
- Automatic sleep after inactivity

## Cost Comparison

### Your Free Setup: $0/month
- GNews: $0 (100 requests/day)
- Hugging Face: $0 (unlimited)
- Neon: $0 (3GB storage)
- Puppeteer: $0 (self-hosted)
- Vercel: $0 (hobby plan)

### Previous Paid Setup: ~$500+/month
- NewsAPI: $449/month
- OpenAI: $50-200/month
- Firecrawl: $20/month
- Supabase Pro: $25/month

## Scaling Strategy

When you outgrow free tiers:

1. **GNews**: Upgrade to $9/month for 10,000 requests/day
2. **Hugging Face**: Use dedicated endpoints ($0.06/hour)
3. **Neon**: Scale plan starts at $19/month
4. **Vercel**: Pro plan at $20/month

## Troubleshooting

### GNews API Issues
```bash
# Check API status
curl "https://gnews.io/api/v4/search?q=test&token=YOUR_API_KEY&max=1"
```

### Hugging Face Issues
```bash
# Check API status
curl -H "Authorization: Bearer YOUR_TOKEN" \
     "https://api-inference.huggingface.co/models/facebook/bart-large-cnn" \
     -d '{"inputs": "test"}'
```

### Neon Database Issues
```bash
# Test connection
psql "postgresql://your-connection-string" -c "SELECT version();"
```

## Performance Tips

1. **Cache aggressively** - Free APIs have rate limits
2. **Batch requests** - Minimize API calls
3. **Use fallbacks** - Have backup content ready
4. **Monitor usage** - Track API consumption
5. **Optimize scraping** - Disable images, use headless mode

## Next Steps

1. Set up monitoring for API usage
2. Implement caching for expensive operations
3. Add fallback content for when APIs are down
4. Monitor performance and optimize as needed

Your SmartKhabar is now running on a completely free stack! 🎉