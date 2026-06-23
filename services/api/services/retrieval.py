"""
RAG (Retrieval-Augmented Generation) system with BM25 ranking.

Provides efficient document retrieval with relevance scoring to ground AI responses
in actual collected data and reduce hallucinations.
"""
import logging
from typing import List, Optional, Dict, Tuple
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from rank_bm25 import BM25Okapi
import json
import hashlib

from models.models import Document as DocumentModel, Topic as TopicModel, Entity as EntityModel, Promise as PromiseModel

logger = logging.getLogger(__name__)


class BM25Index:
    """BM25 search index for documents with caching."""
    
    def __init__(self):
        self.corpus = []  # List of tokenized documents
        self.doc_ids = []  # Corresponding document IDs
        self.bm25 = None
        self.last_indexed = None
        self.index_hash = None
    
    def build_index(self, db: Session, force_rebuild: bool = False) -> bool:
        """
        Build BM25 index from all documents in database.
        
        Args:
            db: Database session
            force_rebuild: Force rebuild even if index exists
            
        Returns:
            True if index was built/updated, False if already current
        """
        # Get all processed documents
        documents = db.query(DocumentModel).filter(
            DocumentModel.status == "processed"
        ).all()
        
        if not documents:
            logger.warning("No processed documents found for indexing")
            return False
        
        # Create corpus from documents
        corpus = []
        doc_ids = []
        
        for doc in documents:
            # Combine all searchable fields
            text_parts = [
                doc.title or "",
                doc.content or "",
                " ".join(doc.topics or []) if doc.topics else "",
                " ".join([e.get("name", "") for e in (doc.entities or [])]) if doc.entities else "",
                doc.author or "",
                doc.platform or "",
            ]
            
            # Tokenize: simple lowercase split
            text = " ".join(text_parts).lower()
            tokens = text.split()
            
            corpus.append(tokens)
            doc_ids.append(doc.id)
        
        # Calculate hash of corpus to detect changes
        corpus_str = json.dumps(corpus)
        new_hash = hashlib.md5(corpus_str.encode()).hexdigest()
        
        if not force_rebuild and self.index_hash == new_hash and self.bm25 is not None:
            logger.info("BM25 index is current, skipping rebuild")
            return False
        
        # Build BM25 index
        self.bm25 = BM25Okapi(corpus)
        self.corpus = corpus
        self.doc_ids = doc_ids
        self.index_hash = new_hash
        self.last_indexed = datetime.now()
        
        logger.info(f"BM25 index built with {len(corpus)} documents")
        return True
    
    def search(
        self,
        query: str,
        top_k: int = 10,
        min_score: float = 0.0
    ) -> List[Tuple[str, float]]:
        """
        Search index using BM25 ranking.
        
        Args:
            query: Search query string
            top_k: Number of top results to return
            min_score: Minimum relevance score threshold
            
        Returns:
            List of (doc_id, score) tuples sorted by relevance
        """
        if self.bm25 is None:
            logger.warning("BM25 index not initialized")
            return []
        
        # Tokenize query
        query_tokens = query.lower().split()
        
        # Get BM25 scores
        scores = self.bm25.get_scores(query_tokens)
        
        # Pair with doc IDs and filter
        results = [
            (self.doc_ids[i], float(scores[i]))
            for i in range(len(scores))
            if scores[i] >= min_score
        ]
        
        # Sort by score descending
        results.sort(key=lambda x: x[1], reverse=True)
        
        return results[:top_k]


# Global BM25 index instance
_bm25_index = BM25Index()


def rebuild_bm25_index(db: Session, force: bool = False) -> bool:
    """Rebuild the global BM25 index."""
    return _bm25_index.build_index(db, force_rebuild=force)


