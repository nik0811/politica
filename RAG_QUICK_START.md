# RAG Quick Start Guide

## What is RAG?

Retrieval-Augmented Generation (RAG) grounds AI responses in actual collected data, reducing hallucinations and improving accuracy.

## Quick Setup

### 1. Verify Dependencies
```bash
cd services/api
grep rank-bm25 requirements.txt
# Should show: rank-bm25>=0.2.2
```

### 2. Start the API
```bash
python3 -m uvicorn main:app --reload
```

The BM25 index will automatically initialize on startup.

### 3. Verify Initialization
```bash
curl http://localhost:8000/health
# Check logs for: "BM25 search index initialized for RAG"
```

## Using RAG Search Endpoints

### Search Documents by Query
```bash
curl -X POST "http://localhost:8000/api/search/bm25/documents?q=infrastructure&top_k=5"
```

Response:
```json
{
  "documents": [
    {
      "id": "doc-123",
      "title": "Infrastructure Development",
      "content": "Building new roads and bridges...",
      "author": "Government",
      "platform": "twitter",
      "sentiment": 0.7,
      "topics": ["infrastructure", "development"],
      "entities": ["Ministry", "Goa"],
      "relevance_score": 8.5
    }
  ],
  "total": 1,
  "query": "infrastructure",
  "search_engine": "bm25"
}
```

### Search by Topic
```bash
curl -X POST "http://localhost:8000/api/search/bm25/topics?topic=elections&top_k=5"
```

### Search by Entity
```bash
curl -X POST "http://localhost:8000/api/search/bm25/entities?entity=Pramod%20Sawant&top_k=5"
```

## How RAG Improves AI Responses

### Before RAG
```
User Query → LLM → Response (may contain hallucinations)
```

### After RAG
```
User Query → Search Index → Retrieve Context → LLM → Response (grounded in data)
```

## Key Features

### 1. Automatic Context Retrieval
When processing documents, the system automatically:
- Finds similar documents
- Includes them in the LLM prompt
- Grounds analysis in actual data

### 2. Fast Search
- BM25 search: ~10-50ms
- No database queries needed
- In-memory index

### 3. Incremental Updates
- New documents added to index automatically
- No full rebuilds needed
- Scales to 100,000+ documents

### 4. Relevance Scoring
- Each result includes a relevance score
- Filter by minimum score threshold
- Understand result quality

## Common Use Cases

### 1. Analyzing Political Statements
```bash
# Search for similar statements about infrastructure
curl -X POST "http://localhost:8000/api/search/bm25/documents?q=infrastructure%20development&top_k=5"

# LLM uses these to ground analysis
```

### 2. Finding Entity Mentions
```bash
# Find all documents mentioning a politician
curl -X POST "http://localhost:8000/api/search/bm25/entities?entity=Pramod%20Sawant&top_k=10"
```

### 3. Topic Analysis
```bash
# Find all documents about elections
curl -X POST "http://localhost:8000/api/search/bm25/topics?topic=elections&top_k=20"
```

### 4. Generating Recommendations
```bash
# Get analysis with RAG context
curl -X POST "http://localhost:8000/api/assistant/analyze"

# Response includes: "Grounded in X relevant documents"
```

## Tuning Search Results

### Get More Results
```bash
# Increase top_k
curl -X POST "http://localhost:8000/api/search/bm25/documents?q=infrastructure&top_k=20"
```

### Get Only High-Quality Results
```bash
# Increase min_score threshold
curl -X POST "http://localhost:8000/api/search/bm25/documents?q=infrastructure&min_score=5.0"
```

### Get All Relevant Results
```bash
# Lower min_score threshold
curl -X POST "http://localhost:8000/api/search/bm25/documents?q=infrastructure&min_score=0.01"
```

## Monitoring

### Check Index Status
```python
from services.search import get_indexed_document_count

count = get_indexed_document_count()
print(f"Indexed documents: {count}")
```

### Monitor Search Performance
```bash
# Check API logs for search timing
tail -f logs/api.log | grep "search"
```

## Troubleshooting

### No Results Returned
1. Lower `min_score` parameter
2. Increase `top_k` parameter
3. Check if documents are in database
4. Verify document content matches query

### Slow Search
1. Reduce `top_k` parameter
2. Increase `min_score` threshold
3. Check API logs for performance issues

### Index Not Initialized
1. Check database connection
2. Verify documents exist in database
3. Check API startup logs

## Next Steps

1. **Integrate with Your App**
   - Use search endpoints in your frontend
   - Display relevance scores
   - Show retrieved context

2. **Monitor Quality**
   - Track search accuracy
   - Collect user feedback
   - Adjust thresholds

3. **Scale Up**
   - Archive old documents
   - Consider Elasticsearch for large datasets
   - Implement periodic index cleanup

## API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/search/bm25/documents` | POST | Search documents by query |
| `/api/search/bm25/topics` | POST | Search documents by topic |
| `/api/search/bm25/entities` | POST | Search documents by entity |
| `/api/assistant/analyze` | POST | Analyze with RAG context |
| `/api/analytics/engagement` | GET | Engagement with context counts |

## Example: Complete Workflow

```bash
# 1. Search for infrastructure documents
curl -X POST "http://localhost:8000/api/search/bm25/documents?q=infrastructure&top_k=5"

# 2. Get analysis with RAG context
curl -X POST "http://localhost:8000/api/assistant/analyze"

# 3. Check engagement metrics with context
curl "http://localhost:8000/api/analytics/engagement"

# 4. Search by specific entity
curl -X POST "http://localhost:8000/api/search/bm25/entities?entity=Government&top_k=10"
```

## Performance Benchmarks

| Operation | Time | Notes |
|-----------|------|-------|
| Index 1,000 documents | ~500ms | One-time startup |
| Add 1 document | ~1-5ms | Incremental update |
| Search query | ~10-50ms | Depends on corpus size |
| Retrieve context | ~20-100ms | Includes DB fetch |

## Support

For detailed documentation, see: `RAG_IMPLEMENTATION.md`

For test examples, see: `tests/test_rag.py`
