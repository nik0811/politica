# Promise Extraction & Advanced Search

import logging
import os
from typing import Dict, Any, List, Optional
import litellm
import re
from elasticsearch import Elasticsearch
from datetime import datetime
import json

logger = logging.getLogger(__name__)

LLM_MODEL = os.getenv("LLM_MODEL", "ollama/llama3.2")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
litellm.set_verbose = False
litellm.ollama_base_url = OLLAMA_BASE_URL


class PromiseExtractor:
    """LLM-based promise extraction with structured output"""
    
    def __init__(self, api_key: Optional[str] = None):
        logger.info("Initializing Promise Extractor...")
        # api_key param kept for backwards-compat; LiteLLM reads env vars directly
        self.use_llm = True
        logger.info("Promise Extractor initialized")
    
    def extract_promises(self, text: str, entities: List[Dict], context: Dict = None) -> List[Dict[str, Any]]:
        """Extract political promises from text"""
        try:
            if self.use_llm:
                return self._extract_with_llm(text, entities, context)
            return self._extract_with_patterns(text, entities)
        except Exception as e:
            logger.error(f"Promise extraction failed: {e}")
            return []
    
    def _extract_with_llm(self, text: str, entities: List[Dict], context: Dict) -> List[Dict[str, Any]]:
        """Extract promises using LiteLLM (Ollama / OpenAI / Bedrock)"""
        prompt = f"""
        Extract political promises from the following text. For each promise, identify:
        1. The exact promise text
        2. Who made the promise (person or organization)
        3. What is being promised (specific action/benefit)
        4. When it will be delivered (timeline)
        5. Where it applies (region/location)
        6. Quantifiable metrics if any (numbers, percentages)
        
        Text: {text}
        
        Known entities: {[e['text'] for e in entities if e['type'] in ['PERSON', 'ORGANIZATION']]}
        
        Return as JSON array with format:
        [{{
            "promise_text": "...",
            "entity": "...",
            "action": "...",
            "beneficiary": "...",
            "quantity": number or null,
            "unit": "...",
            "timeline": "...",
            "region": "...",
            "confidence": 0.0-1.0
        }}]
        """
        
        response = litellm.completion(
            model=LLM_MODEL,
            messages=[
                {"role": "system", "content": "You are an expert at extracting political promises from text. Always respond with valid JSON only."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.1,
            max_tokens=2000,
        )
        
        result_text = response.choices[0].message.content
        # Strip markdown fences if present
        result_text = re.sub(r"^```(?:json)?\s*|\s*```$", "", result_text.strip())
        return json.loads(result_text)
    
    def _extract_with_patterns(self, text: str, entities: List[Dict]) -> List[Dict[str, Any]]:
        """Extract promises using pattern matching"""
        promises = []
        
        # Promise indicators
        promise_patterns = [
            r"will (build|create|provide|establish|launch|introduce|implement)\s+(.+?)(?:\.|,|by)",
            r"promise(?:s|d)? to\s+(.+?)(?:\.|,)",
            r"announced\s+(.+?)(plan|scheme|program|initiative)",
            r"committed to\s+(.+?)(?:\.|,)",
            r"pledge(?:s|d)? to\s+(.+?)(?:\.|,)"
        ]
        
        # Extract potential promises
        for pattern in promise_patterns:
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                promise_text = match.group(0)
                
                # Find associated entity
                entity_name = None
                for ent in entities:
                    if ent['type'] in ['PERSON', 'ORGANIZATION']:
                        # Check if entity appears before promise in nearby context
                        context_start = max(0, match.start() - 100)
                        context = text[context_start:match.start()]
                        if ent['text'] in context:
                            entity_name = ent['text']
                            break
                
                # Extract timeline
                timeline = self._extract_timeline(text[match.start():match.end() + 100])
                
                # Extract quantity
                quantity, unit = self._extract_quantity(promise_text)
                
                promises.append({
                    "promise_text": promise_text,
                    "entity": entity_name or "Unknown",
                    "action": match.group(1) if match.lastindex >= 1 else "unspecified",
                    "quantity": quantity,
                    "unit": unit,
                    "timeline": timeline,
                    "region": self._extract_region(text, entities),
                    "confidence": 0.7  # Pattern-based confidence
                })
        
        return promises
    
    def _extract_timeline(self, text: str) -> Optional[str]:
        """Extract timeline from text"""
        timeline_patterns = [
            r"by (\d{4})",
            r"in (\d+) (year|month|week)s?",
            r"within (\d+) (year|month|week)s?",
            r"(next|coming) (year|month|quarter)",
            r"(before|after) (\w+\s+\d{4})"
        ]
        
        for pattern in timeline_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(0)
        return None
    
    def _extract_quantity(self, text: str) -> Tuple[Optional[int], Optional[str]]:
        """Extract quantifiable metrics"""
        quantity_pattern = r"(\d+(?:,\d+)*)\s*(crore|lakh|thousand|million|billion|schools|hospitals|km|units)?"
        match = re.search(quantity_pattern, text, re.IGNORECASE)
        if match:
            quantity = int(match.group(1).replace(',', ''))
            unit = match.group(2) if match.group(2) else "units"
            return quantity, unit
        return None, None
    
    def _extract_region(self, text: str, entities: List[Dict]) -> Optional[str]:
        """Extract region/location"""
        for ent in entities:
            if ent['type'] == 'LOCATION' or ent['type'] == 'GPE':
                return ent['text']
        return None


class HybridSearch:
    """Hybrid search combining vector and full-text search"""
    
    def __init__(self):
        logger.info("Initializing Hybrid Search...")
        # Elasticsearch for full-text search
        self.es = Elasticsearch(
            ["http://localhost:9200"],
            basic_auth=("elastic", "changeme")
        )
        # Vector search is handled by Qdrant (initialized in embedding engine)
        self._ensure_index()
        logger.info("Hybrid Search initialized")
    
    def _ensure_index(self):
        """Create Elasticsearch index if not exists"""
        index_name = "documents"
        if not self.es.indices.exists(index=index_name):
            self.es.indices.create(
                index=index_name,
                body={
                    "settings": {
                        "number_of_shards": 1,
                        "number_of_replicas": 0,
                        "analysis": {
                            "analyzer": {
                                "multilingual": {
                                    "type": "standard",
                                    "stopwords": "_none_"
                                }
                            }
                        }
                    },
                    "mappings": {
                        "properties": {
                            "title": {"type": "text", "analyzer": "multilingual"},
                            "content": {"type": "text", "analyzer": "multilingual"},
                            "entities": {"type": "keyword"},
                            "topics": {"type": "keyword"},
                            "language": {"type": "keyword"},
                            "platform": {"type": "keyword"},
                            "created_at": {"type": "date"}
                        }
                    }
                }
            )
            logger.info("Created Elasticsearch index")
    
    def index_document(self, doc_id: str, document: Dict[str, Any]) -> bool:
        """Index document in Elasticsearch"""
        try:
            self.es.index(
                index="documents",
                id=doc_id,
                document=document
            )
            logger.info(f"Indexed document: {doc_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to index document: {e}")
            return False
    
    def search(
        self,
        query: str,
        filters: Dict[str, Any] = None,
        limit: int = 20,
        use_semantic: bool = True
    ) -> Dict[str, Any]:
        """Hybrid search combining full-text and vector search"""
        results = {
            "query": query,
            "fulltext_results": [],
            "semantic_results": [],
            "combined_results": [],
            "total": 0
        }
        
        try:
            # Full-text search with Elasticsearch
            es_query = {
                "query": {
                    "bool": {
                        "should": [
                            {"match": {"title": {"query": query, "boost": 2.0}}},
                            {"match": {"content": {"query": query}}}
                        ],
                        "filter": []
                    }
                },
                "size": limit
            }
            
            # Add filters
            if filters:
                if filters.get("platform"):
                    es_query["query"]["bool"]["filter"].append(
                        {"terms": {"platform": filters["platform"]}}
                    )
                if filters.get("language"):
                    es_query["query"]["bool"]["filter"].append(
                        {"terms": {"language": filters["language"]}}
                    )
            
            es_response = self.es.search(index="documents", body=es_query)
            
            for hit in es_response["hits"]["hits"]:
                results["fulltext_results"].append({
                    "id": hit["_id"],
                    "score": hit["_score"],
                    "source": hit["_source"]
                })
            
            # Combine with vector search results (from Qdrant)
            # This would integrate with the EmbeddingEngine's search_similar method
            
            # For now, use fulltext results as combined
            results["combined_results"] = results["fulltext_results"]
            results["total"] = len(results["combined_results"])
            
            logger.info(f"Found {results['total']} results for: {query}")
            return results
        
        except Exception as e:
            logger.error(f"Search failed: {e}")
            return results


# Initialize global instances
promise_extractor = PromiseExtractor()
hybrid_search = HybridSearch()


if __name__ == "__main__":
    # Test
    test_text = """
    Prime Minister Narendra Modi announced that the government will build 100 new schools
    in rural Gujarat by 2027. The BJP has promised to provide free laptops to 5 lakh students.
    """
    
    test_entities = [
        {"text": "Narendra Modi", "type": "PERSON"},
        {"text": "Gujarat", "type": "LOCATION"},
        {"text": "BJP", "type": "ORGANIZATION"}
    ]
    
    promises = promise_extractor.extract_promises(test_text, test_entities)
    print("Extracted Promises:", json.dumps(promises, indent=2))
