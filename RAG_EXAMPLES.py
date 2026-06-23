"""
RAG API Usage Examples

This file demonstrates how to use the new RAG-powered search endpoints
and how RAG is integrated into the existing API.
"""

# ─── Example 1: Search Documents by Query ───

import requests

# Search for infrastructure-related documents
response = requests.post(
    "http://localhost:8000/api/search/bm25/documents",
    params={
        "q": "infrastructure roads bridges",
        "top_k": 5,
        "min_score": 0.1
    },
    headers={"Authorization": "Bearer YOUR_TOKEN"}
)

results = response.json()
print(f"Found {results['total']} documents:")
for doc in results['documents']:
    print(f"  - {doc['title']} (relevance: {doc['relevance_score']})")
    print(f"    Author: {doc['author']} ({doc['platform']})")
    print(f"    Sentiment: {doc['sentiment']}")
    print(f"    Topics: {', '.join(doc['topics'])}")
    print()


# ─── Example 2: Search by Topic ───

# Find all documents about elections
response = requests.post(
    "http://localhost:8000/api/search/bm25/topics",
    params={
        "topic": "elections",
        "top_k": 10,
        "min_score": 0.1
    },
    headers={"Authorization": "Bearer YOUR_TOKEN"}
)

results = response.json()
print(f"Documents about {results['topic']}:")
for doc in results['documents']:
    print(f"  - {doc['title']}")


# ─── Example 3: Search by Entity ───

# Find all documents mentioning a specific politician
response = requests.post(
    "http://localhost:8000/api/search/bm25/entities",
    params={
        "entity": "Pramod Sawant",
        "top_k": 10
    },
    headers={"Authorization": "Bearer YOUR_TOKEN"}
)

results = response.json()
print(f"Documents mentioning {results['entity']}:")
for doc in results['documents']:
    print(f"  - {doc['title']} ({doc['platform']})")


# ─── Example 4: Get Analysis with RAG Context ───

# Get analysis that uses RAG to ground recommendations
response = requests.post(
    "http://localhost:8000/api/assistant/analyze",
    headers={"Authorization": "Bearer YOUR_TOKEN"}
)

analysis = response.json()
print(f"Analysis of {analysis['total_documents']} documents:")
print(f"Topics analyzed: {analysis['topics_analyzed']}")
print()

for recommendation in analysis['recommendations'][:5]:
    print(f"Topic: {recommendation['topic_name']}")
    print(f"Importance: {recommendation['importance_score']}/100")
    print(f"Suggested Action: {recommendation['suggested_action']}")
    print(f"Reasoning: {recommendation['reasoning']}")
    print()


# ─── Example 5: Get Engagement with Context ───

# Get engagement metrics that include context document counts
response = requests.get(
    "http://localhost:8000/api/analytics/engagement",
    headers={"Authorization": "Bearer YOUR_TOKEN"}
)

engagement = response.json()
print("Top Posts with Context:")
for post in engagement['top_posts'][:5]:
    print(f"  - {post['title']}")
    print(f"    Author: {post['author']}")
    print(f"    Engagement: {post['total_engagement']}")
    print(f"    Related Documents: {post.get('context_documents', 0)}")
    print()


# ─── Example 6: Using RAG in Your Application ───

