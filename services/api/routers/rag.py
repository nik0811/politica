"""
RAG (Retrieval-Augmented Generation) API endpoints.

Provides search and retrieval capabilities for grounding AI responses in actual data.
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from database import get_db
from services.retrieval import (
    search_documents_bm25,
    get_context_for_analysis,
    format_context_for_prompt,
    get_source_citations,
    rebuild_bm25_index,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ─── Schemas ───

class DocumentResult(BaseModel):
    id: str
    title: str
    content: str
    platform: str
    author: Optional[str]
    author_handle: Optional[str]
    published_at: Optional[datetime]
    collected_at: Optional[datetime]
    sentiment: Optional[float]
    topics: Optional[List[str]]
    entities: Optional[List[dict]]
    engagement_rate: Optional[float]
    likes_count: int
    comments_count: int
    shares_count: int
    views_count: int
    url: Optional[str]
    relevance_score: float


class SourceCitation(BaseModel):
    id: str
    title: str
    author: Optional[str]
    platform: str
    url: Optional[str]
    published_at: Optional[datetime]
    relevance_score: float


class SearchResponse(BaseModel):
    query: str
    results: List[DocumentResult]
    total: int
    search_engine: str = "bm25"
    execution_time_ms: float


class ContextResponse(BaseModel):
    documents: List[DocumentResult]
    promises: List[dict]
    entities: List[dict]
    summary: str
    formatted_context: str


class RebuildIndexResponse(BaseModel):
    success: bool
    message: str
    documents_indexed: int


# ─── Endpoints ───

@router.get("/search", response_model=SearchResponse)
async def search_rag(
    q: str = Query(..., description="Search query"),
    top_k: int = Query(10, ge=1, le=50, description="Number of results"),
    min_score: float = Query(0.0, ge=0.0, description="Minimum relevance score"),
    platform: Optional[str] = Query(None, description="Filter by platform"),
    sentiment_min: Optional[float] = Query(None, description="Minimum sentiment"),
    sentiment_max: Optional[float] = Query(None, description="Maximum sentiment"),
    topics: Optional[str] = Query(None, description="Comma-separated topics to filter"),
    db: Session = Depends(get_db),
):
    """
    Search documents using BM25 ranking with optional filters.
    
    Returns top-K most relevant documents with relevance scores.
    """
    import time
    start_time = time.time()
    
    try:
        # Parse topics filter
        topics_list = None
        if topics:
            topics_list = [t.strip() for t in topics.split(",")]
        
        # Search
        results = search_documents_bm25(
            query=q,
            db=db,
            top_k=top_k,
            min_score=min_score,
            platform=platform,
            sentiment_min=sentiment_min,
            sentiment_max=sentiment_max,
            topics=topics_list,
        )
        
        execution_time = (time.time() - start_time) * 1000
        
        return SearchResponse(
            query=q,
            results=[DocumentResult(**doc) for doc in results],
            total=len(results),
            search_engine="bm25",
            execution_time_ms=execution_time,
        )
    
    except Exception as e:
        logger.error(f"Search failed: {e}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@router.get("/context", response_model=ContextResponse)
async def get_rag_context(
    query: str = Query(..., description="Analysis query"),
    top_k: int = Query(5, ge=1, le=20, description="Number of documents"),
    include_promises: bool = Query(True, description="Include related promises"),
    include_entities: bool = Query(True, description="Include related entities"),
    db: Session = Depends(get_db),
):
    """
    Retrieve context for LLM analysis with related promises and entities.
    
    Returns formatted context ready for inclusion in prompts.
    """
    try:
        context = get_context_for_analysis(
            db=db,
            query=query,
            top_k=top_k,
            include_promises=include_promises,
            include_entities=include_entities,
        )
        
        # Format for prompt
        formatted = format_context_for_prompt(context)
        
        return ContextResponse(
            documents=[DocumentResult(**doc) for doc in context["documents"]],
            promises=context["promises"],
            entities=context["entities"],
            summary=context["summary"],
            formatted_context=formatted,
        )
    
    except Exception as e:
        logger.error(f"Context retrieval failed: {e}")
        raise HTTPException(status_code=500, detail=f"Context retrieval failed: {str(e)}")


@router.get("/citations")
async def get_citations(
    doc_ids: str = Query(..., description="Comma-separated document IDs"),
    db: Session = Depends(get_db),
):
    """
    Get source citations for a list of documents.
    
    Useful for citing sources in LLM responses.
    """
    try:
        from models.models import Document as DocumentModel
        
        ids = [id.strip() for id in doc_ids.split(",")]
        documents = db.query(DocumentModel).filter(
            DocumentModel.id.in_(ids)
        ).all()
        
        if not documents:
            raise HTTPException(status_code=404, detail="Documents not found")
        
        doc_dicts = [
            {
                "id": doc.id,
                "title": doc.title,
                "content": doc.content,
                "platform": doc.platform,
                "author": doc.author,
                "author_handle": doc.author_handle,
                "published_at": doc.published_at,
                "collected_at": doc.collected_at,
                "sentiment": doc.sentiment,
                "topics": doc.topics,
                "entities": doc.entities,
                "engagement_rate": doc.engagement_rate,
                "likes_count": doc.likes_count,
                "comments_count": doc.comments_count,
                "shares_count": doc.shares_count,
                "views_count": doc.views_count,
                "url": doc.url,
                "relevance_score": 1.0,
            }
            for doc in documents
        ]
        
        citations = get_source_citations(doc_dicts)
        
        return {
            "citations": citations,
            "total": len(citations),
        }
    
    except Exception as e:
        logger.error(f"Citation retrieval failed: {e}")
        raise HTTPException(status_code=500, detail=f"Citation retrieval failed: {str(e)}")


@router.post("/rebuild-index", response_model=RebuildIndexResponse)
async def rebuild_index(
    force: bool = Query(False, description="Force rebuild even if current"),
    db: Session = Depends(get_db),
):
    """
    Rebuild the BM25 search index.
    
    Call this after bulk document ingestion or if search results seem stale.
    """
    try:
        from models.models import Document as DocumentModel
        
        # Get document count
        doc_count = db.query(DocumentModel).filter(
            DocumentModel.status == "processed"
        ).count()
        
        if doc_count == 0:
            return RebuildIndexResponse(
                success=False,
                message="No processed documents to index",
                documents_indexed=0,
            )
        
        # Rebuild index
        success = rebuild_bm25_index(db, force=force)
        
        return RebuildIndexResponse(
            success=success,
            message="BM25 index rebuilt successfully" if success else "Index already current",
            documents_indexed=doc_count,
        )
    
    except Exception as e:
        logger.error(f"Index rebuild failed: {e}")
        raise HTTPException(status_code=500, detail=f"Index rebuild failed: {str(e)}")
