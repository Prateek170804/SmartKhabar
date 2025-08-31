# SmartKhabar Deployment Guide

This guide covers deploying SmartKhabar to Vercel with proper configuration for serverless functions, environment variables, and production optimizations.

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Vercel CLI**: Install globally with `npm i -g vercel`
3. **Required API Keys**: Obtain keys for all external services

## Required Environment Variables

### Database Configuration
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Supabase anonymous key

### API Keys
- `NEWS_API_KEY`: NewsAPI.org API key
- `OPENAI_API_KEY`: OpenAI API key for LLM services
- `FIRECRAWL_API_KEY`: Firecrawl API key for web scraping

### Application Configuration
- `NEXT_PUBLIC_APP_URL`: Public URL of your deployed application
- `NODE_ENV`: Set to "production" (automatically set by Vercel)

## Deployment Steps

### 1. Environment Setup

First, validate your local environment:
```bash
npm run env:validate
```

Generate Vercel environment variable commands:
```bash
npm run env:commands
```

This will output commands like:
```bash
vercel env add SUPABASE_URL
vercel env add SUPABASE_ANON_KEY
# ... etc
```

### 2. Set Environment Variables

**Option A: Using Vercel CLI**
Run the commands generated in step 1, entering your actual values when prompted.

**Option B: Using Vercel Dashboard**
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to Settings → Environment Variables
4. Add all required variables

### 3. Deploy to Vercel

**For Production Deployment:**
```bash
npm run vercel:deploy
```

**For Preview Deployment:**
```bash
npm run vercel:deploy:preview
```

**Manual Deployment Steps:**
```bash
# Prepare deployment (runs tests, type-check, build)
npm run deploy:prepare

# Deploy to production
vercel --prod

# Or deploy preview
vercel
```

### 4. Verify Deployment

After deployment, verify your application:

1. **Health Check**: Visit `https://your-app.vercel.app/health`
2. **API Endpoints**: Test key endpoints:
   - `/api/news/personalized`
   - `/api/preferences`
   - `/api/articles/summary`
3. **Cron Jobs**: Check Vercel dashboard for cron job status

## Vercel Configuration

The `vercel.json` file includes:

### Serverless Functions Configuration
- **Memory allocation**: Optimized per function (256MB - 1024MB)
- **Timeout settings**: Based on function complexity (10s - 300s)
- **Cron jobs**: News collection every 2 hours

### Security Headers
- CORS configuration for API routes
- Security headers (XSS protection, content type options)
- Frame options for clickjacking protection

### Performance Optimizations
- Cache headers for API responses
- Static asset optimization
- CDN configuration

## Troubleshooting

### Common Issues

**1. Environment Variables Not Set**
```bash
# Check which variables are missing
npm run env:validate

# Generate setup commands
npm run env:commands
```

**2. Build Failures**
```bash
# Run local build to debug
npm run build

# Check type errors
npm run type-check

# Run tests
npm run test:run
```

**3. Function Timeouts**
- Check function memory allocation in `vercel.json`
- Optimize database queries
- Implement proper caching

**4. Cron Job Failures**
- Check Vercel dashboard logs
- Verify environment variables are set
- Test the cron endpoint manually

### Deployment Scripts

**Skip Tests (for quick deployments):**
```bash
npm run deploy:prepare:skip-tests
```

**Skip Build (if already built):**
```bash
npm run deploy:prepare:skip-build
```

**Full Preparation:**
```bash
npm run deploy:prepare
```

## Monitoring and Maintenance

### Performance Monitoring
- Use Vercel Analytics for performance insights
- Monitor function execution times
- Track error rates and response times

### Database Maintenance
- Monitor Supabase usage and performance
- Implement connection pooling for high traffic
- Regular cleanup of old articles and embeddings

### API Rate Limits
- Monitor external API usage (NewsAPI, OpenAI, Firecrawl)
- Implement proper error handling for rate limits
- Consider caching strategies for expensive operations

## Production Optimizations

The deployment includes comprehensive production optimizations:

### 1. Caching Strategy
- **In-Memory Caching**: 100MB cache with intelligent TTL management
- **API Response Caching**: Personalized content cached for 5-10 minutes
- **Static Asset Caching**: 1-year cache for immutable assets
- **CDN Integration**: Vercel Edge Network with stale-while-revalidate

### 2. Database Optimization
- **Connection Pooling**: Up to 10 concurrent Supabase connections
- **Idle Connection Management**: Automatic cleanup after 5 minutes
- **Query Optimization**: Optimized database operations with monitoring

### 3. Performance Monitoring
- **Response Time Tracking**: Sub-3-second response time targets
- **Memory Usage Monitoring**: 80% memory usage alerts
- **Error Rate Tracking**: 5% error rate thresholds
- **Real-time Metrics**: `/api/monitoring/production` endpoint

### 4. Security Enhancements
- **Security Headers**: XSS protection, content type options, frame options
- **CORS Configuration**: Proper cross-origin resource sharing
- **Content Security Policy**: Protection against injection attacks
- **Rate Limiting**: 100 requests per minute per IP (production)

### 5. Logging and Monitoring
- **Structured Logging**: JSON-formatted logs for production
- **Request Tracking**: Unique request IDs for tracing
- **Performance Logging**: API call duration and database operation timing
- **Error Tracking**: Comprehensive error logging with context

### 6. CDN and Asset Optimization
- **Image Optimization**: Next.js Image component with WebP support
- **Static Asset Compression**: Gzip compression for all assets
- **Resource Preloading**: Critical resource hints for faster loading
- **Cache Headers**: Optimized cache control for different content types

## Support

For deployment issues:
1. Check Vercel dashboard logs
2. Run local deployment preparation: `npm run deploy:prepare`
3. Verify all environment variables are set
4. Test API endpoints locally before deployment

## Next Steps

After successful deployment:
1. Set up monitoring and alerting
2. Configure custom domain (optional)
3. Set up CI/CD pipeline for automated deployments
4. Implement production logging and analytics