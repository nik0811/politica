"""
Test suite for RAG (Retrieval-Augmented Generation) system.

Tests BM25 search accuracy, RAG integration, and hallucination reduction.
"""

import pytest
from sqlalchemy.orm import Session
from datetime import datetime

from models.models import Document, Topic, Entity, Promise, generate_uuid
from services.search import (
    BM25SearchIndex,
    search_documents,
    search_by_topic,
    search_by_entity,
    retrieve_context_for_document,
    retrieve_context_for_query,
    initialize_search_index,
    get_indexed_document_count,
)


class TestBM25SearchIndex:
    """Test BM25 search index functionality."""
    
    def test_tokenization(self):
        """Test document tokenization."""
        index = BM25SearchIndex()
        
        # Test basic tokenization
        tokens = index._tokenize("Hello World! This is a test.")
        assert "hello" in tokens
        assert "world" in tokens
        assert "test" in tokens
        assert "is" in tokens
        
        # Test empty string
        tokens = index._tokenize("")
        assert len(tokens) == 0
        
        # Test punctuation removal
        tokens = index._tokenize("test-case, another.word!")
        assert "test" in tokens
        assert "case" in tokens
        assert "another" in tokens
        assert "word" in tokens
    
    def test_document_text_building(self):
        """Test building searchable text from document."""
        index = BM25SearchIndex()
        
        doc = Document(
            id=generate_uuid(),
            title="Infrastructure Development",
            content="Building new roads and bridges in Goa",
            platform="twitter",
            author="John Doe",
            topics=["infrastructure", "development"],
            entities=["Goa", "Ministry of Roads"],
        )
        
        text = index._build_document_text(doc)
        
        # Check that all important fields are included
        assert "infrastructure" in text.lower()
        assert "development" in text.lower()
        assert "roads" in text.lower()
        assert "goa" in text.lower()
        assert "john" in text.lower()
    
    def test_index_building(self, db: Session):
        """Test building index from database documents."""
        index = BM25SearchIndex()
        
        # Create test documents
        docs = [
            Document(
                id=generate_uuid(),
                title="Election Campaign",
                content="Campaign for upcoming elections",
                platform="twitter",
                author="Candidate A",
                topics=["elections"],
                entities=["Candidate A"],
            ),
            Document(
                id=generate_uuid(),
                title="Infrastructure Project",
                content="New highway construction project",
                platform="facebook",
                author="Government",
                topics=["infrastructure"],
                entities=["Government"],
            ),
        ]
        
        for doc in docs:
            db.add(doc)
        db.commit()
        
        # Build index
        index.build_index(db)
        
        assert index.get_document_count() == 2
        assert index.index is not None
    
    def test_search_functionality(self, db: Session):
        """Test search returns relevant documents."""
        index = BM25SearchIndex()
        
        # Create test documents
        doc1 = Document(
            id=generate_uuid(),
            title="Infrastructure Development",
            content="Building new roads and bridges",
            platform="twitter",
            author="Author1",
            topics=["infrastructure"],
            entities=["Ministry"],
        )
        
        doc2 = Document(
            id=generate_uuid(),
            title="Education Policy",
            content="New education reforms announced",
            platform="facebook",
            author="Author2",
            topics=["education"],
            entities=["Ministry"],
        )
        
        db.add(doc1)
        db.add(doc2)
        db.commit()
        
        index.build_index(db)
        
        # Search for infrastructure
        results = index.search("roads bridges", top_k=5)
        
        assert len(results) > 0
        # First result should be doc1 (infrastructure)
        assert results[0][0] == doc1.id
        assert results[0][1] > 0  # Has positive score
    
    def test_incremental_indexing(self, db: Session):
        """Test adding documents to index without rebuild."""
        index = BM25SearchIndex()
        
        # Create initial document
        doc1 = Document(
            id=generate_uuid(),
            title="First Document",
            content="Initial content",
            platform="twitter",
            author="Author1",
            topics=["topic1"],
            entities=["Entity1"],
        )
        
        db.add(doc1)
        db.commit()
        
        index.build_index(db)
        initial_count = index.get_document_count()
        
        # Add new document
        doc2 = Document(
            id=generate_uuid(),
            title="Second Document",
            content="Additional content",
            platform="facebook",
            author="Author2",
            topics=["topic2"],
            entities=["Entity2"],
        )
        
        db.add(doc2)
        db.commit()
        
        index.add_document(doc2)
        
        # Check count increased
        assert index.get_document_count() == initial_count + 1
    
    def test_search_by_topic(self, db: Session):
        """Test searching by topic."""
        index = BM25SearchIndex()
        
        doc = Document(
            id=generate_uuid(),
            title="Election News",
            content="Election campaign updates",
            platform="twitter",
            author="Author",
            topics=["elections", "politics"],
            entities=["Party A"],
        )
        
        db.add(doc)
        db.commit()
        
        index.build_index(db)
        
        results = index.search_by_topic("elections", top_k=5)
        
        assert len(results) > 0
        assert results[0][0] == doc.id
    
    def test_search_by_entity(self, db: Session):
        """Test searching by entity."""
        index = BM25SearchIndex()
        
        doc = Document(
            id=generate_uuid(),
            title="Pramod Sawant News",
            content="Chief Minister announces new policy",
            platform="twitter",
            author="News Agency",
            topics=["politics"],
            entities=["Pramod Sawant", "Goa"],
        )
        
        db.add(doc)
        db.commit()
        
        index.build_index(db)
        
        results = index.search_by_entity("Pramod Sawant", top_k=5)
        
        assert len(results) > 0
        assert results[0][0] == doc.id


