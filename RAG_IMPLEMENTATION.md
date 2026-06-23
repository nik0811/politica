# RAG (Retrieval-Augmented Generation) Implementation Guide

## Overview

This document describes the Retrieval-Augmented Generation (RAG) system implemented in the Politica platform. RAG grounds AI responses in actual collected data, significantly reducing hallucinations and improving accuracy.

## Architecture

### Components

1. **BM25 Search Index** (`services/search.py`)
   - In-memory BM25 full-text search index
   - Indexes documents by content, topics, entities, and author
   - Supports incremental updates without full rebuilds
   - Fast retrieval with relevance scoring

2. **Processor Integration** (`services/processor.py`)
   - Retrieves context documents before LLM processing
   - Includes context in system prompt
   - Grounds sentiment analysis and entity extraction in actual data

3. **Search Endpoints** (`routers/search.py`)
   - BM25-powered document search
   - Topic-based search
   - Entity-based search
   - All endpoints return relevance scores

4. **Assistant Integration** (`routers/assistant.py`)
   - Analysis endpoint uses RAG context
   - Recommendations grounded in actual documents
   - Insights reference retrieved patterns

5. **Analytics Integration** (`routers/analytics.py`)
   - Engagement metrics include context document counts
   - Sentiment analysis references retrieved documents

## How RAG Works

### 1. Document Indexing

When the API starts:
```python
# In main.py lifespan
initialize_search_index(db)  # Builds BM25 index from all documents
```

When a document is processed:
```python
# In processor.py
add_document_to_index(doc)  # Incremental update
```

### 2. Context Retrieval

Before processing a document:
```python
# In processor.py
context_docs = retrieve_context_for_document(db, doc, top_k=3)
```

This retrieves the 3 most similar documents based on:
- Content similarity
- Topic overlap
- Entity mentions
- Author patterns

### 3. LLM Processing with Context

The context is included in the system prompt:
```
--- CONTEXT FROM KNOWLEDGE BASE ---
Similar documents that may inform this analysis:

Document: [Title]
Author: [Author] ([Platform])
Sentiment: [Score]
Topics: [Topics]
Content: [Preview]

--- END CONTEXT ---
```

The LLM uses this context to:
- Validate sentiment assessment
- Identify entity relationships
- Ensure promise consistency
- Avoid hallucinating new information

### 4. Search Endpoints

#### BM25 Document Search
```
POST /api/search/bm25/documents
Query Parameters:
  - q: Search query (required)
  - top_k: Number of results (default: 5)
  - min_score: Minimum relevance threshold (default: 0.1)

Response:
{
  "documents": [
    {
      "id": "doc-id",
      "title": "Document Title",
      "content": "First 300 chars...",
      "author": "Author Name",
      "platform": "twitter",
      "sentiment": 0.5,
      "topics": ["topic1", "topic2"],
      "entities": ["Entity1", "Entity2"],
      "relevance_score": 8.5
    }
  ],
  "total": 1,
  "query": "search query",
  "search_engine": "bm25"
}
```

#### Topic Search
```
POST /api/search/bm25/topics
Query Parameters:
  - topic: Topic to search for (required)
  - top_k: Number of results (default: 5)
  - min_score: Minimum relevance threshold (default: 0.1)

Response: Same format as document search
```

#### Entity Search
```
POST /api/search/bm25/entities
Query Parameters:
  - entity: Entity to search for (required)
  - top_k: Number of results (default: 5)
  - min_score: Minimum relevance threshold (default: 0.1)

Response: Same format as document search
```

## Integration Points

### 1. Document Processing Pipeline

**Before**: LLM processes document in isolation
```
Document → LLM → Extract topics, entities, sentiment
```

**After**: LLM processes with context
```
Document → Retrieve Context → LLM → Extract topics, entities, sentiment
                ↓
         (Grounded in actual data)
```

### 2. Assistant Analysis

The `/api/assistant/analyze` endpoint now:
- Retrieves context for each topic
- Includes context document count in reasoning
- Grounds recommendations in actual data

### 3. Analytics Engagement

The `/api/analytics/engagement` endpoint now:
- Shows related document count for each top post
- Provides context for engagement analysis

## Performance Considerations

### Index Size
- BM25 index is in-memory
- Scales to ~100,000 documents on typical hardware
- For larger datasets, consider:
  - Elasticsearch integration
  - Distributed search (Qdrant)
  - Periodic index snapshots

### Search Speed
- BM25 search: ~10-50ms for typical queries
- Incremental indexing: ~1-5ms per document
- No database queries required for search

### Memory Usage
- Approximately 1-2 KB per indexed document
- 100,000 documents ≈ 100-200 MB

### Optimization Tips
1. Use `min_score` parameter to filter low-relevance results
2. Limit `top_k` to actual needs (5-10 usually sufficient)
3. Rebuild index periodically during off-peak hours
4. Monitor index size and consider archiving old documents

## Hallucination Reduction

### How RAG Reduces Hallucinations

1. **Factual Grounding**: LLM sees actual data before generating responses
2. **Consistency Checking**: LLM can validate against retrieved documents
3. **Source Attribution**: Retrieved documents can be cited
4. **Confidence Scoring**: Relevance scores indicate data quality

### Example

