"""
BM25 Full-Text Search Service for RAG (Retrieval-Augmented Generation)

Provides efficient document indexing and retrieval using BM25 ranking algorithm.
Supports incremental indexing and multi-field search across content, topics, entities.
"""

import logging
from typing import List, Dict, Optional, Tuple
from rank_bm25 import BM25Okapi
from sqlalchemy.orm import Session
from models.models import Document, Topic, Entity

logger = logging.getLogger(__name__)


class BM25SearchIndex:
    """
    BM25 search index for documents.
    
    Indexes documents by:
    - Content (title + body)
    - Topics
    - Entities
    - Author
    
    Supports incremental updates without full rebuilds.
    """
    
    def __init__(self):
        self.index = None
        self.documents = []  # List of (doc_id, doc_data) tuples
        self.doc_id_map = {}  # Map from doc_id to index position
        self.tokenized_corpus = []  # Tokenized documents for BM25
        
    def _tokenize(self, text: str) -> List[str]:
        """Simple tokenization: lowercase, split on whitespace and punctuation."""
        if not text:
            return []
        # Convert to lowercase and split on whitespace
        tokens = text.lower().split()
        # Remove punctuation from tokens
        cleaned = []
        for token in tokens:
            # Remove common punctuation
            token = token.strip('.,!?;:()[]{}"\'-')
            if token and len(token) > 1:  # Keep tokens longer than 1 char
                cleaned.append(token)
        return cleaned
    
    def _build_document_text(self, doc: Document) -> str:
        """Build searchable text from document fields."""
        parts = []
        
        # Content (highest weight - included multiple times)
        if doc.content:
            parts.extend([doc.content] * 3)
        
        # Title
        if doc.title:
            parts.extend([doc.title] * 2)
        
        # Topics
        if doc.topics:
            topic_text = " ".join(str(t) for t in doc.topics if t)
            parts.append(topic_text)
        
        # Entities
        if doc.entities:
            entity_text = " ".join(str(e) for e in doc.entities if e)
            parts.append(entity_text)
        
        # Author
        if doc.author:
            parts.append(doc.author)
        
        # Platform
        if doc.platform:
            parts.append(doc.platform)
        
        return " ".join(parts)
    
    def build_index(self, db: Session) -> None:
        """Build BM25 index from all documents in database."""
        logger.info("Building BM25 index...")
        
        try:
            documents = db.query(Document).all()
            self.documents = []
            self.doc_id_map = {}
            self.tokenized_corpus = []
            
            for idx, doc in enumerate(documents):
                doc_text = self._build_document_text(doc)
                tokens = self._tokenize(doc_text)
                
                self.documents.append((doc.id, {
                    'title': doc.title,
                    'content': doc.content[:500] if doc.content else "",
                    'author': doc.author,
                    'platform': doc.platform,
                    'sentiment': doc.sentiment or 0.0,
                    'topics': doc.topics or [],
                    'entities': doc.entities or [],
                }))
                self.doc_id_map[doc.id] = idx
                self.tokenized_corpus.append(tokens)
            
            # Build BM25 index
            if self.tokenized_corpus:
                self.index = BM25Okapi(self.tokenized_corpus)
                logger.info(f"BM25 index built with {len(self.documents)} documents")
            else:
                logger.warning("No documents to index")
                self.index = None
                
        except Exception as e:
            logger.error(f"Error building BM25 index: {e}")
            self.index = None
    
    def add_document(self, doc: Document) -> None:
        """Add a single document to the index (incremental update)."""
        try:
            if self.index is None:
                logger.warning("Index not initialized, skipping add_document")
                return
            
            doc_text = self._build_document_text(doc)
            tokens = self._tokenize(doc_text)
            
            # Check if document already exists
            if doc.id in self.doc_id_map:
                idx = self.doc_id_map[doc.id]
                self.documents[idx] = (doc.id, {
                    'title': doc.title,
                    'content': doc.content[:500] if doc.content else "",
                    'author': doc.author,
                    'platform': doc.platform,
                    'sentiment': doc.sentiment or 0.0,
                    'topics': doc.topics or [],
                    'entities': doc.entities or [],
                })
                self.tokenized_corpus[idx] = tokens
            else:
                # Add new document
                idx = len(self.documents)
                self.documents.append((doc.id, {
                    'title': doc.title,
                    'content': doc.content[:500] if doc.content else "",
                    'author': doc.author,
                    'platform': doc.platform,
                    'sentiment': doc.sentiment or 0.0,
                    'topics': doc.topics or [],
                    'entities': doc.entities or [],
                }))
                self.doc_id_map[doc.id] = idx
                self.tokenized_corpus.append(tokens)
            
            # Rebuild BM25 index with updated corpus
            self.index = BM25Okapi(self.tokenized_corpus)
            logger.debug(f"Added/updated document {doc.id} in index")
            
        except Exception as e:
            logger.error(f"Error adding document to index: {e}")
    
    def search(self, query: str, top_k: int = 5) -> List[Tuple[str, float, Dict]]:
        """
        Search for documents matching the query.
        
        Args:
            query: Search query string
            top_k: Number of top results to return
            
        Returns:
            List of (doc_id, score, doc_data) tuples, sorted by score descending
        """
        if self.index is None or not self.documents:
            logger.warning("Index not initialized or empty")
            return []
        
        try:
            query_tokens = self._tokenize(query)
            if not query_tokens:
                logger.warning(f"Query produced no tokens: {query}")
                return []
            
            # Get BM25 scores
            scores = self.index.get_scores(query_tokens)
            
            # Get top-k results
            scored_docs = [
                (idx, score) for idx, score in enumerate(scores) if score > 0
            ]
            scored_docs.sort(key=lambda x: x[1], reverse=True)
            scored_docs = scored_docs[:top_k]
            
            results = []
            for idx, score in scored_docs:
                doc_id, doc_data = self.documents[idx]
                results.append((doc_id, float(score), doc_data))
            
            logger.debug(f"Search query '{query}' returned {len(results)} results")
            return results
            
        except Exception as e:
            logger.error(f"Error searching index: {e}")
            return []
    
    def search_by_topic(self, topic: str, top_k: int = 5) -> List[Tuple[str, float, Dict]]:
        """Search for documents by topic."""
        return self.search(topic, top_k)
    
    def search_by_entity(self, entity: str, top_k: int = 5) -> List[Tuple[str, float, Dict]]:
        """Search for documents by entity mention."""
        return self.search(entity, top_k)
    
    def get_document_count(self) -> int:
        """Get total number of indexed documents."""
        return len(self.documents)


