import os
import logging
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from database import get_db
from models.models import Document as DocumentModel
from services.search import search_documents as bm25_search, search_by_topic as bm25_search_topic, search_by_entity as bm25_search_entity, retrieve_context_for_query
from pydantic import BaseModel
from typing import List, Optional

logger = logging.getLogger(__name__)

router = APIRouter()

ELASTICSEARCH_URL = os.getenv("ELASTICSEARCH_URL", "http://localhost:9200")


# ─── Schemas ───

class SearchResult(BaseModel):
    id: str
    title: str
    content: str
    author: Optional[str]
    platform: str
    sentiment: Optional[float]
    topics: List[str]
    entities: List[str]
    relevance_score: float


class BM25SearchResponse(BaseModel):
    documents: List[SearchResult]
    total: int
    query: str
    search_engine: str = "bm25"


class TopicSearchResponse(BaseModel):
    documents: List[SearchResult]
    total: int
    topic: str
    search_engine: str = "bm25"


class EntitySearchResponse(BaseModel):
    documents: List[SearchResult]
    total: int
    entity: str
    search_engine: str = "bm25"


def _es_search(q: str, platform: str, language: str, skip: int, limit: int):
    """Attempt Elasticsearch full-text search. Returns (hits, total) or raises."""
    from elasticsearch import Elasticsearch
    es = Elasticsearch(ELASTICSEARCH_URL, request_timeout=3)
    if not es.ping():
        raise ConnectionError("Elasticsearch not reachable")

    must_clauses = [
        {"multi_match": {"query": q, "fields": ["title^2", "content", "topics"]}}
    ]
    if platform:
        must_clauses.append({"term": {"platform": platform}})
    if language:
        must_clauses.append({"term": {"language": language}})

    result = es.search(
        index="documents",
        body={"query": {"bool": {"must": must_clauses}}, "from": skip, "size": limit},
    )
    hits = result["hits"]["hits"]
    total = result["hits"]["total"]["value"]
    return hits, total


@router.get("/")
async def search_documents(
    q: str = Query(..., description="Search query"),
    platform: str = None,
    language: str = None,
    limit: int = 20,
    skip: int = 0,
    db: Session = Depends(get_db),
):
    """Search documents using Elasticsearch when available, falling back to SQL ILIKE."""
    # --- Elasticsearch path ---
    try:
        hits, total = _es_search(q, platform, language, skip, limit)
        if hits:
            doc_ids = [hit["_id"] for hit in hits]
            scores = {hit["_id"]: hit["_score"] for hit in hits}
            docs = db.query(DocumentModel).filter(DocumentModel.id.in_(doc_ids)).all()
            # Attach relevance score from ES
            results = []
            for doc in docs:
                d = {c.name: getattr(doc, c.name) for c in doc.__table__.columns}
                d["relevance_score"] = scores.get(doc.id, 0.0)
                results.append(d)
            results.sort(key=lambda x: x["relevance_score"], reverse=True)
            return {
                "documents": results,
                "total": total,
                "query": q,
                "search_engine": "elasticsearch",
            }
    except Exception as exc:
        logger.warning(f"Elasticsearch search failed, falling back to SQL: {exc}")

    # --- SQL fallback ---
    query = db.query(DocumentModel)
    query = query.filter(
        (DocumentModel.title.ilike(f"%{q}%")) | (DocumentModel.content.ilike(f"%{q}%"))
    )
    if platform:
        query = query.filter(DocumentModel.platform == platform)
    if language:
        query = query.filter(DocumentModel.language == language)

    total = query.count()
    results = query.offset(skip).limit(limit).all()

    return {
        "documents": results,
        "total": total,
        "query": q,
        "search_engine": "sql",
    }


# ─── RAG-Powered BM25 Search Endpoints ───

@router.post("/bm25/documents")
async def search_documents_bm25(
    q: str = Query(..., description="Search query"),
    top_k: int = Query(5, description="Number of results to return"),
    min_score: float = Query(0.1, description="Minimum relevance score threshold"),
    db: Session = Depends(get_db),
):
    """
    Search documents using BM25 ranking algorithm (RAG-powered).
    
    Returns top-K documents ranked by relevance with BM25 scores.
    Useful for grounding AI responses in actual data.
    """
    try:
        results = bm25_search(q, top_k=top_k)
        
        search_results = []
        for doc_id, score, doc_data in results:
            if score >= min_score:
                search_results.append(SearchResult(
                    id=doc_id,
                    title=doc_data.get('title', ''),
                    content=doc_data.get('content', ''),
                    author=doc_data.get('author'),
                    platform=doc_data.get('platform', ''),
                    sentiment=doc_data.get('sentiment'),
                    topics=doc_data.get('topics', []),
                    entities=doc_data.get('entities', []),
                    relevance_score=score,
                ))
        
        return BM25SearchResponse(
            documents=search_results,
            total=len(search_results),
            query=q,
        )
    except Exception as e:
        logger.error(f"BM25 search failed: {e}")
        return BM25SearchResponse(
            documents=[],
            total=0,
            query=q,
        )


@router.post("/bm25/topics")
async def search_by_topic(
    topic: str = Query(..., description="Topic to search for"),
    top_k: int = Query(5, description="Number of results to return"),
    min_score: float = Query(0.1, description="Minimum relevance score threshold"),
    db: Session = Depends(get_db),
):
    """
    Search documents by topic using BM25 ranking.
    
    Returns documents most relevant to the specified topic.
    """
    try:
        results = bm25_search_topic(topic, top_k=top_k)
        
        search_results = []
        for doc_id, score, doc_data in results:
            if score >= min_score:
                search_results.append(SearchResult(
                    id=doc_id,
                    title=doc_data.get('title', ''),
                    content=doc_data.get('content', ''),
                    author=doc_data.get('author'),
                    platform=doc_data.get('platform', ''),
                    sentiment=doc_data.get('sentiment'),
                    topics=doc_data.get('topics', []),
                    entities=doc_data.get('entities', []),
                    relevance_score=score,
                ))
        
        return TopicSearchResponse(
            documents=search_results,
            total=len(search_results),
            topic=topic,
        )
    except Exception as e:
        logger.error(f"Topic search failed: {e}")
        return TopicSearchResponse(
            documents=[],
            total=0,
            topic=topic,
        )


@router.post("/bm25/entities")
async def search_by_entity(
    entity: str = Query(..., description="Entity to search for"),
    top_k: int = Query(5, description="Number of results to return"),
    min_score: float = Query(0.1, description="Minimum relevance score threshold"),
    db: Session = Depends(get_db),
):
    """
    Search documents by entity mention using BM25 ranking.
    
    Returns documents mentioning the specified entity.
    """
    try:
        results = bm25_search_entity(entity, top_k=top_k)
        
        search_results = []
        for doc_id, score, doc_data in results:
            if score >= min_score:
                search_results.append(SearchResult(
                    id=doc_id,
                    title=doc_data.get('title', ''),
                    content=doc_data.get('content', ''),
                    author=doc_data.get('author'),
                    platform=doc_data.get('platform', ''),
                    sentiment=doc_data.get('sentiment'),
                    topics=doc_data.get('topics', []),
                    entities=doc_data.get('entities', []),
                    relevance_score=score,
                ))
        
        return EntitySearchResponse(
            documents=search_results,
            total=len(search_results),
            entity=entity,
        )
    except Exception as e:
        logger.error(f"Entity search failed: {e}")
        return EntitySearchResponse(
            documents=[],
            total=0,
            entity=entity,
        )
