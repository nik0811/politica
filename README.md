# Politica - Research & Intelligence Platform

A comprehensive multilingual platform for analyzing public political discourse through automated data collection, AI-powered processing, and intelligent insights.

## Architecture

```
politica/
├── services/
│   ├── collector/          # Node.js browser automation (headless + headed)
│   ├── processor/          # Python OCR, NLP, embeddings
│   ├── agents/             # Python LLM agents
│   └── api/                # FastAPI backend
├── politica-admin-portal/  # Next.js admin dashboard
├── shared/                 # Shared models and utilities
├── infrastructure/         # Docker configs and workflows
└── docker-compose.yml      # Local orchestration
```

## Features

### Data Collection
- **Hybrid Browser Automation**: Headless (efficient) + Headed (debuggable with VNC)
- **Multi-Platform**: Instagram, X/Twitter, Telegram, News sites
- **Intelligent Mode Switching**: Auto-fallback to headed mode on issues
- **Live Monitoring**: Admin can watch browser sessions in real-time

### Intelligence Layer
- **Multilingual OCR**: PaddleOCR for 12+ Indian languages
- **Semantic Search**: BGE-M3 embeddings + Qdrant vector DB
- **Topic Classification**: Hierarchical taxonomy (Education, Healthcare, etc.)
- **Entity Extraction**: People, places, organizations, policies
- **Promise Tracking**: LLM-based extraction of political commitments
- **Sentiment Analysis**: Multilingual sentiment + emotion detection

### Campaign Intelligence
- **Message Effectiveness**: Sentiment-driven performance analysis
- **Audience Segmentation**: Geographic and demographic insights
- **Trend Detection**: Momentum tracking and emerging issues
- **A/B Testing**: Retrospective message comparison

### Advanced Features
- **Knowledge Graph**: Relationships between entities, topics, documents
- **Research Assistant**: RAG-based conversational interface
- **Automated Reports**: Daily/weekly summaries and insights
- **Geographic Analysis**: State/district-level trend visualization

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for frontend dev)
- Python 3.11+ (for local dev)

### Installation

1. Clone and setup:
```bash
git clone <repo-url>
cd politica
cp .env.example .env
# Edit .env with your configuration
```

2. Start all services:
```bash
docker-compose up -d
```

3. Initialize database:
```bash
docker-compose exec api alembic upgrade head
```

4. Access services:
- **Admin Portal**: http://localhost:3000
- **API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **MinIO Console**: http://localhost:9001
- **Elasticsearch**: http://localhost:9200
- **Qdrant**: http://localhost:6333
- **VNC Browser View**: http://localhost:7900 (password: secret)

### Development

Frontend (admin portal):
```bash
cd politica-admin-portal
pnpm install
pnpm dev
```

Backend API:
```bash
cd services/api
pip install -r requirements.txt
uvicorn main:app --reload
```

Browser Collector:
```bash
cd services/collector
npm install
npm run dev
```

## Services

### Browser Collector (Node.js + Playwright)
- **Headless Pool**: 3+ concurrent instances for production scraping
- **Headed Instance**: Single Selenium+VNC for admin monitoring
- **Issue Detection**: Automatic quality checks and mode switching
- **Platforms**: Instagram, X, Telegram, News sites

### Processor (Python)
- **OCR Engine**: PaddleOCR multilingual text extraction
- **Language Detection**: FastText for 12+ languages
- **Embeddings**: BGE-M3 vector generation
- **Topic Classifier**: XLM-RoBERTa fine-tuned model
- **Entity Extractor**: GLiNER + gazetteer matching

### AI Agents (Python)
- **Promise Extractor**: GLM/Qwen structured extraction
- **Summarizer**: Daily/weekly content summaries
- **Trend Analyzer**: Momentum and sentiment tracking
- **Research Agent**: Conversational RAG assistant

### API (FastAPI)
- REST endpoints for all frontend features
- WebSocket for real-time browser monitoring
- Authentication & RBAC
- Rate limiting and caching

## Database Schema

- **PostgreSQL**: Structured data (documents, entities, promises, users)
- **MinIO**: Object storage (images, screenshots, PDFs)
- **Qdrant**: Vector embeddings for semantic search
- **Elasticsearch**: Full-text search index
- **Redis**: Caching, queues, session storage

## Technology Stack

### Backend
- **Python**: FastAPI, SQLAlchemy, Alembic, Pydantic
- **Node.js**: TypeScript, Playwright, Express
- **AI/ML**: Transformers, PaddleOCR, BGE-M3, GLM, Qwen
- **Databases**: PostgreSQL, Redis, Qdrant, Elasticsearch, MinIO

### Frontend
- **Next.js 16**: App Router, Server Components
- **React 19**: UI framework
- **TailwindCSS**: Styling
- **Recharts**: Data visualization
- **shadcn/ui**: Component library

### Infrastructure
- **Docker**: Containerization
- **Docker Compose**: Local orchestration
- **Temporal**: Workflow orchestration (optional)
- **Prometheus + Grafana**: Monitoring

## Configuration

Key environment variables:

```env
# Database
POSTGRES_PASSWORD=your_password
DATABASE_URL=postgresql://politica:password@postgres:5432/politica

# Object Storage
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin

# AI Models
OPENAI_API_KEY=your_key
ANTHROPIC_API_KEY=your_key

# Security
JWT_SECRET=your_jwt_secret
API_SECRET_KEY=your_api_secret
```

## Monitoring

- **Browser Sessions**: Real-time view at Admin Portal → Browser Monitoring
- **API Metrics**: http://localhost:8000/metrics
- **System Status**: Dashboard → System Status card
- **Logs**: `docker-compose logs -f <service>`

## Development Workflow

1. **Start databases**: `docker-compose up -d postgres redis minio qdrant elasticsearch`
2. **Run API locally**: `cd services/api && uvicorn main:app --reload`
3. **Run frontend**: `cd politica-admin-portal && pnpm dev`
4. **Test collector**: `cd services/collector && npm run dev`

## Production Deployment

(Coming soon: Kubernetes deployment guide)

## Security

- HTTPS/TLS for all external traffic
- JWT-based authentication
- Role-based access control (RBAC)
- Encrypted sensitive fields in database
- Comprehensive audit logging
- Data provenance tracking

## License

(Add your license here)

## Contributing

(Add contribution guidelines)

## Support

(Add support channels)
