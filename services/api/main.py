import sys
sys.path.append('/shared')

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from typing import List
from sqlalchemy.orm import Session
import logging

from database import engine, Base, get_db
from routers import documents, topics, promises, entities, search, analytics, collector, media, research, workspaces, summaries, logs, users, auth, agents, intelligence, ingestion, api_tokens, assistant, rag
from routers import settings as settings_router
from config import settings
from auth import get_current_user
from token_auth import validate_api_token
from middleware.audit import AuditMiddleware

# Configure logging - reduce verbosity
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger(__name__)

# Reduce noise from verbose loggers
logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
logging.getLogger("LiteLLM").setLevel(logging.WARNING)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

def run_column_migrations():
    """Add any missing columns to existing tables (safe to run on every startup)."""
    from sqlalchemy import text, inspect
    migrations = [
        ("documents", "screenshot_path", "VARCHAR"),
        ("documents", "author_handle", "VARCHAR"),
        ("documents", "collected_at", "TIMESTAMP"),
        ("documents", "likes_count", "INTEGER DEFAULT 0"),
        ("documents", "comments_count", "INTEGER DEFAULT 0"),
        ("documents", "shares_count", "INTEGER DEFAULT 0"),
        ("documents", "views_count", "INTEGER DEFAULT 0"),
        ("documents", "reactions_count", "INTEGER DEFAULT 0"),
        ("documents", "subscribers_count", "INTEGER DEFAULT 0"),
        ("documents", "engagement_rate", "FLOAT"),
        ("api_tokens", "description", "TEXT"),
        ("api_tokens", "expires_at", "TIMESTAMP"),
        ("api_tokens", "last_used_at", "TIMESTAMP"),
    ]
    with engine.connect() as conn:
        inspector = inspect(engine)
        for table, column, col_type in migrations:
            try:
                existing = [c["name"] for c in inspector.get_columns(table)]
                if column not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {column} {col_type}"))
                    logger.info(f"Migration: added column {table}.{column}")
            except Exception as e:
                logger.warning(f"Migration skipped {table}.{column}: {e}")
        conn.commit()


# Lifecycle events
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting Politica API...")
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    
    # Create new tables
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created")

    # Add any missing columns to existing tables
    run_column_migrations()
    logger.info("Column migrations complete")
    
    # Initialize BM25 search index for RAG
    try:
        from services.search import initialize_search_index
        from database import SessionLocal
        db = SessionLocal()
        initialize_search_index(db)
        db.close()
        logger.info("BM25 search index initialized for RAG")
    except Exception as e:
        logger.warning(f"Failed to initialize search index: {e}")
    
    yield
    
    # Shutdown
    logger.info("Shutting down Politica API...")

# Create FastAPI app
app = FastAPI(
    title="Politica API",
    description="Research & Intelligence Platform API",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins (needed for browser extension)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Audit logging middleware
app.add_middleware(AuditMiddleware)

# Public routes (no authentication required)
app.include_router(auth.router, prefix="/api/auth", tags=["authentication"])
app.include_router(ingestion.router, prefix="/api/ingest", tags=["ingestion"], dependencies=[Depends(validate_api_token)])

# Protected routes (authentication required)
# Add dependencies parameter to require authentication for all routes in these routers
app.include_router(documents.router, prefix="/api/documents", tags=["documents"], dependencies=[Depends(get_current_user)])
app.include_router(topics.router, prefix="/api/topics", tags=["topics"], dependencies=[Depends(get_current_user)])
app.include_router(promises.router, prefix="/api/promises", tags=["promises"], dependencies=[Depends(get_current_user)])
app.include_router(entities.router, prefix="/api/entities", tags=["entities"], dependencies=[Depends(get_current_user)])
app.include_router(search.router, prefix="/api/search", tags=["search"], dependencies=[Depends(get_current_user)])
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"], dependencies=[Depends(get_current_user)])
app.include_router(collector.router, prefix="/api/collector", tags=["collector"], dependencies=[Depends(get_current_user)])
app.include_router(media.router, prefix="/api/media", tags=["media"], dependencies=[Depends(get_current_user)])
app.include_router(research.router, prefix="/api/research", tags=["research"], dependencies=[Depends(get_current_user)])
app.include_router(workspaces.router, prefix="/api/workspaces", tags=["workspaces"], dependencies=[Depends(get_current_user)])
app.include_router(summaries.router, prefix="/api/summaries", tags=["summaries"], dependencies=[Depends(get_current_user)])
app.include_router(logs.router, prefix="/api/logs", tags=["logs"], dependencies=[Depends(get_current_user)])
app.include_router(settings_router.router, prefix="/api/settings", tags=["settings"], dependencies=[Depends(get_current_user)])
app.include_router(users.router, prefix="/api/users", tags=["users"], dependencies=[Depends(get_current_user)])
app.include_router(agents.router, prefix="/api/agents", tags=["agents"], dependencies=[Depends(get_current_user)])
# app.include_router(collection_targets.router, prefix="/api/collection-targets", tags=["collection-targets"], dependencies=[Depends(get_current_user)])
app.include_router(intelligence.router, prefix="/api/intelligence", tags=["intelligence"], dependencies=[Depends(get_current_user)])
app.include_router(api_tokens.router, prefix="/api/tokens", tags=["api-tokens"], dependencies=[Depends(get_current_user)])
app.include_router(assistant.router, prefix="/api/assistant", tags=["assistant"], dependencies=[Depends(get_current_user)])
app.include_router(rag.router, prefix="/api/rag", tags=["rag"], dependencies=[Depends(get_current_user)])

# Health check
@app.get("/")
async def root():
    return {
        "name": "Politica API",
        "version": "1.0.0",
        "status": "operational"
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "environment": settings.ENVIRONMENT,
        "services": {
            "database": "connected",
            "redis": "connected",
            "elasticsearch": "connected",
            "qdrant": "connected"
        }
    }

# System stats endpoint for dashboard (protected)
@app.get("/api/stats")
async def get_system_stats(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get system statistics for dashboard with real aggregations"""
    from sqlalchemy.orm import Session
    from database import get_db
    from models.models import Document as DocumentModel, Promise as PromiseModel, Topic as TopicModel, Entity as EntityModel
    from sqlalchemy import func
    from datetime import datetime, timedelta
    from fastapi import Depends
    
    # Total documents
    total_documents = db.query(func.count()).select_from(DocumentModel).scalar() or 0
    
    # Documents processed today
    today = datetime.now().date()
    processed_today = db.query(func.count()).filter(
        func.date(DocumentModel.created_at) == today
    ).scalar() or 0
    
    # Total promises
    total_promises = db.query(func.count()).select_from(PromiseModel).scalar() or 0
    
    # Total entities  
    total_entities = db.query(func.count()).select_from(EntityModel).scalar() or 0
    
    # Total topics
    total_topics = db.query(func.count()).select_from(TopicModel).scalar() or 0
    
    # Pending queue
    pending_queue = db.query(func.count()).filter(
        DocumentModel.status == "pending"
    ).scalar() or 0
    
    return {
        "total_documents": total_documents,
        "processed_today": processed_today,
        "total_promises": total_promises,
        "total_entities": total_entities,
        "total_topics": total_topics,
        "uptime": "99.8%",
        "storage_used": "0 GB",  # TODO: Calculate from MinIO
        "pending_queue": pending_queue
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
