# Politica Backend - Implementation Progress

## ✅ Phase 1 Complete: Core Infrastructure

### What We Built

1. **Project Structure**
   - Complete backend directory organization
   - Git repository initialized
   - Proper `.gitignore` and documentation

2. **Docker Compose Setup**
   - PostgreSQL 15 (main database)
   - Redis 7 (caching and queues)
   - MinIO (object storage for images/videos)
   - Qdrant (vector database for semantic search)
   - Elasticsearch 8 (full-text search)
   - Selenium with VNC (headed browser for admin viewing)
   - Service health checks and dependencies

3. **FastAPI Backend** (`services/api/`)
   - Main application with CORS and lifecycle management
   - Database connection with SQLAlchemy
   - Complete API routers:
     - `/api/documents` - Document CRUD operations
     - `/api/topics` - Topic management
     - `/api/promises` - Promise tracking
     - `/api/entities` - Entity management
     - `/api/search` - Search functionality
     - `/api/analytics` - Trends and sentiment
     - `/api/collector` - Browser session management
   - WebSocket support for real-time updates
   - Health check endpoints

4. **Database Models**
   - Document, Topic, Promise, Entity, BrowserSession
   - Proper relationships and indexes
   - Enum types for consistency

5. **Shared Models** (`shared/models/`)
   - Pydantic schemas for validation
   - Consistent data types across services
   - Ready for TypeScript client generation

## 🚀 How to Start the Backend

### Prerequisites
```bash
# Install Docker Desktop
# Ensure ports 3000, 4444, 5432, 5900, 6333, 6379, 8000, 9000, 9001, 9200, 7900 are free
```

### Quick Start
```bash
cd /Users/apple/Documents/politica

# Start all services
docker-compose up -d

# Check service health
docker-compose ps

# View logs
docker-compose logs -f api

# Access services:
# - API: http://localhost:8000
# - API Docs: http://localhost:8000/docs
# - PostgreSQL: localhost:5432
# - Redis: localhost:6379
# - MinIO Console: http://localhost:9001
# - Elasticsearch: http://localhost:9200
# - Qdrant: http://localhost:6333
# - VNC Browser View: http://localhost:7900 (for headed mode)
```

### Test the API
```bash
# Health check
curl http://localhost:8000/health

# Get system stats
curl http://localhost:8000/api/stats

# Search documents
curl "http://localhost:8000/api/search?q=healthcare"

# Get topics
curl http://localhost:8000/api/topics
```

## 📋 Next Steps (Phase 2: Browser Collection)

### Priority 1: Browser Collector Service (Node.js + Playwright)

```
services/collector/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                    # Main entry point
│   ├── core/
│   │   ├── BrowserManager.ts       # Orchestrates headless/headed
│   │   ├── HeadlessBrowserPool.ts  # Production scraping
│   │   ├── HeadedBrowserManager.ts # Admin viewing with VNC
│   │   └── BrowserStreamingService.ts # WebSocket streaming
│   ├── collectors/
│   │   ├── BaseCollector.ts        # Abstract collector
│   │   ├── InstagramCollector.ts   # Instagram scraping
│   │   ├── XCollector.ts           # X/Twitter scraping
│   │   └── TelegramCollector.ts    # Telegram scraping
│   ├── monitoring/
│   │   ├── IssueDetector.ts        # Detect bot detection, missing content
│   │   └── DataValidator.ts        # Validate scraped data quality
│   ├── scheduler/
│   │   └── CollectionScheduler.ts  # Priority-based scheduling
│   └── storage/
│       ├── CheckpointStore.ts      # Track progress
│       └── SessionStore.ts         # Active sessions
```

### Technologies Needed:
- Node.js 18+ with TypeScript
- Playwright (headless automation)
- Playwright Stealth Plugin
- Redis client for queues
- PostgreSQL client
- MinIO client

### Key Features to Implement:
1. **Headless Browser Pool** (default mode)
   - Multiple concurrent instances
   - Stealth plugins to avoid detection
   - Automatic retry on failure

2. **Issue Detection**
   - Bot detection (Cloudflare, reCAPTCHA)
   - Missing content detection
   - JavaScript errors
   - Data quality validation

3. **Automatic Mode Switching**
   - Switch to headed mode when issues detected
   - Notify admin via WebSocket
   - Stream browser view to admin portal

4. **Instagram Collector** (first platform)
   - Login handling
   - Scroll to load more posts
   - Expand "Read more" text
   - Expand comment threads
   - Screenshot capture
   - Save to MinIO

## 🔌 Connect Frontend to Backend

### Update Frontend API Client

Create `politica-admin-portal/lib/api-client.ts`:
```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'

export async function fetchDocuments(skip = 0, limit = 20) {
  const res = await fetch(`${API_BASE}/documents?skip=${skip}&limit=${limit}`)
  return res.json()
}

export async function fetchTopics() {
  const res = await fetch(`${API_BASE}/topics`)
  return res.json()
}

export async function fetchPromises() {
  const res = await fetch(`${API_BASE}/promises`)
  return res.json()
}

export async function fetchSystemStats() {
  const res = await fetch(`${API_BASE}/stats`)
  return res.json()
}

export async function searchDocuments(query: string) {
  const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`)
  return res.json()
}
```

### Replace Mock Data
Update dashboard pages to use real API instead of `lib/mock-data.ts`

## 📊 Current Status

### Completed ✅
- [x] Project structure
- [x] Docker Compose setup
- [x] Shared data models
- [x] FastAPI backend with all routers
- [x] Database models
- [x] Health check endpoints
- [x] WebSocket infrastructure
- [x] Git repository

### In Progress 🚧
- [ ] Browser collector service (Node.js)
- [ ] Instagram collector implementation
- [ ] Frontend-backend integration

### Upcoming 📅
- [ ] OCR engine (PaddleOCR)
- [ ] Language detection
- [ ] Embeddings (BGE-M3)
- [ ] Topic classification
- [ ] Entity extraction
- [ ] Promise extraction
- [ ] Sentiment analysis

## 🔧 Development Commands

```bash
# Backend API development
cd services/api
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Frontend development
cd politica-admin-portal
pnpm install
pnpm dev

# Docker operations
docker-compose up -d              # Start all services
docker-compose down               # Stop all services
docker-compose logs -f <service>  # View logs
docker-compose restart <service>  # Restart a service
docker-compose exec api bash      # Access API container shell

# Database operations
docker-compose exec postgres psql -U politica -d politica  # PostgreSQL CLI
docker-compose exec redis redis-cli                         # Redis CLI
```

## 📁 File Structure

```
politica/
├── docker-compose.yml           # ✅ All services configured
├── .env                         # ✅ Environment variables
├── README.md                    # ✅ Complete documentation
├── services/
│   ├── api/                     # ✅ FastAPI backend
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── models/              # SQLAlchemy models
│   │   └── routers/             # API endpoints
│   ├── collector/               # 🚧 TODO: Browser automation
│   ├── processor/               # 📅 TODO: OCR & NLP
│   └── agents/                  # 📅 TODO: LLM agents
├── shared/
│   └── models/                  # ✅ Pydantic schemas
├── politica-admin-portal/       # ✅ Next.js frontend
└── infrastructure/
    └── docker/
        └── postgres/init.sql    # ✅ Database initialization
```

## 🎯 Immediate Next Action

**Start building the Browser Collector Service:**

1. Initialize Node.js project
2. Install Playwright and dependencies
3. Create BrowserManager for mode switching
4. Implement InstagramCollector
5. Connect to PostgreSQL and Redis
6. Test with a real Instagram page

Would you like me to start building the collector service now?
