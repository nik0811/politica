# Politica - Social Media Intelligence Platform

A comprehensive platform for collecting, analyzing, and managing social media data across multiple platforms (Twitter/X, Facebook, Instagram) with AI-powered insights and sentiment analysis.

## 🎯 Features

### Data Collection
- **Multi-Platform Support**: Twitter/X, Facebook, Instagram
- **Chrome Extension**: Easy-to-use extension for collecting posts, comments, and engagement metrics
- **Deep Scraping**: Comprehensive data extraction including replies, author information, and engagement counts
- **Automatic Processing**: Background jobs for continuous data collection and analysis

### AI Analysis
- **Sentiment Analysis**: Automatic sentiment classification (positive, neutral, negative)
- **Topic Extraction**: Identify key topics and themes in collected data
- **Entity Recognition**: Extract named entities (people, places, organizations)
- **Promise Extraction**: Identify commitments and promises in text
- **Research Assistant**: AI-powered search and analysis of collected data

### Dashboard & Analytics
- **Intelligence Dashboard**: Real-time overview of collected data and sentiment trends
- **Analytics Page**: Detailed engagement metrics, trending topics, and commenters
- **Documents Management**: Browse, filter, and analyze individual posts
- **Media Gallery**: View and manage collected media files
- **Sentiment Tracking**: Monitor sentiment trends over time

## 📋 Project Structure

```
politica/
├── services/
│   ├── api/                    # FastAPI backend
│   │   ├── routers/           # API endpoints
│   │   ├── services/          # Business logic
│   │   ├── models/            # Database models
│   │   └── config.py          # Configuration
│   └── extension/             # Chrome extension
│       ├── content/           # Content scripts (Twitter, Facebook, Instagram)
│       ├── popup/             # Extension popup UI
│       ├── background/        # Service worker
│       └── manifest.json      # Extension manifest
├── politica-admin-portal/     # Next.js frontend
│   ├── app/
│   │   ├── admin/            # Admin dashboard pages
│   │   ├── login/            # Authentication
│   │   └── layout.tsx        # Root layout
│   ├── components/           # Reusable UI components
│   ├── lib/                  # Utilities and API client
│   └── public/               # Static assets
└── docker-compose.yml        # Docker configuration
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.9+
- PostgreSQL 14+
- Docker & Docker Compose (optional)

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd politica
```

2. **Backend Setup**
```bash
cd services/api
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

3. **Frontend Setup**
```bash
cd politica-admin-portal
npm install
```

4. **Environment Configuration**
```bash
# Backend
cd services/api
cp .env.example .env
# Edit .env with your configuration

# Frontend
cd politica-admin-portal
cp .env.example .env.local
# Edit .env.local with your API URL
```

### Running the Application

**Option 1: Docker Compose (Recommended)**
```bash
docker-compose up -d
```

**Option 2: Manual Setup**

Terminal 1 - Backend:
```bash
cd services/api
source venv/bin/activate
python -m uvicorn main:app --reload --port 8000
```

Terminal 2 - Frontend:
```bash
cd politica-admin-portal
npm run dev
```

Access the application at `http://localhost:3000`

## 🔌 Chrome Extension Setup

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select `services/extension` folder
5. Configure the extension:
   - Click the Politica extension icon
   - Go to Settings
   - Enter your API URL and token
   - Click "Test Connection"

## 📚 API Documentation

### Authentication
All API requests require a Bearer token in the Authorization header:
```
Authorization: Bearer <your-api-token>
```

### Main Endpoints

**Documents**
- `GET /api/documents` - List documents with pagination
- `POST /api/documents` - Create a new document
- `GET /api/documents/{id}` - Get document details
- `DELETE /api/documents/{id}` - Delete a document

**Ingestion**
- `POST /api/ingest/twitter` - Ingest Twitter data
- `POST /api/ingest/facebook` - Ingest Facebook data
- `POST /api/ingest/instagram` - Ingest Instagram data

**Analytics**
- `GET /api/analytics/engagement` - Get engagement statistics
- `GET /api/analytics/trends` - Get trend data
- `GET /api/analytics/weekly-trends` - Get weekly trends

**AI Processing**
- `GET /api/jobs` - List processing jobs
- `POST /api/jobs` - Create a new job
- `GET /api/jobs/{id}` - Get job details

## 🔐 Security

- **Environment Variables**: Sensitive data stored in `.env` files (never committed)
- **API Tokens**: Required for all API requests
- **CORS**: Configured for frontend domain only
- **Database**: PostgreSQL with encrypted sensitive fields
- **Extension**: Content scripts isolated from page context

## 🧪 Testing

### Backend Tests
```bash
cd services/api
pytest
```

### Frontend Tests
```bash
cd politica-admin-portal
npm test
```

## 📊 Database Schema

### Core Tables
- **documents** - Collected posts/content
- **comments** - Comments on documents
- **users** - User accounts and API tokens
- **collection_targets** - Social media accounts to monitor
- **jobs** - Background processing jobs
- **topics** - Extracted topics from documents
- **entities** - Named entities extracted from text

## 🔄 Data Flow

1. **Collection**: Chrome extension scrapes social media
2. **Ingestion**: Data sent to backend API
3. **Storage**: Data stored in PostgreSQL
4. **Processing**: AI agents analyze content
5. **Analysis**: Sentiment, topics, entities extracted
6. **Display**: Results shown in dashboard

## 🛠️ Configuration

### Backend (.env)
```
DATABASE_URL=postgresql://user:password@localhost/politica
API_PORT=8000
CORS_ORIGINS=http://localhost:3000
LLM_PROVIDER=openai
LLM_MODEL=gpt-4
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## 📝 Development Guidelines

### Code Quality Standards
- **Minimal Code**: Fix only what's broken
- **End-to-End Testing**: Test from frontend to backend
- **No Duplication**: Extract common patterns
- **Clear Syntax**: Readable code over clever tricks

### Commit Messages
- Use clear, descriptive messages
- Reference issues when applicable
- Follow conventional commits format

### File Organization
- Keep files small and focused
- One responsibility per file
- Group related functionality

## 🐛 Troubleshooting

### Extension Not Collecting Data
1. Check API token is valid
2. Verify API URL is correct
3. Check browser console for errors
4. Ensure extension has proper permissions

### API Connection Errors
1. Verify backend is running
2. Check database connection
3. Review API logs for errors
4. Ensure CORS is properly configured

### Sentiment Analysis Not Working
1. Check LLM provider configuration
2. Verify API keys are set
3. Ensure documents are processed
4. Check job status in admin panel

## 📞 Support

For issues and questions:
1. Check existing issues on GitHub
2. Review API documentation
3. Check backend logs: `services/api/logs/`
4. Check frontend console: Browser DevTools

## 📄 License

This project is proprietary and confidential.

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Write tests
4. Submit a pull request
5. Ensure CI/CD passes

## 📈 Roadmap

- [ ] Real-time data streaming
- [ ] Advanced filtering and search
- [ ] Custom report generation
- [ ] API rate limiting
- [ ] Multi-language support
- [ ] Mobile app
- [ ] Webhook integrations

---

**Last Updated**: June 2026
**Version**: 1.0.0
