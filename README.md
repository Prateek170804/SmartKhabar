# SmartKhabar - AI-Powered News Aggregator

A modern, intelligent news aggregation platform built with Next.js that delivers personalized news experiences using advanced AI and machine learning technologies.

## 🚀 Features

### Core Functionality
- **Real-time News Collection** - Automated news gathering from multiple sources
- **AI-Powered Summarization** - Intelligent article summaries using Hugging Face models
- **Personalized Feed** - Machine learning-based content personalization
- **India-Focused News** - Specialized Indian news collection and curation
- **Multi-source Integration** - NewsAPI, NewsData.io, GNews, and web scraping

### Advanced Features
- **Semantic Search** - Vector-based content discovery
- **User Preferences** - Customizable news categories and interests
- **Performance Monitoring** - Real-time system health and analytics
- **Mobile Optimized** - Responsive design for all devices
- **Error Handling** - Comprehensive fallback systems

## 🛠️ Tech Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **React Components** - Modular UI architecture

### Backend
- **Next.js API Routes** - Serverless backend functions
- **Neon Database** - PostgreSQL cloud database
- **Vercel** - Deployment and hosting platform

### AI & ML
- **Hugging Face** - Text summarization and embeddings
- **Vector Search** - Semantic content matching
- **Personalization Engine** - User behavior learning

### External APIs
- **NewsAPI** - Global news source
- **NewsData.io** - Real-time news data
- **GNews** - Google News integration
- **Firecrawl** - Web scraping service

## 📦 Installation

### Prerequisites
- Node.js 18+ 
- npm or yarn
- PostgreSQL database (Neon recommended)

### Setup

1. **Clone the repository**
```bash
git clone https://github.com/Prateek170804/SmartKhabar.git
cd SmartKhabar/smartkhabar
```

2. **Install dependencies**
```bash
npm install
```

3. **Environment Configuration**
```bash
cp .env.example .env.local
```

4. **Configure environment variables**
```env
# Database
DATABASE_URL=your_neon_database_url

# News APIs
NEWSAPI_KEY=your_newsapi_key
NEWSDATA_API_KEY=your_newsdata_key
GNEWS_API_KEY=your_gnews_key

# AI Services
HUGGINGFACE_API_KEY=your_huggingface_key

# Authentication
JWT_SECRET=your_jwt_secret

# Optional Services
FIRECRAWL_API_KEY=your_firecrawl_key
```

5. **Database Setup**
```bash
npm run setup:database
```

6. **Start Development Server**
```bash
npm run dev
```

Visit `http://localhost:3000` to see the application.

## 🚀 Deployment

### Vercel (Recommended)

1. **Deploy to Vercel**
```bash
npm run deploy
```

2. **Configure Environment Variables**
- Add all environment variables in Vercel dashboard
- Ensure database connection is configured

3. **Set up Cron Jobs**
- Configure Vercel cron for automated news collection
- Set up monitoring endpoints

### Manual Deployment

See [DEPLOYMENT.md](smartkhabar/DEPLOYMENT.md) for detailed deployment instructions.

## 📖 API Documentation

### News Endpoints
- `GET /api/news/personalized` - Get personalized news feed
- `GET /api/news/india` - Get India-specific news
- `GET /api/news/breaking` - Get breaking news
- `GET /api/news/realtime` - Get real-time updates

### User Endpoints
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User authentication
- `GET /api/preferences` - Get user preferences
- `POST /api/preferences` - Update preferences

### Analytics
- `GET /api/analytics/dashboard` - System analytics
- `GET /api/monitoring/health` - Health check
- `GET /api/monitoring/performance` - Performance metrics

## 🧪 Testing

### Run Tests
```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e

# Performance tests
npm run test:performance
```

### Test Coverage
- Unit tests for all core components
- Integration tests for API endpoints
- E2E tests for user workflows
- Performance and load testing

## 📁 Project Structure

```
smartkhabar/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── api/            # API routes
│   │   └── page.tsx        # Main page
│   ├── components/         # React components
│   ├── lib/               # Core libraries
│   │   ├── news-collection/
│   │   ├── personalization/
│   │   ├── summarization/
│   │   └── database/
│   └── types/             # TypeScript definitions
├── scripts/               # Utility scripts
├── e2e/                  # End-to-end tests
└── docs/                 # Documentation
```

## 🔧 Configuration

### News Sources
Configure news sources in `src/lib/config.ts`:
- API endpoints and keys
- Collection intervals
- Content filters

### Personalization
Customize ML models in `src/lib/personalization/`:
- User preference learning
- Content recommendation algorithms
- Semantic search parameters

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Hugging Face** - AI model infrastructure
- **Vercel** - Deployment platform
- **Neon** - Database hosting
- **News APIs** - Content providers

## 📞 Support

For support and questions:
- Create an issue on GitHub
- Check the [documentation](smartkhabar/README.md)
- Review [setup guides](smartkhabar/FREE_DEPLOYMENT_GUIDE.md)

---

**SmartKhabar** - Intelligent news for the modern world 🌟