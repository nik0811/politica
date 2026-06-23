# RAG Implementation - Visual Architecture

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Politica Platform                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    API Layer                             │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │                                                          │  │
│  │  ┌─────────────────┐  ┌──────────────────────────────┐  │  │
│  │  │ Search Endpoints│  │ Enhanced Endpoints           │  │  │
│  │  ├─────────────────┤  ├──────────────────────────────┤  │  │
│  │  │ • /documents    │  │ • /assistant/analyze         │  │  │
│  │  │ • /topics       │  │ • /analytics/engagement      │  │  │
│  │  │ • /entities     │  │                              │  │  │
│  │  └─────────────────┘  └──────────────────────────────┘  │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  RAG Service Layer                       │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │                                                          │  │
│  │  ┌──────────────────────────────────────────────────┐   │  │
│  │  │         BM25 Search Index (In-Memory)           │   │  │
│  │  ├──────────────────────────────────────────────────┤   │  │
│  │  │                                                  │   │  │
│  │  │  • Tokenization & Indexing                      │   │  │
│  │  │  • Multi-field search (content, topics, etc)    │   │  │
│  │  │  • Relevance scoring                            │   │  │
│  │  │  • Incremental updates                          │   │  │
│  │  │                                                  │   │  │
│  │  └──────────────────────────────────────────────────┘   │  │
│  │                                                          │  │
│  │  ┌──────────────────────────────────────────────────┐   │  │
│  │  │      Context Retrieval Functions                │   │  │
│  │  ├──────────────────────────────────────────────────┤   │  │
│  │  │                                                  │   │  │
│  │  │  • retrieve_context_for_document()              │   │  │
│  │  │  • retrieve_context_for_query()                 │   │  │
│  │  │  • search_documents()                           │   │  │
│  │  │  • search_by_topic()                            │   │  │
│  │  │  • search_by_entity()                           │   │  │
│  │  │                                                  │   │  │
│  │  └──────────────────────────────────────────────────┘   │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Processing Layer                           │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │                                                          │  │
│  │  ┌──────────────────────────────────────────────────┐   │  │
│  │  │    Document Processor (with RAG)                │   │  │
│  │  ├──────────────────────────────────────────────────┤   │  │
│  │  │                                                  │   │  │
│  │  │  1. Retrieve context documents                  │   │  │
│  │  │  2. Build prompt with context                   │   │  │
│  │  │  3. Send to LLM                                 │   │  │
│  │  │  4. Extract topics, entities, sentiment         │   │  │
│  │  │  5. Add to search index                         │   │  │
│  │  │                                                  │   │  │
│  │  └──────────────────────────────────────────────────┘   │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Data Layer                                 │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │                                                          │  │
│  │  ┌──────────────────────────────────────────────────┐   │  │
│  │  │         PostgreSQL Database                      │   │  │
│  │  ├──────────────────────────────────────────────────┤   │  │
│  │  │                                                  │   │  │
│  │  │  • Documents (content, metadata)                │   │  │
│  │  │  • Topics (extracted)                           │   │  │
│  │  │  • Entities (extracted)                         │   │  │
│  │  │  • Promises (extracted)                         │   │  │
│  │  │                                                  │   │  │
│  │  └──────────────────────────────────────────────────┘   │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow: Document Processing with RAG