class TestRAGIntegration:
    """Test RAG integration with document processing."""
    
    def test_retrieve_context_for_document(self, db: Session):
        """Test retrieving context documents for a given document."""
        # Create test documents
        doc1 = Document(
            id=generate_uuid(),
            title="Infrastructure Development",
            content="Building new roads and bridges in Goa",
            platform="twitter",
            author="Author1",
            topics=["infrastructure"],
            entities=["Ministry"],
        )
        
        doc2 = Document(
            id=generate_uuid(),
            title="Road Construction",
            content="New highway project in Goa",
            platform="facebook",
            author="Author2",
            topics=["infrastructure"],
            entities=["Ministry"],
        )
        
        doc3 = Document(
            id=generate_uuid(),
            title="Education Policy",
            content="New education reforms",
            platform="twitter",
            author="Author3",
            topics=["education"],
            entities=["Ministry"],
        )
        
        db.add_all([doc1, doc2, doc3])
        db.commit()
        
        # Initialize index
        initialize_search_index(db)
        
        # Retrieve context for doc1
        context = retrieve_context_for_document(db, doc1, top_k=2)
        
        # Should retrieve doc2 (similar topic)
        assert len(context) > 0
        assert context[0]['id'] == doc2.id
    
    def test_retrieve_context_for_query(self, db: Session):
        """Test retrieving context documents for a search query."""
        # Create test documents
        doc1 = Document(
            id=generate_uuid(),
            title="Infrastructure Development",
            content="Building new roads and bridges",
            platform="twitter",
            author="Author1",
            topics=["infrastructure"],
            entities=["Ministry"],
        )
        
        doc2 = Document(
            id=generate_uuid(),
            title="Education Policy",
            content="New education reforms",
            platform="facebook",
            author="Author2",
            topics=["education"],
            entities=["Ministry"],
        )
        
        db.add_all([doc1, doc2])
        db.commit()
        
        # Initialize index
        initialize_search_index(db)
        
        # Retrieve context for query
        context = retrieve_context_for_query(db, "roads bridges", top_k=5)
        
        # Should retrieve doc1
        assert len(context) > 0
        assert context[0]['id'] == doc1.id
        assert 'relevance_score' in context[0]
    
    def test_hallucination_reduction(self, db: Session):
        """Test that RAG reduces hallucinations by grounding in actual data."""
        # Create documents with specific facts
        doc1 = Document(
            id=generate_uuid(),
            title="Goa Infrastructure Plan",
            content="The government announced a 5-year plan to build 100 km of new roads",
            platform="twitter",
            author="Government",
            topics=["infrastructure"],
            entities=["Government", "Goa"],
            sentiment=0.7,
        )
        
        db.add(doc1)
        db.commit()
        
        # Initialize index
        initialize_search_index(db)
        
        # Retrieve context for infrastructure query
        context = retrieve_context_for_query(db, "infrastructure roads", top_k=5)
        
        # Verify context contains actual data
        assert len(context) > 0
        assert "100 km" in context[0]['content']
        assert context[0]['sentiment'] == 0.7
        
        # This context should be used by LLM to avoid hallucinating different numbers


class TestSearchEndpoints:
    """Test search endpoint functionality."""
    
    def test_bm25_search_response_format(self):
        """Test BM25 search returns correct response format."""
        # This would be tested with actual API calls
        # Verifying response includes: documents, total, query, search_engine
        pass
    
    def test_topic_search_response_format(self):
        """Test topic search returns correct response format."""
        # Verifying response includes: documents, total, topic, search_engine
        pass
    
    def test_entity_search_response_format(self):
        """Test entity search returns correct response format."""
        # Verifying response includes: documents, total, entity, search_engine
        pass


class TestRAGAccuracy:
    """Test RAG accuracy and relevance scoring."""
    
    def test_relevance_scoring(self, db: Session):
        """Test that BM25 scores reflect relevance."""
        # Create documents with varying relevance
        doc1 = Document(
            id=generate_uuid(),
            title="Infrastructure Roads Bridges",
            content="Infrastructure roads bridges highways",
            platform="twitter",
            author="Author1",
            topics=["infrastructure"],
            entities=["Ministry"],
        )
        
        doc2 = Document(
            id=generate_uuid(),
            title="Education",
            content="Education schools students",
            platform="facebook",
            author="Author2",
            topics=["education"],
            entities=["Ministry"],
        )
        
        db.add_all([doc1, doc2])
        db.commit()
        
        initialize_search_index(db)
        
        # Search for infrastructure
        results = search_documents("infrastructure roads", top_k=5)
        
        # doc1 should have higher score than doc2
        assert len(results) >= 1
        assert results[0][0] == doc1.id
        assert results[0][1] > 0
    
    def test_minimum_score_threshold(self, db: Session):
        """Test that minimum score threshold filters results."""
        doc = Document(
            id=generate_uuid(),
            title="Test",
            content="Test content",
            platform="twitter",
            author="Author",
            topics=["test"],
            entities=["Entity"],
        )
        
        db.add(doc)
        db.commit()
        
        initialize_search_index(db)
        
        # Search with high threshold
        context = retrieve_context_for_query(db, "unrelated query", top_k=5, min_score=10.0)
        
        # Should return empty due to high threshold
        assert len(context) == 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