**Without RAG**:
```
User: "What infrastructure projects are planned?"
LLM: "The government plans to build 200 km of roads, 50 new bridges, 
      and 10 metro stations." (Hallucinated - no actual data)
```

**With RAG**:
```
User: "What infrastructure projects are planned?"
Context Retrieved:
  - Document 1: "100 km of new roads planned"
  - Document 2: "25 new bridges in construction"
LLM: "Based on collected data, the government plans 100 km of new roads 
      and 25 new bridges." (Grounded in actual data)
```

## Testing

### Run RAG Tests
```bash
cd services/api
pytest tests/test_rag.py -v
```

### Test Coverage
- BM25 tokenization and indexing
- Document search accuracy
- Incremental indexing
- Context retrieval
- Relevance scoring
- Hallucination reduction

### Manual Testing

1. **Index Initialization**
```bash
curl http://localhost:8000/health
# Check logs for "BM25 search index initialized"
```

2. **Search Documents**
```bash
curl -X POST "http://localhost:8000/api/search/bm25/documents?q=infrastructure&top_k=5"
```

3. **Search by Topic**
```bash
curl -X POST "http://localhost:8000/api/search/bm25/topics?topic=elections&top_k=5"
```

4. **Search by Entity**
```bash
curl -X POST "http://localhost:8000/api/search/bm25/entities?entity=Pramod%20Sawant&top_k=5"
```

5. **Analyze with RAG**
```bash
curl -X POST "http://localhost:8000/api/assistant/analyze"
# Check response for "Grounded in X relevant documents"
```

## Configuration

### Environment Variables
```
# Optional: Elasticsearch URL (falls back to BM25 if unavailable)
ELASTICSEARCH_URL=http://localhost:9200

# Optional: Qdrant URL for vector search (future enhancement)
QDRANT_URL=http://localhost:6333
```

### Tuning Parameters

In `services/search.py`:
```python
# Adjust tokenization
MIN_TOKEN_LENGTH = 1  # Minimum token length to keep

# Adjust context retrieval
DEFAULT_TOP_K = 5  # Default number of context documents
DEFAULT_MIN_SCORE = 0.1  # Default minimum relevance score

# Adjust indexing
CONTENT_WEIGHT = 3  # How many times to include content in index
TITLE_WEIGHT = 2  # How many times to include title
```

## Future Enhancements

### 1. Semantic Search
- Add vector embeddings (e.g., using Sentence Transformers)
- Combine BM25 with semantic similarity
- Better handling of synonyms and paraphrases

### 2. Hybrid Search
- Combine BM25 with Elasticsearch
- Use Qdrant for vector search
- Ensemble ranking for better results

### 3. Context Summarization
- Summarize retrieved context before passing to LLM
- Reduce token usage
- Improve response quality

### 4. Citation Generation
- Track which documents informed each response
- Generate citations in responses
- Build document lineage

### 5. Feedback Loop
- Track which retrieved documents were helpful
- Improve ranking based on user feedback
- Fine-tune relevance thresholds

### 6. Multi-Language Support
- Extend tokenization for non-English text
- Support Hindi, Marathi, Konkani
- Language-specific stemming

## Troubleshooting

### Index Not Initialized
**Problem**: "BM25 search index initialized" not in logs
**Solution**: 
1. Check database connection
2. Verify documents exist in database
3. Check logs for initialization errors

### Search Returns No Results
**Problem**: Search queries return empty results
**Solution**:
1. Lower `min_score` threshold
2. Increase `top_k` parameter
3. Check if documents are indexed
4. Verify query terms match document content

### Slow Search Performance
**Problem**: Search takes >100ms
**Solution**:
1. Reduce `top_k` parameter
2. Increase `min_score` threshold
3. Rebuild index during off-peak hours
4. Consider Elasticsearch for large datasets

### Memory Usage High
**Problem**: API memory usage increasing
**Solution**:
1. Archive old documents
2. Reduce index size
3. Implement periodic index cleanup
4. Consider distributed search

## API Reference

### Search Service Functions

```python
# Initialize index from database
initialize_search_index(db: Session) -> None

# Get global index instance
get_search_index() -> BM25SearchIndex

# Search documents
search_documents(query: str, top_k: int = 5) -> List[Tuple[str, float, Dict]]

# Search by topic
search_by_topic(topic: str, top_k: int = 5) -> List[Tuple[str, float, Dict]]

# Search by entity
search_by_entity(entity: str, top_k: int = 5) -> List[Tuple[str, float, Dict]]

# Add document to index
add_document_to_index(doc: Document) -> None

# Get indexed document count
get_indexed_document_count() -> int

# Retrieve context for document
retrieve_context_for_document(
    db: Session,
    doc: Document,
    top_k: int = 3,
    min_score: float = 0.1
) -> List[Dict]

# Retrieve context for query
retrieve_context_for_query(
    db: Session,
    query: str,
    top_k: int = 5,
    min_score: float = 0.1
) -> List[Dict]
```

## Conclusion

The RAG system significantly improves the quality and reliability of AI-generated insights by grounding them in actual collected data. This reduces hallucinations, improves consistency, and enables better decision-making based on real evidence.

For questions or issues, refer to the test suite (`tests/test_rag.py`) for usage examples.