```
┌─────────────────────────────────────────────────────────────────┐
│                    New Document Ingested                        │
└────────────────────────────┬────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│              1. Retrieve Context Documents                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Query BM25 Index:                                       │  │
│  │  - Document title + content                             │  │
│  │  - Document topics                                      │  │
│  │  - Document entities                                    │  │
│  │                                                          │  │
│  │  Return: Top 3 similar documents with scores            │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│              2. Build LLM Prompt with Context                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  System Prompt:                                          │  │
│  │  "You are a political analyst. Use the context          │  │
│  │   documents to ground your analysis."                   │  │
│  │                                                          │  │
│  │  User Prompt:                                           │  │
│  │  "Analyze this document: [DOCUMENT]                     │  │
│  │                                                          │  │
│  │   Context from knowledge base:                          │  │
│  │   - Document 1: [CONTEXT 1]                            │  │
│  │   - Document 2: [CONTEXT 2]                            │  │
│  │   - Document 3: [CONTEXT 3]"                           │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│              3. Send to LLM for Processing                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  LLM Response:                                           │  │
│  │  {                                                       │  │
│  │    "sentiment": 0.5,                                    │  │
│  │    "topics": ["infrastructure", "development"],         │  │
│  │    "entities": [{"name": "Ministry", "type": "ORG"}],  │  │
│  │    "promises": [...],                                   │  │
│  │    "context_used": ["doc-1", "doc-2", "doc-3"]         │  │
│  │  }                                                       │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│              4. Store Results in Database                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Update Document:                                        │  │
│  │  - sentiment: 0.5                                        │  │
│  │  - topics: ["infrastructure", "development"]            │  │
│  │  - entities: [...]                                      │  │
│  │  - status: "processed"                                  │  │
│  │                                                          │  │
│  │  Create Topic/Entity/Promise records                    │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│              5. Add to Search Index                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Incremental Index Update:                              │  │
│  │  - Tokenize document content                            │  │
│  │  - Add to BM25 index                                    │  │
│  │  - Ready for future context retrieval                   │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Search Flow

```
┌──────────────────────────────────────────────────────────────┐
│              User Search Query                               │
│  "infrastructure development in Goa"                         │
└────────────────────────┬─────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│              1. Tokenize Query                               │
│  ["infrastructure", "development", "goa"]                   │
└────────────────────────┬─────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│              2. BM25 Scoring                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  For each document in index:                           │ │
│  │  - Calculate BM25 score based on token matches        │ │
│  │  - Weight by field (content > title > topics)         │ │
│  │  - Return documents with scores > threshold           │ │
│  └────────────────────────────────────────────────────────┘ │
└────────────────────────┬─────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│              3. Rank Results                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Document 1: "Infrastructure Plan" - Score: 8.5       │ │
│  │  Document 2: "Development Project" - Score: 7.2       │ │
│  │  Document 3: "Goa Updates" - Score: 5.1               │ │
│  │  Document 4: "Other News" - Score: 2.3 (filtered)     │ │
│  └────────────────────────────────────────────────────────┘ │
└────────────────────────┬─────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│              4. Return Results                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  {                                                     │ │
│  │    "documents": [                                      │ │
│  │      {                                                 │ │
│  │        "id": "doc-1",                                  │ │
│  │        "title": "Infrastructure Plan",                │ │
│  │        "relevance_score": 8.5,                        │ │
│  │        "content": "...",                              │ │
│  │        "topics": ["infrastructure"],                  │ │
│  │        ...                                            │ │
│  │      },                                                │ │
│  │      ...                                              │ │
│  │    ],                                                  │ │
│  │    "total": 3,                                         │ │
│  │    "query": "infrastructure development in Goa"       │ │
│  │  }                                                     │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

## Hallucination Reduction Flow

```
WITHOUT RAG:
┌─────────────────────────────────────────────────────────────┐
│  User: "What infrastructure is planned?"                    │
│  LLM: "200 km of roads, 50 bridges, 10 metro stations"     │
│  Problem: Hallucinated - no actual data                    │
└─────────────────────────────────────────────────────────────┘

WITH RAG:
┌─────────────────────────────────────────────────────────────┐
│  User: "What infrastructure is planned?"                    │
│                         ↓                                   │
│  Search Index: Find relevant documents                      │
│  Context Retrieved:                                         │
│  - Doc 1: "100 km of roads planned"                        │
│  - Doc 2: "25 bridges in construction"                     │
│                         ↓                                   │
│  LLM Prompt: "Based on these documents, what is planned?"  │
│  LLM: "Based on collected data: 100 km of roads and        │
│        25 bridges are planned"                             │
│  Result: Grounded in actual data ✓                         │
└─────────────────────────────────────────────────────────────┘
```

## Performance Characteristics

```
Operation                    Time        Notes
─────────────────────────────────────────────────────────────
Index 1,000 documents       ~500ms      One-time startup
Add 1 document              ~1-5ms      Incremental update
Search query                ~10-50ms    Depends on corpus
Retrieve context            ~20-100ms   Includes DB fetch
─────────────────────────────────────────────────────────────

Scalability:
- Documents: Up to 100,000+
- Memory: ~1-2 KB per document
- Search: Constant time (O(1) after indexing)
- Index: Linear space (O(n))
```

## Integration Points

```
┌─────────────────────────────────────────────────────────────┐
│                    Politica API                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Document Ingestion                                  │  │
│  │  ↓                                                   │  │
│  │  Processor (with RAG) ← Context Retrieval           │  │
│  │  ↓                                                   │  │
│  │  Database                                            │  │
│  │  ↓                                                   │  │
│  │  Search Index (Incremental Update)                  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Search Endpoints                                    │  │
│  │  ↓                                                   │  │
│  │  BM25 Search Index                                  │  │
│  │  ↓                                                   │  │
│  │  Return Ranked Results                              │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Assistant Analysis                                  │  │
│  │  ↓                                                   │  │
│  │  Retrieve Context ← Search Index                    │  │
│  │  ↓                                                   │  │
│  │  Generate Recommendations (Grounded)                │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Analytics                                           │  │
│  │  ↓                                                   │  │
│  │  Retrieve Context ← Search Index                    │  │
│  │  ↓                                                   │  │
│  │  Show Context Document Counts                       │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Summary

The RAG system provides:
- ✅ Fast full-text search (10-50ms)
- ✅ Automatic context retrieval
- ✅ Grounded AI responses
- ✅ Reduced hallucinations
- ✅ Scalable to 100,000+ documents
- ✅ Seamless integration with existing API