# Global index instance
_search_index = BM25SearchIndex()


def initialize_search_index(db: Session) -> None:
    """Initialize the global search index from database."""
    global _search_index
    _search_index.build_index(db)


def get_search_index() -> BM25SearchIndex:
    """Get the global search index instance."""
    return _search_index


def search_documents(query: str, top_k: int = 5) -> List[Tuple[str, float, Dict]]:
    """
    Search for documents matching the query.
    
    Args:
        query: Search query string
        top_k: Number of top results to return
        
    Returns:
        List of (doc_id, score, doc_data) tuples
    """
    return _search_index.search(query, top_k)


def search_by_topic(topic: str, top_k: int = 5) -> List[Tuple[str, float, Dict]]:
    """Search for documents by topic."""
    return _search_index.search_by_topic(topic, top_k)


def search_by_entity(entity: str, top_k: int = 5) -> List[Tuple[str, float, Dict]]:
    """Search for documents by entity."""
    return _search_index.search_by_entity(entity, top_k)


def add_document_to_index(doc: Document) -> None:
    """Add a document to the search index (incremental update)."""
    _search_index.add_document(doc)


def get_indexed_document_count() -> int:
    """Get total number of indexed documents."""
    return _search_index.get_document_count()


def retrieve_context_for_document(
    db: Session,
    doc: Document,
    top_k: int = 3,
    min_score: float = 0.1
) -> List[Dict]:
    """
    Retrieve relevant context documents for a given document.
    
    Used in RAG pipeline to ground AI responses in actual data.
    
    Args:
        db: Database session
        doc: Document to find context for
        top_k: Number of context documents to retrieve
        min_score: Minimum BM25 score threshold
        
    Returns:
        List of context documents with metadata
    """
    # Build search query from document content
    query_parts = []
    if doc.title:
        query_parts.append(doc.title)
    if doc.topics:
        query_parts.extend(str(t) for t in doc.topics if t)
    if doc.entities:
        query_parts.extend(str(e) for e in doc.entities if e)
    
    query = " ".join(query_parts)
    if not query:
        return []
    
    # Search for similar documents
    results = search_documents(query, top_k=top_k + 1)  # +1 to exclude self
    
    context_docs = []
    for doc_id, score, doc_data in results:
        # Skip the document itself
        if doc_id == doc.id:
            continue
        
        # Apply score threshold
        if score < min_score:
            continue
        
        # Fetch full document from DB for context
        context_doc = db.query(Document).filter(Document.id == doc_id).first()
        if context_doc:
            context_docs.append({
                'id': doc_id,
                'title': context_doc.title,
                'content': context_doc.content[:300],
                'author': context_doc.author,
                'platform': context_doc.platform,
                'sentiment': context_doc.sentiment,
                'topics': context_doc.topics,
                'entities': context_doc.entities,
                'relevance_score': score,
            })
        
        if len(context_docs) >= top_k:
            break
    
    return context_docs


def retrieve_context_for_query(
    db: Session,
    query: str,
    top_k: int = 5,
    min_score: float = 0.1
) -> List[Dict]:
    """
    Retrieve relevant documents for a search query.
    
    Used in assistant endpoints to ground responses in actual data.
    
    Args:
        db: Database session
        query: Search query
        top_k: Number of documents to retrieve
        min_score: Minimum BM25 score threshold
        
    Returns:
        List of relevant documents with metadata
    """
    results = search_documents(query, top_k=top_k)
    
    context_docs = []
    for doc_id, score, doc_data in results:
        if score < min_score:
            continue
        
        context_doc = db.query(Document).filter(Document.id == doc_id).first()
        if context_doc:
            context_docs.append({
                'id': doc_id,
                'title': context_doc.title,
                'content': context_doc.content[:300],
                'author': context_doc.author,
                'platform': context_doc.platform,
                'sentiment': context_doc.sentiment,
                'topics': context_doc.topics,
                'entities': context_doc.entities,
                'relevance_score': score,
            })
    
    return context_docs
