# SmartKhabar Technical Terms Explained

This document provides detailed explanations of all technical terms and technologies used in the SmartKhabar project architecture.

## Table of Contents
1. [Frontend Layer Technologies](#frontend-layer-technologies)
2. [Backend Layer Technologies](#backend-layer-technologies)
3. [Data Layer Technologies](#data-layer-technologies)
4. [AI/ML Layer Technologies](#aiml-layer-technologies)
5. [External Integrations](#external-integrations)
6. [Architecture Patterns](#architecture-patterns)
7. [Development & Deployment Tools](#development--deployment-tools)

---

## Frontend Layer Technologies

### Next.js 15
**What it is:** A React-based web framework developed by Vercel that enables server-side rendering, static site generation, and full-stack capabilities.

**Key Features:**
- **App Router:** New routing system introduced in Next.js 13+ that uses the `app` directory structure
- **Server Components:** React components that run on the server, reducing client-side JavaScript
- **Automatic Code Splitting:** Splits JavaScript bundles automatically for better performance
- **Built-in Optimization:** Image optimization, font loading, and CSS optimization out of the box

**Why we use it:**
```javascript
// Example: App Router structure
app/
├── page.tsx          // Home page (/)
├── news/
│   └── page.tsx      // News page (/news)
└── api/
    └── route.ts      // API endpoint
```

**Benefits:**
- Faster page loads through server-side rendering
- Better SEO with pre-rendered content
- Seamless API integration
- Automatic performance optimizations

### App Router
**What it is:** Next.js 13+ routing system that uses file-system based routing with the `app` directory.

**Key Concepts:**
- **Pages:** `page.tsx` files define routes
- **Layouts:** `layout.tsx` files define shared UI
- **Loading:** `loading.tsx` files show loading states
- **Error:** `error.tsx` files handle errors

**Example Structure:**
```
app/
├── layout.tsx        // Root layout
├── page.tsx         // Home page
├── news/
│   ├── layout.tsx   // News section layout
│   ├── page.tsx     // News listing
│   └── [id]/
│       └── page.tsx // Individual news article
```

### Server-Side Rendering (SSR)
**What it is:** A technique where web pages are rendered on the server before being sent to the client's browser.

**How it works:**
1. User requests a page
2. Server generates HTML with data
3. Complete HTML sent to browser
4. Browser displays content immediately
5. JavaScript hydrates the page for interactivity

**Benefits:**
- Faster initial page load
- Better SEO (search engines can crawl content)
- Improved performance on slow devices
- Better user experience

### React 19
**What it is:** The latest version of React, a JavaScript library for building user interfaces using components.

**New Features in React 19:**
- **Server Components:** Components that run on the server
- **Concurrent Features:** Better handling of multiple tasks
- **Automatic Batching:** Groups multiple state updates
- **Suspense Improvements:** Better loading state management

**Component Example:**
```jsx
// React component with hooks
function NewsFeed() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchArticles().then(data => {
      setArticles(data);
      setLoading(false);
    });
  }, []);

  if (loading) return <div>Loading...</div>;
  
  return (
    <div>
      {articles.map(article => (
        <ArticleCard key={article.id} article={article} />
      ))}
    </div>
  );
}
```

### TypeScript
**What it is:** A programming language that adds static type definitions to JavaScript.

**Key Benefits:**
- **Type Safety:** Catch errors at compile time
- **Better IDE Support:** Autocomplete, refactoring, navigation
- **Self-Documenting Code:** Types serve as documentation
- **Easier Refactoring:** Confident code changes

**Example:**
```typescript
// Type definitions
interface Article {
  id: string;
  title: string;
  content: string;
  publishedAt: Date;
  author?: string;
}

// Function with types
async function fetchArticles(category: string): Promise<Article[]> {
  const response = await fetch(`/api/articles?category=${category}`);
  return response.json();
}

// Component with typed props
interface ArticleCardProps {
  article: Article;
  onRead: (id: string) => void;
}

function ArticleCard({ article, onRead }: ArticleCardProps) {
  return (
    <div onClick={() => onRead(article.id)}>
      <h3>{article.title}</h3>
      <p>{article.content}</p>
    </div>
  );
}
```

### Tailwind CSS
**What it is:** A utility-first CSS framework that provides low-level utility classes to build custom designs.

**Key Concepts:**
- **Utility Classes:** Small, single-purpose classes
- **Responsive Design:** Built-in responsive utilities
- **Component Composition:** Build components by combining utilities
- **Customization:** Highly customizable through configuration

**Example:**
```jsx
// Tailwind utility classes
function NewsCard() {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
      <h2 className="text-xl font-bold text-gray-900 mb-2">
        Article Title
      </h2>
      <p className="text-gray-600 text-sm mb-4">
        Published 2 hours ago
      </p>
      <p className="text-gray-800 leading-relaxed">
        Article content goes here...
      </p>
      <button className="mt-4 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">
        Read More
      </button>
    </div>
  );
}
```

**Benefits:**
- Rapid development
- Consistent design system
- Small bundle size (unused styles are purged)
- No naming conflicts

### Framer Motion
**What it is:** A production-ready motion library for React that makes it easy to create animations and gestures.

**Key Features:**
- **Declarative Animations:** Define animations in JSX
- **Gesture Recognition:** Handle drag, tap, hover, etc.
- **Layout Animations:** Animate layout changes automatically
- **SVG Support:** Animate SVG elements

**Example:**
```jsx
import { motion, AnimatePresence } from 'framer-motion';

function AnimatedNewsFeed({ articles }) {
  return (
    <AnimatePresence>
      {articles.map(article => (
        <motion.div
          key={article.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          whileHover={{ scale: 1.02 }}
          className="news-card"
        >
          <h3>{article.title}</h3>
          <p>{article.summary}</p>
        </motion.div>
      ))}
    </AnimatePresence>
  );
}
```

---

## Backend Layer Technologies

### Serverless Architecture
**What it is:** A cloud computing model where the cloud provider manages the server infrastructure, and you only pay for the actual compute time used.

**Key Characteristics:**
- **No Server Management:** Cloud provider handles servers
- **Automatic Scaling:** Scales up/down based on demand
- **Pay-per-Use:** Only pay for execution time
- **Event-Driven:** Functions triggered by events

**Benefits:**
- Reduced operational overhead
- Cost-effective for variable workloads
- Automatic scaling
- High availability

**Example in Next.js:**
```javascript
// API route (serverless function)
// app/api/news/route.ts
export async function GET(request) {
  // This function runs on-demand
  const articles = await fetchLatestNews();
  return Response.json(articles);
}
```

### Next.js API Routes
**What it is:** Server-side functions that handle HTTP requests in Next.js applications.

**File Structure:**
```
app/api/
├── news/
│   ├── route.ts          // GET/POST /api/news
│   └── [id]/
│       └── route.ts      // GET/PUT/DELETE /api/news/[id]
├── auth/
│   ├── login/
│   │   └── route.ts      // POST /api/auth/login
│   └── register/
│       └── route.ts      // POST /api/auth/register
```

**Example Implementation:**
```typescript
// app/api/news/personalized/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Extract user preferences
    const userId = request.headers.get('user-id');
    const preferences = await getUserPreferences(userId);
    
    // Get personalized articles
    const articles = await getPersonalizedNews(preferences);
    
    return NextResponse.json({
      success: true,
      data: articles
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch news' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  // Handle POST request
}
```

### RESTful API Design
**What it is:** An architectural style for designing web services that uses HTTP methods and follows REST principles.

**REST Principles:**
1. **Stateless:** Each request contains all necessary information
2. **Resource-Based:** URLs represent resources, not actions
3. **HTTP Methods:** Use appropriate HTTP verbs
4. **Uniform Interface:** Consistent API structure

**HTTP Methods:**
- **GET:** Retrieve data (read-only)
- **POST:** Create new resources
- **PUT:** Update existing resources
- **DELETE:** Remove resources
- **PATCH:** Partial updates

**Example API Design:**
```
GET    /api/articles           # Get all articles
GET    /api/articles/123       # Get specific article
POST   /api/articles           # Create new article
PUT    /api/articles/123       # Update entire article
PATCH  /api/articles/123       # Partial update
DELETE /api/articles/123       # Delete article

GET    /api/users/456/preferences    # Get user preferences
PUT    /api/users/456/preferences    # Update preferences
```

### Middleware
**What it is:** Software that sits between different parts of an application to handle cross-cutting concerns like authentication, logging, and request processing.

**Common Middleware Functions:**
- Authentication and authorization
- Request logging
- Error handling
- Rate limiting
- CORS handling

**Next.js Middleware Example:**
```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // Authentication check
  const token = request.cookies.get('auth-token');
  
  if (!token && request.nextUrl.pathname.startsWith('/api/protected')) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  // Rate limiting
  const ip = request.ip || 'unknown';
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429 }
    );
  }
  
  // Add security headers
  const response = NextResponse.next();
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  
  return response;
}

export const config = {
  matcher: ['/api/:path*', '/dashboard/:path*']
};
```

---

## Data Layer Technologies

### Supabase
**What it is:** An open-source Firebase alternative that provides a complete backend-as-a-service with PostgreSQL database, authentication, real-time subscriptions, and storage.

**Key Features:**
- **PostgreSQL Database:** Full-featured relational database
- **Authentication:** Built-in user management
- **Real-time:** Live data synchronization
- **Row Level Security:** Database-level security policies
- **Auto-generated APIs:** REST and GraphQL APIs

**Example Usage:**
```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

// Insert data
const { data, error } = await supabase
  .from('articles')
  .insert({
    title: 'Breaking News',
    content: 'Article content...',
    category: 'technology'
  });

// Query with filters
const { data: articles } = await supabase
  .from('articles')
  .select('*')
  .eq('category', 'technology')
  .order('published_at', { ascending: false })
  .limit(10);

// Real-time subscription
supabase
  .channel('articles')
  .on('postgres_changes', 
    { event: 'INSERT', schema: 'public', table: 'articles' },
    (payload) => {
      console.log('New article:', payload.new);
    }
  )
  .subscribe();
```

### Neon PostgreSQL
**What it is:** A serverless PostgreSQL database platform that separates compute and storage for better scalability and cost efficiency.

**Key Features:**
- **Serverless:** Automatic scaling and hibernation
- **Branching:** Database branches like Git branches
- **Point-in-Time Recovery:** Restore to any point in time
- **Connection Pooling:** Efficient connection management

**Example Configuration:**
```typescript
// Database connection
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20, // Maximum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Query example
async function getUserPreferences(userId: string) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM user_preferences WHERE user_id = $1',
      [userId]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}
```

### FAISS (Facebook AI Similarity Search)
**What it is:** A library for efficient similarity search and clustering of dense vectors, developed by Facebook AI Research.

**Key Features:**
- **Fast Search:** Optimized for large-scale vector search
- **Multiple Index Types:** Different algorithms for different use cases
- **GPU Support:** Accelerated computation on GPUs
- **Approximate Search:** Trade accuracy for speed

**Use Cases in SmartKhabar:**
- Finding similar articles
- Semantic search for user queries
- Content recommendation
- Duplicate detection

**Example Implementation:**
```typescript
import * as faiss from 'faiss-node';

class SemanticSearchEngine {
  private index: faiss.Index;
  private embeddings: Map<number, string> = new Map();

  constructor(dimension: number) {
    // Create FAISS index for 384-dimensional vectors
    this.index = new faiss.IndexFlatIP(dimension);
  }

  async addArticle(articleId: string, embedding: number[]) {
    // Add vector to index
    const id = this.index.ntotal;
    this.index.add(embedding);
    this.embeddings.set(id, articleId);
  }

  async search(queryEmbedding: number[], k: number = 10) {
    // Search for similar vectors
    const results = this.index.search(queryEmbedding, k);
    
    return results.labels.map((id, index) => ({
      articleId: this.embeddings.get(id),
      similarity: results.distances[index]
    }));
  }
}
```

### In-Memory Caching
**What it is:** Storing frequently accessed data in RAM for faster retrieval, reducing database queries and API calls.

**Types of Caching:**
- **Application Cache:** In-process memory cache
- **Distributed Cache:** Shared cache across multiple servers (Redis)
- **Browser Cache:** Client-side caching
- **CDN Cache:** Geographic content distribution

**Implementation Example:**
```typescript
class MemoryCache<T> {
  private cache = new Map<string, { data: T; expiry: number }>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes

  set(key: string, data: T, ttl?: number): void {
    const expiry = Date.now() + (ttl || this.defaultTTL);
    this.cache.set(key, { data, expiry });
  }

  get(key: string): T | null {
    const cached = this.cache.get(key);
    
    if (!cached) return null;
    
    if (cached.expiry < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  clear(): void {
    this.cache.clear();
  }
}

// Usage
const articleCache = new MemoryCache<Article[]>();

async function getCachedArticles(category: string): Promise<Article[]> {
  const cacheKey = `articles:${category}`;
  
  // Try cache first
  let articles = articleCache.get(cacheKey);
  
  if (!articles) {
    // Fetch from database
    articles = await fetchArticlesFromDB(category);
    // Cache for 10 minutes
    articleCache.set(cacheKey, articles, 10 * 60 * 1000);
  }
  
  return articles;
}
```

---

## AI/ML Layer Technologies

### LangChain
**What it is:** A framework for developing applications powered by language models, providing tools for chaining LLM calls, memory management, and agent creation.

**Key Components:**
- **Chains:** Sequence of calls to LLMs or other utilities
- **Agents:** LLMs that can use tools and make decisions
- **Memory:** Persistent state between chain calls
- **Retrievers:** Interface for fetching relevant documents

**Example Implementation:**
```typescript
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { LLMChain } from 'langchain/chains';

class NewssummarizationService {
  private llm: ChatOpenAI;
  private chain: LLMChain;

  constructor() {
    this.llm = new ChatOpenAI({
      modelName: 'gpt-3.5-turbo',
      temperature: 0.3,
    });

    const prompt = PromptTemplate.fromTemplate(`
      Summarize the following news articles in a {tone} tone, 
      keeping it under {maxWords} words:
      
      Articles: {articles}
      
      Summary:
    `);

    this.chain = new LLMChain({
      llm: this.llm,
      prompt: prompt,
    });
  }

  async summarizeArticles(articles: Article[], tone: string, maxWords: number) {
    const articlesText = articles
      .map(a => `${a.title}: ${a.content}`)
      .join('\n\n');

    const result = await this.chain.call({
      articles: articlesText,
      tone: tone,
      maxWords: maxWords,
    });

    return result.text;
  }
}
```

### LLM Orchestration
**What it is:** The process of coordinating multiple language model calls, managing context, and chaining operations to create complex AI workflows.

**Key Concepts:**
- **Chain of Thought:** Breaking complex tasks into steps
- **Context Management:** Maintaining conversation history
- **Tool Usage:** LLMs calling external functions
- **Error Handling:** Graceful failure and retry logic

**Example Orchestration:**
```typescript
class AINewsOrchestrator {
  async processNewsArticle(article: Article, userPreferences: UserPreferences) {
    // Step 1: Analyze article content
    const analysis = await this.analyzeContent(article);
    
    // Step 2: Check relevance to user interests
    const relevanceScore = await this.calculateRelevance(analysis, userPreferences);
    
    // Step 3: Generate personalized summary if relevant
    if (relevanceScore > 0.7) {
      const summary = await this.generateSummary(article, userPreferences);
      return { article, summary, relevanceScore };
    }
    
    return null;
  }

  private async analyzeContent(article: Article) {
    const prompt = `Analyze this article and extract:
    1. Main topics
    2. Sentiment
    3. Key entities
    4. Category
    
    Article: ${article.content}`;
    
    return await this.llm.invoke(prompt);
  }
}
```

### OpenAI GPT Models
**What it is:** Large language models developed by OpenAI that can understand and generate human-like text.

**Model Variants:**
- **GPT-3.5-turbo:** Fast, cost-effective for most tasks
- **GPT-4:** More capable, better reasoning
- **GPT-4-turbo:** Faster GPT-4 with larger context window

**Key Parameters:**
- **Temperature:** Controls randomness (0 = deterministic, 1 = creative)
- **Max Tokens:** Maximum response length
- **Top-p:** Nucleus sampling parameter
- **Frequency Penalty:** Reduces repetition

**Example Usage:**
```typescript
import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generateSummary(article: string, tone: string) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      {
        role: 'system',
        content: `You are a news summarizer. Create summaries in a ${tone} tone.`
      },
      {
        role: 'user',
        content: `Summarize this article in 2-3 sentences: ${article}`
      }
    ],
    temperature: 0.3,
    max_tokens: 150,
  });

  return completion.choices[0].message.content;
}
```

### Hugging Face Transformers
**What it is:** A library providing pre-trained transformer models for natural language processing tasks.

**Key Features:**
- **Pre-trained Models:** Thousands of ready-to-use models
- **Multiple Frameworks:** PyTorch, TensorFlow, JAX support
- **Easy Fine-tuning:** Adapt models to specific tasks
- **Tokenization:** Text preprocessing utilities

**Common Models:**
- **BERT:** Bidirectional encoder for understanding
- **Sentence-BERT:** Optimized for sentence embeddings
- **DistilBERT:** Smaller, faster version of BERT
- **RoBERTa:** Robustly optimized BERT

**Example Implementation:**
```typescript
import { pipeline, env } from '@xenova/transformers';

class EmbeddingService {
  private model: any;

  async initialize() {
    // Load sentence embedding model
    this.model = await pipeline(
      'feature-extraction',
      'sentence-transformers/all-MiniLM-L6-v2'
    );
  }

  async generateEmbedding(text: string): Promise<number[]> {
    // Clean and prepare text
    const cleanText = this.cleanText(text);
    
    // Generate embedding
    const output = await this.model(cleanText, {
      pooling: 'mean',
      normalize: true,
    });
    
    return Array.from(output.data);
  }

  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '')
      .trim()
      .toLowerCase();
  }
}
```

### Custom Semantic Search Engine
**What it is:** A search system that understands the meaning and context of queries, not just keyword matching.

**How it works:**
1. **Text Preprocessing:** Clean and normalize text
2. **Embedding Generation:** Convert text to vectors
3. **Index Building:** Store vectors in searchable format
4. **Query Processing:** Convert search query to vector
5. **Similarity Matching:** Find most similar content
6. **Result Ranking:** Score and sort results

**Implementation:**
```typescript
class SemanticSearchEngine {
  private vectorStore: VectorStore;
  private embeddingService: EmbeddingService;

  async indexArticle(article: Article) {
    // Generate embeddings for article chunks
    const chunks = this.chunkText(article.content);
    
    for (const chunk of chunks) {
      const embedding = await this.embeddingService.generateEmbedding(chunk.text);
      
      await this.vectorStore.add({
        id: chunk.id,
        vector: embedding,
        metadata: {
          articleId: article.id,
          title: article.title,
          category: article.category,
          publishedAt: article.publishedAt,
        }
      });
    }
  }

  async search(query: string, filters?: SearchFilters): Promise<SearchResult[]> {
    // Convert query to embedding
    const queryEmbedding = await this.embeddingService.generateEmbedding(query);
    
    // Search vector store
    const results = await this.vectorStore.search(queryEmbedding, {
      limit: 50,
      threshold: 0.7,
      filters: filters,
    });

    // Re-rank results
    return this.reRankResults(results, query);
  }

  private chunkText(text: string, chunkSize: number = 500): TextChunk[] {
    const sentences = text.split(/[.!?]+/);
    const chunks: TextChunk[] = [];
    let currentChunk = '';
    let chunkIndex = 0;

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > chunkSize) {
        if (currentChunk.trim()) {
          chunks.push({
            id: `chunk-${chunkIndex++}`,
            text: currentChunk.trim(),
          });
        }
        currentChunk = sentence;
      } else {
        currentChunk += sentence + '.';
      }
    }

    if (currentChunk.trim()) {
      chunks.push({
        id: `chunk-${chunkIndex}`,
        text: currentChunk.trim(),
      });
    }

    return chunks;
  }
}
```

---

## External Integrations

### NewsAPI
**What it is:** A REST API that provides access to news articles from over 80,000 news sources and blogs worldwide.

**Key Features:**
- **Multiple Endpoints:** Headlines, everything, sources
- **Filtering Options:** Country, category, language, sources
- **Search Capabilities:** Keyword search with operators
- **Rate Limiting:** Different limits based on plan

**API Endpoints:**
```
GET /v2/top-headlines     # Breaking news headlines
GET /v2/everything        # Search through articles
GET /v2/sources          # Available news sources
```

**Example Implementation:**
```typescript
class NewsAPIClient {
  private apiKey: string;
  private baseURL = 'https://newsapi.org/v2';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async getTopHeadlines(options: {
    country?: string;
    category?: string;
    sources?: string;
    pageSize?: number;
  } = {}) {
    const params = new URLSearchParams({
      apiKey: this.apiKey,
      ...options,
      pageSize: (options.pageSize || 20).toString(),
    });

    const response = await fetch(`${this.baseURL}/top-headlines?${params}`);
    
    if (!response.ok) {
      throw new Error(`NewsAPI error: ${response.statusText}`);
    }

    const data = await response.json();
    return this.transformArticles(data.articles);
  }

  async searchArticles(query: string, options: {
    from?: string;
    to?: string;
    sortBy?: 'relevancy' | 'popularity' | 'publishedAt';
    pageSize?: number;
  } = {}) {
    const params = new URLSearchParams({
      apiKey: this.apiKey,
      q: query,
      ...options,
      pageSize: (options.pageSize || 20).toString(),
    });

    const response = await fetch(`${this.baseURL}/everything?${params}`);
    const data = await response.json();
    return this.transformArticles(data.articles);
  }

  private transformArticles(articles: any[]): Article[] {
    return articles.map(article => ({
      id: this.generateId(article.url),
      title: article.title,
      description: article.description,
      content: article.content || article.description,
      url: article.url,
      urlToImage: article.urlToImage,
      publishedAt: new Date(article.publishedAt),
      source: {
        id: article.source.id,
        name: article.source.name,
      },
      author: article.author,
      category: 'general', // NewsAPI doesn't provide category in articles
    }));
  }
}
```

### NewsData.io
**What it is:** A news aggregation API that provides real-time news data from thousands of sources with enhanced metadata and categorization.

**Key Features:**
- **Real-time Updates:** Live news feeds
- **Rich Metadata:** Categories, sentiment, keywords
- **Global Coverage:** News from 150+ countries
- **Multiple Languages:** Support for 50+ languages

**Enhanced Features over NewsAPI:**
- Better categorization
- Sentiment analysis
- Keyword extraction
- Regional news filtering

**Example Implementation:**
```typescript
class NewsDataClient {
  private apiKey: string;
  private baseURL = 'https://newsdata.io/api/1';

  async getLatestNews(options: {
    country?: string;
    category?: string;
    language?: string;
    size?: number;
  } = {}) {
    const params = new URLSearchParams({
      apikey: this.apiKey,
      ...options,
      size: (options.size || 10).toString(),
    });

    const response = await fetch(`${this.baseURL}/news?${params}`);
    const data = await response.json();

    return data.results.map(this.transformArticle);
  }

  private transformArticle(article: any): Article {
    return {
      id: article.article_id,
      title: article.title,
      description: article.description,
      content: article.content || article.description,
      url: article.link,
      urlToImage: article.image_url,
      publishedAt: new Date(article.pubDate),
      source: {
        id: article.source_id,
        name: article.source_name,
        url: article.source_url,
        icon: article.source_icon,
      },
      author: article.creator?.[0],
      category: article.category?.[0] || 'general',
      language: article.language,
      country: article.country?.[0],
      keywords: article.keywords || [],
      sentiment: article.sentiment,
      aiTag: article.ai_tag,
      videoUrl: article.video_url,
    };
  }
}
```

### Firecrawl
**What it is:** A web scraping API that converts websites into clean, structured data suitable for AI processing.

**Key Features:**
- **Clean Output:** Removes ads, navigation, footers
- **Multiple Formats:** HTML, Markdown, structured data
- **JavaScript Rendering:** Handles dynamic content
- **Rate Limiting:** Built-in request throttling

**Use Cases:**
- Scraping news websites not covered by APIs
- Extracting content from social media
- Getting full article text when APIs provide only summaries

**Example Implementation:**
```typescript
class FirecrawlClient {
  private apiKey: string;
  private baseURL = 'https://api.firecrawl.dev/v0';

  async scrapeUrl(url: string, options: {
    includeMarkdown?: boolean;
    onlyMainContent?: boolean;
    timeout?: number;
  } = {}) {
    const response = await fetch(`${this.baseURL}/scrape`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        pageOptions: {
          onlyMainContent: options.onlyMainContent ?? true,
          includeHtml: false,
          includeMarkdown: options.includeMarkdown ?? true,
        },
        timeout: options.timeout ?? 30000,
      }),
    });

    if (!response.ok) {
      throw new Error(`Firecrawl error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      content: data.data.markdown || data.data.content,
      title: data.data.metadata?.title,
      description: data.data.metadata?.description,
      publishedTime: data.data.metadata?.publishedTime,
      author: data.data.metadata?.author,
    };
  }

  async scrapeHackerNews(options: { limit?: number } = {}) {
    const hackerNewsUrl = 'https://news.ycombinator.com';
    const scrapedData = await this.scrapeUrl(hackerNewsUrl);
    
    // Parse Hacker News format and extract articles
    return this.parseHackerNewsContent(scrapedData.content, options.limit);
  }
}
```

### Puppeteer
**What it is:** A Node.js library that provides a high-level API to control Chrome/Chromium browsers programmatically.

**Key Features:**
- **Headless Browsing:** Run Chrome without GUI
- **JavaScript Execution:** Handle dynamic content
- **Screenshot Capture:** Generate page images
- **PDF Generation:** Convert pages to PDF

**Use Cases in SmartKhabar:**
- Scraping JavaScript-heavy news sites
- Taking screenshots of articles
- Handling sites that block API access
- Extracting content from SPAs

**Example Implementation:**
```typescript
import puppeteer from 'puppeteer';

class PuppeteerScraper {
  private browser: puppeteer.Browser | null = null;

  async initialize() {
    this.browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }

  async scrapeArticle(url: string): Promise<ScrapedArticle> {
    if (!this.browser) await this.initialize();
    
    const page = await this.browser!.newPage();
    
    try {
      // Set user agent to avoid blocking
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      
      // Navigate to page
      await page.goto(url, { waitUntil: 'networkidle2' });
      
      // Extract article content
      const articleData = await page.evaluate(() => {
        // Look for common article selectors
        const titleSelectors = ['h1', '.article-title', '.headline', '[data-testid="headline"]'];
        const contentSelectors = ['.article-content', '.post-content', 'article', '.story-body'];
        
        let title = '';
        for (const selector of titleSelectors) {
          const element = document.querySelector(selector);
          if (element?.textContent?.trim()) {
            title = element.textContent.trim();
            break;
          }
        }
        
        let content = '';
        for (const selector of contentSelectors) {
          const element = document.querySelector(selector);
          if (element?.textContent?.trim()) {
            content = element.textContent.trim();
            break;
          }
        }
        
        return { title, content };
      });
      
      return {
        url,
        title: articleData.title,
        content: articleData.content,
        scrapedAt: new Date(),
      };
      
    } finally {
      await page.close();
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
```

---

## Architecture Patterns

### Serverless Architecture
**What it is:** A cloud computing execution model where the cloud provider dynamically manages the allocation and provisioning of servers.

**Key Characteristics:**
- **Event-Driven:** Functions triggered by events
- **Stateless:** No persistent state between invocations
- **Auto-Scaling:** Automatic scaling based on demand
- **Pay-per-Use:** Billing based on actual usage

**Benefits:**
- Reduced operational overhead
- Automatic scaling
- Cost efficiency for variable workloads
- High availability

**Challenges:**
- Cold start latency
- Vendor lock-in
- Limited execution time
- Debugging complexity

### Microservices Pattern
**What it is:** An architectural approach that structures an application as a collection of loosely coupled, independently deployable services.

**Characteristics:**
- **Single Responsibility:** Each service has one business capability
- **Independent Deployment:** Services can be deployed separately
- **Technology Diversity:** Different services can use different technologies
- **Decentralized:** No central coordination

**Example Structure:**
```
SmartKhabar Microservices:
├── User Service          # User management and preferences
├── News Collection Service   # Article gathering and processing
├── AI/ML Service        # Summarization and personalization
├── Search Service       # Semantic search functionality
├── Notification Service # Real-time updates
└── Analytics Service    # User behavior tracking
```

### Event-Driven Architecture
**What it is:** A software architecture pattern where components communicate through the production and consumption of events.

**Key Components:**
- **Event Producers:** Generate events
- **Event Consumers:** React to events
- **Event Bus:** Routes events between components
- **Event Store:** Persists events for replay

**Example Implementation:**
```typescript
interface Event {
  id: string;
  type: string;
  timestamp: Date;
  data: any;
}

class EventBus {
  private subscribers = new Map<string, Array<(event: Event) => void>>();

  subscribe(eventType: string, handler: (event: Event) => void) {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, []);
    }
    this.subscribers.get(eventType)!.push(handler);
  }

  async publish(event: Event) {
    const handlers = this.subscribers.get(event.type) || [];
    await Promise.all(handlers.map(handler => handler(event)));
  }
}

// Usage
const eventBus = new EventBus();

// Subscribe to events
eventBus.subscribe('article.collected', async (event) => {
  await processNewArticle(event.data.article);
});

eventBus.subscribe('user.preferences.updated', async (event) => {
  await refreshUserRecommendations(event.data.userId);
});

// Publish events
await eventBus.publish({
  id: generateId(),
  type: 'article.collected',
  timestamp: new Date(),
  data: { article: newArticle }
});
```

---

## Development & Deployment Tools

### Vercel
**What it is:** A cloud platform for static sites and serverless functions, optimized for frontend frameworks like Next.js.

**Key Features:**
- **Zero Configuration:** Deploy with minimal setup
- **Global CDN:** Worldwide content distribution
- **Serverless Functions:** Automatic API deployment
- **Preview Deployments:** Branch-based previews
- **Analytics:** Performance and usage insights

**Deployment Process:**
1. Connect Git repository
2. Automatic builds on push
3. Deploy to global edge network
4. Custom domains and SSL

**Configuration Example:**
```json
// vercel.json
{
  "functions": {
    "app/api/**/*.ts": {
      "maxDuration": 30
    }
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Origin", "value": "*" },
        { "key": "Access-Control-Allow-Methods", "value": "GET, POST, PUT, DELETE" }
      ]
    }
  ],
  "crons": [
    {
      "path": "/api/cron/collect-news",
      "schedule": "0 */2 * * *"
    }
  ]
}
```

### Cron Jobs
**What it is:** Time-based job scheduler that runs tasks at specified intervals.

**Common Patterns:**
- `0 */2 * * *` - Every 2 hours
- `0 0 * * *` - Daily at midnight
- `0 0 * * 0` - Weekly on Sunday
- `0 0 1 * *` - Monthly on 1st day

**Implementation in Vercel:**
```typescript
// app/api/cron/collect-news/route.ts
export async function GET(request: Request) {
  // Verify cron secret for security
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const newsCollector = new NewsCollector();
    const result = await newsCollector.collectFreshArticles();
    
    console.log(`Collected ${result.articles.length} articles`);
    
    return Response.json({
      success: true,
      articlesCollected: result.articles.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Cron job failed:', error);
    return Response.json(
      { error: 'Collection failed' },
      { status: 500 }
    );
  }
}
```

This comprehensive explanation covers all the technical terms and technologies used in the SmartKhabar architecture, providing both theoretical understanding and practical implementation examples for each component.