class PoliticalAnalyzer:
    """Example class showing how to use RAG in your application."""
    
    def __init__(self, api_url: str, token: str):
        self.api_url = api_url
        self.token = token
        self.headers = {"Authorization": f"Bearer {token}"}
    
    def analyze_topic(self, topic: str, top_k: int = 5):
        """Analyze a topic using RAG-grounded search."""
        # Search for documents about the topic
        response = requests.post(
            f"{self.api_url}/api/search/bm25/topics",
            params={"topic": topic, "top_k": top_k},
            headers=self.headers
        )
        
        documents = response.json()['documents']
        
        # Analyze the retrieved documents
        analysis = {
            "topic": topic,
            "document_count": len(documents),
            "average_sentiment": sum(d['sentiment'] for d in documents) / len(documents),
            "platforms": list(set(d['platform'] for d in documents)),
            "key_entities": list(set(
                entity for doc in documents for entity in doc['entities']
            )),
            "documents": documents
        }
        
        return analysis
    
    def find_related_documents(self, query: str, min_relevance: float = 0.1):
        """Find documents related to a query."""
        response = requests.post(
            f"{self.api_url}/api/search/bm25/documents",
            params={
                "q": query,
                "top_k": 10,
                "min_score": min_relevance
            },
            headers=self.headers
        )
        
        return response.json()['documents']
    
    def get_entity_mentions(self, entity: str):
        """Get all documents mentioning an entity."""
        response = requests.post(
            f"{self.api_url}/api/search/bm25/entities",
            params={"entity": entity, "top_k": 20},
            headers=self.headers
        )
        
        return response.json()['documents']


# Usage
analyzer = PoliticalAnalyzer("http://localhost:8000", "YOUR_TOKEN")

# Analyze elections topic
elections_analysis = analyzer.analyze_topic("elections")
print(f"Elections Analysis:")
print(f"  Documents: {elections_analysis['document_count']}")
print(f"  Average Sentiment: {elections_analysis['average_sentiment']:.2f}")
print(f"  Platforms: {', '.join(elections_analysis['platforms'])}")
print()

# Find related documents
related = analyzer.find_related_documents("infrastructure development")
print(f"Found {len(related)} documents about infrastructure development")
print()

# Get entity mentions
mentions = analyzer.get_entity_mentions("Pramod Sawant")
print(f"Found {len(mentions)} documents mentioning Pramod Sawant")


# ─── Example 7: Advanced Search with Filtering ───

def search_with_sentiment_filter(query: str, min_sentiment: float = 0.0):
    """Search documents and filter by sentiment."""
    response = requests.post(
        "http://localhost:8000/api/search/bm25/documents",
        params={"q": query, "top_k": 20},
        headers={"Authorization": "Bearer YOUR_TOKEN"}
    )
    
    documents = response.json()['documents']
    
    # Filter by sentiment
    filtered = [d for d in documents if d['sentiment'] >= min_sentiment]
    
    return filtered


# Find positive documents about infrastructure
positive_docs = search_with_sentiment_filter("infrastructure", min_sentiment=0.3)
print(f"Found {len(positive_docs)} positive documents about infrastructure")


# ─── Example 8: Building a Search UI ───

def format_search_results(results: dict) -> str:
    """Format search results for display."""
    output = f"Search Results for: {results['query']}\n"
    output += f"Total: {results['total']} documents\n"
    output += f"Engine: {results['search_engine']}\n\n"
    
    for i, doc in enumerate(results['documents'], 1):
        output += f"{i}. {doc['title']}\n"
        output += f"   Author: {doc['author']} ({doc['platform']})\n"
        output += f"   Relevance: {doc['relevance_score']:.2f}\n"
        output += f"   Sentiment: {doc['sentiment']:.2f}\n"
        output += f"   Topics: {', '.join(doc['topics'])}\n"
        output += f"   Preview: {doc['content'][:100]}...\n\n"
    
    return output


# ─── Example 9: Batch Processing ───

def batch_search(queries: list[str]) -> dict:
    """Search multiple queries and aggregate results."""
    all_results = {}
    
    for query in queries:
        response = requests.post(
            "http://localhost:8000/api/search/bm25/documents",
            params={"q": query, "top_k": 5},
            headers={"Authorization": "Bearer YOUR_TOKEN"}
        )
        all_results[query] = response.json()['documents']
    
    return all_results


# Search multiple topics
queries = ["infrastructure", "elections", "education"]
results = batch_search(queries)

for query, docs in results.items():
    print(f"{query}: {len(docs)} documents found")


# ─── Example 10: Monitoring Search Quality ───

