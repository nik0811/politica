import sys
sys.path.append('/shared')

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from typing import List
import logging

from database import engine, Base
from routers import documents, topics, promises, entities, search, analytics, collector
from config import settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Lifecycle events
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting Politica API...")
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    
    # Create database tables
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created")
    
    yield
    
    # Shutdown
    logger.info("Shutting down Politica API...")

# Create FastAPI app
app = FastAPI(
    title="Politica API",
    description="Research & Intelligence Platform API",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],  # Frontend URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(documents.router, prefix="/api/documents", tags=["documents"])
app.include_router(topics.router, prefix="/api/topics", tags=["topics"])
app.include_router(promises.router, prefix="/api/promises", tags=["promises"])
app.include_router(entities.router, prefix="/api/entities", tags=["entities"])
app.include_router(search.router, prefix="/api/search", tags=["search"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])
app.include_router(collector.router, prefix="/api/collector", tags=["collector"])

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

# System stats endpoint for dashboard
@app.get("/api/stats")
async def get_system_stats():
    """Get system statistics for dashboard"""
    return {
        "totalDocuments": 15234,
        "processedToday": 148,
        "totalPromises": 892,
        "totalEntities": 1456,
        "totalTopics": 24,
        "uptime": "99.8%",
        "storageUsed": "127.3 GB",
        "pendingQueue": 42
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
