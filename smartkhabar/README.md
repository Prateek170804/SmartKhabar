# SmartKhabar - AI-Powered News Aggregator

SmartKhabar is a personalized AI news companion that delivers intelligent, bite-sized summaries tailored to your interests, preferred tone, and reading time constraints.

## Features

- **Personalized News Feed**: AI-powered content matching based on your preferences
- **Intelligent Summarization**: Tone-adapted summaries with configurable reading time
- **Semantic Search**: FAISS-powered vector search for relevant content discovery
- **Multi-Source Aggregation**: Collects news from CNN, BBC, TechCrunch, and Hacker News
- **Learning System**: Adapts recommendations based on user interactions

## Tech Stack

- **Frontend**: Next.js 15 with TypeScript and Tailwind CSS
- **AI/ML**: Langchain for LLM orchestration, FAISS for vector search
- **Database**: Supabase for user data and preferences
- **APIs**: NewsAPI, OpenAI, Firecrawl for content collection and processing
- **Deployment**: Vercel serverless architecture

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- API keys for required services (see Environment Variables)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd smartkhabar
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

4. Configure your API keys in `.env.local`:
- `SUPABASE_URL` and `SUPABASE_ANON_KEY`
- `NEWS_API_KEY` from NewsAPI
- `OPENAI_API_KEY` for AI services
- `FIRECRAWL_API_KEY` for web scraping

5. Run the development server:
```bash
npm run dev
```

6. Check application health:
```bash
npm run health
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SUPABASE_URL` | Supabase project URL | Yes |
| `SUPABASE_ANON_KEY` | Supabase anonymous key | Yes |
| `NEWS_API_KEY` | NewsAPI.org API key | Yes |
| `OPENAI_API_KEY` | OpenAI API key for LLM services | Yes |
| `FIRECRAWL_API_KEY` | Firecrawl API key for web scraping | Yes |
| `NEXT_PUBLIC_APP_URL` | Application URL | No |

## Project Structure

```
src/
├── app/                 # Next.js app router
│   ├── api/            # API routes
│   └── ...             # Pages and layouts
├── components/         # React components
├── lib/               # Configuration and clients
├── services/          # Business logic services
├── types/             # TypeScript type definitions
├── utils/             # Utility functions
└── data/              # Static data and constants
```

## API Endpoints

- `GET /api/health` - Application health check
- `GET /api/news/personalized` - Get personalized news feed
- `GET/PUT /api/preferences` - Manage user preferences
- `POST /api/articles/summary` - Generate article summary
- `POST /api/interactions` - Track user interactions

## Development

### Type Checking
```bash
npm run type-check
```

### Linting
```bash
npm run lint
```

### Building
```bash
npm run build
```

### Testing
```bash
npm run test        # Run tests in watch mode
npm run test:run    # Run tests once
```

## Deployment

SmartKhabar is configured for deployment on Vercel with serverless functions and automated cron jobs.

### Quick Deploy

1. **Prepare deployment:**
```bash
npm run deploy:prepare
```

2. **Deploy to Vercel:**
```bash
npm run vercel:deploy        # Production
npm run vercel:deploy:preview # Preview
```

### Environment Setup

1. **Validate local environment:**
```bash
npm run env:validate
```

2. **Generate Vercel environment commands:**
```bash
npm run env:commands
```

3. **Test deployed application:**
```bash
npm run test:deployment https://your-app.vercel.app
```

### Deployment Features

- **Serverless Functions**: Optimized memory and timeout settings
- **Cron Jobs**: Automated news collection every 2 hours
- **Security Headers**: CORS, XSS protection, and content security
- **Performance**: CDN optimization and response caching
- **Monitoring**: Health checks and performance endpoints

For detailed deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md).

## Contributing

1. Follow the existing code style and TypeScript conventions
2. Add tests for new functionality
3. Update documentation as needed
4. Ensure all environment variables are documented

## License

This project is licensed under the MIT License.