def evaluate_search_quality(query: str, expected_topics: list[str]) -> float:
    """Evaluate search quality by checking if results match expected topics."""
    response = requests.post(
        "http://localhost:8000/api/search/bm25/documents",
        params={"q": query, "top_k": 10},
        headers={"Authorization": "Bearer YOUR_TOKEN"}
    )
    
    documents = response.json()['documents']
    
    # Check how many results have expected topics
    matches = 0
    for doc in documents:
        if any(topic in expected_topics for topic in doc['topics']):
            matches += 1
    
    quality_score = matches / len(documents) if documents else 0
    return quality_score


# Evaluate search quality
quality = evaluate_search_quality(
    "infrastructure development",
    expected_topics=["infrastructure", "development", "construction"]
)
print(f"Search quality score: {quality:.2%}")


# ─── Example 11: Integration with LLM Processing ───

def process_document_with_rag(doc_id: str, api_url: str, token: str):
    """
    Example of how RAG is used internally during document processing.
    
    This is what happens automatically when a document is processed:
    1. Retrieve context documents
    2. Include context in LLM prompt
    3. LLM processes with grounded context
    4. Results are stored
    """
    
    # This is handled automatically by the processor
    # But here's what happens internally:
    
    # 1. Get the document
    response = requests.get(
        f"{api_url}/api/documents/{doc_id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    document = response.json()
    
    # 2. Search for context documents
    context_response = requests.post(
        f"{api_url}/api/search/bm25/documents",
        params={
            "q": f"{document['title']} {document['content'][:100]}",
            "top_k": 3
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    context_docs = context_response.json()['documents']
    
    # 3. Build prompt with context
    prompt = f"""
    Analyze this document:
    Title: {document['title']}
    Content: {document['content']}
    
    Context from similar documents:
    """
    
    for ctx_doc in context_docs:
        prompt += f"\n- {ctx_doc['title']}: {ctx_doc['content'][:100]}"
    
    # 4. Send to LLM (this is done by the processor)
    # The LLM uses this context to ground its analysis
    
    return {
        "document_id": doc_id,
        "context_documents": len(context_docs),
        "prompt": prompt
    }


# ─── Example 12: Performance Monitoring ───

import time

def measure_search_performance(query: str, iterations: int = 10):
    """Measure search performance."""
    times = []
    
    for _ in range(iterations):
        start = time.time()
        
        requests.post(
            "http://localhost:8000/api/search/bm25/documents",
            params={"q": query, "top_k": 5},
            headers={"Authorization": "Bearer YOUR_TOKEN"}
        )
        
        elapsed = time.time() - start
        times.append(elapsed * 1000)  # Convert to ms
    
    avg_time = sum(times) / len(times)
    min_time = min(times)
    max_time = max(times)
    
    print(f"Search Performance for '{query}':")
    print(f"  Average: {avg_time:.2f}ms")
    print(f"  Min: {min_time:.2f}ms")
    print(f"  Max: {max_time:.2f}ms")
    
    return {
        "average": avg_time,
        "min": min_time,
        "max": max_time
    }


# Measure performance
measure_search_performance("infrastructure")


# ─── Summary ───

"""
Key Takeaways:

1. RAG Search Endpoints:
   - POST /api/search/bm25/documents - Search by query
   - POST /api/search/bm25/topics - Search by topic
   - POST /api/search/bm25/entities - Search by entity

2. RAG Integration:
   - Automatic context retrieval during document processing
   - Grounded analysis in assistant endpoints
   - Context-aware engagement metrics

3. Benefits:
   - Reduced hallucinations
   - Grounded AI responses
   - Fast search performance
   - Relevance scoring

4. Usage:
   - Use search endpoints to find relevant documents
   - Integrate with your application
   - Monitor search quality
   - Measure performance

For more information, see:
- RAG_IMPLEMENTATION.md - Full technical documentation
- RAG_QUICK_START.md - Quick start guide
- tests/test_rag.py - Test examples
"""