def search_documents_bm25(
    query: str,
    db: Session,
    top_k: int = 10,
    min_score: float = 0.0,
    platform: Optional[str] = None,
    sentiment_min: Optional[float] = None,
    sentiment_max: Optional[float] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    topics: Optional[List[str]] = None,
) -> List[Dict]:
    """
    Search documents using BM25 with optional filtering.
    
    Args:
        query: Search query
        db: Database session
        top_k: Number of results to return
        min_score: Minimum BM25 score
        platform: Filter by platform (e.g., "twitter", "instagram")
        sentiment_min: Filter by minimum sentiment score
        sentiment_max: Filter by maximum sentiment score
        date_from: Filter documents from this date
        date_to: Filter documents until this date
        topics: Filter by topics (any match)
        
    Returns:
        List of document dicts with relevance scores
    """
    # Ensure index is built
    if _bm25_index.bm25 is None:
        rebuild_bm25_index(db)
    
    # BM25 search
    bm25_results = _bm25_index.search(query, top_k=top_k * 2, min_score=min_score)
    
    if not bm25_results:
        return []
    
    # Get document IDs from BM25
    doc_ids = [doc_id for doc_id, _ in bm25_results]
    bm25_scores = {doc_id: score for doc_id, score in bm25_results}
    
    # Query database with filters
    db_query = db.query(DocumentModel).filter(DocumentModel.id.in_(doc_ids))
    
    if platform:
        db_query = db_query.filter(DocumentModel.platform == platform)
    
    if sentiment_min is not None:
        db_query = db_query.filter(DocumentModel.sentiment >= sentiment_min)
    
    if sentiment_max is not None:
        db_query = db_query.filter(DocumentModel.sentiment <= sentiment_max)
    
    if date_from:
        db_query = db_query.filter(DocumentModel.collected_at >= date_from)
    
    if date_to:
        db_query = db_query.filter(DocumentModel.collected_at <= date_to)
    
    documents = db_query.all()
    
    # Filter by topics if specified
    if topics:
        documents = [
            doc for doc in documents
            if doc.topics and any(t in doc.topics for t in topics)
        ]
    
    # Convert to dicts with BM25 scores
    results = []
    for doc in documents:
        doc_dict = {
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
            "relevance_score": bm25_scores.get(doc.id, 0.0),
        }
        results.append(doc_dict)
    
    # Sort by BM25 score
    results.sort(key=lambda x: x["relevance_score"], reverse=True)
    
    return results[:top_k]


def get_context_for_analysis(
    db: Session,
    query: str,
    top_k: int = 5,
    include_promises: bool = True,
    include_entities: bool = True,
) -> Dict:
    """
    Retrieve context documents for LLM analysis.
    
    Args:
        db: Database session
        query: Analysis query/topic
        top_k: Number of documents to retrieve
        include_promises: Include related promises
        include_entities: Include related entities
        
    Returns:
        Dict with retrieved documents and related data
    """
    # Search for relevant documents
    documents = search_documents_bm25(query, db, top_k=top_k)
    
    context = {
        "documents": documents,
        "promises": [],
        "entities": [],
        "summary": f"Retrieved {len(documents)} relevant documents for analysis"
    }
    
    if not documents:
        return context
    
    doc_ids = [doc["id"] for doc in documents]
    
    # Get related promises
    if include_promises:
        promises = db.query(PromiseModel).filter(
            PromiseModel.document_id.in_(doc_ids)
        ).all()
        context["promises"] = [
            {
                "id": p.id,
                "text": p.text,
                "entity": p.entity,
                "topic": p.topic,
                "timeline": p.timeline,
                "region": p.region,
                "confidence": p.confidence,
                "document_id": p.document_id,
            }
            for p in promises
        ]
    
    # Get related entities
    if include_entities:
        entities = db.query(EntityModel).filter(
            EntityModel.id.in_([
                e.get("id") for doc in documents
                for e in (doc.get("entities") or [])
                if isinstance(e, dict) and "id" in e
            ])
        ).all()
        context["entities"] = [
            {
                "id": e.id,
                "name": e.name,
                "type": e.type,
                "description": e.description,
                "mention_count": e.mention_count,
            }
            for e in entities
        ]
    
    return context


def format_context_for_prompt(context: Dict) -> str:
    """
    Format retrieved context for inclusion in LLM prompt.
    
    Args:
        context: Context dict from get_context_for_analysis
        
    Returns:
        Formatted string for prompt
    """
    parts = []
    
    if context.get("documents"):
        parts.append("## Retrieved Documents\n")
        for i, doc in enumerate(context["documents"][:5], 1):
            parts.append(f"\n### Document {i}: {doc.get('title', 'Untitled')}")
            parts.append(f"Platform: {doc.get('platform')}")
            parts.append(f"Author: {doc.get('author', 'Unknown')}")
            parts.append(f"Sentiment: {doc.get('sentiment', 'N/A')}")
            parts.append(f"Relevance Score: {doc.get('relevance_score', 0):.2f}")
            parts.append(f"\nContent:\n{doc.get('content', '')[:500]}...")
    
    if context.get("promises"):
        parts.append("\n## Related Promises\n")
        for promise in context["promises"][:5]:
            parts.append(f"- {promise.get('text', '')}")
            parts.append(f"  Entity: {promise.get('entity')}, Timeline: {promise.get('timeline')}")
    
    if context.get("entities"):
        parts.append("\n## Key Entities\n")
        for entity in context["entities"][:10]:
            parts.append(f"- {entity.get('name')} ({entity.get('type')})")
    
    return "\n".join(parts)


def get_source_citations(documents: List[Dict]) -> List[Dict]:
    """
    Extract source citations from retrieved documents.
    
    Args:
        documents: List of document dicts
        
    Returns:
        List of citation dicts
    """
    citations = []
    for doc in documents:
        citation = {
            "id": doc.get("id"),
            "title": doc.get("title"),
            "author": doc.get("author"),
            "platform": doc.get("platform"),
            "url": doc.get("url"),
            "published_at": doc.get("published_at"),
            "relevance_score": doc.get("relevance_score"),
        }
        citations.append(citation)
    return citations
