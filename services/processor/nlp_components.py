# NLP Components - NER, Sentiment, Topics

import logging
from typing import Dict, Any, List, Optional, Tuple
import spacy
from transformers import pipeline, AutoTokenizer, AutoModelForSequenceClassification
import torch
from collections import defaultdict
import re

logger = logging.getLogger(__name__)


class EntityExtractor:
    """Named Entity Recognition with multilingual support"""
    
    def __init__(self):
        logger.info("Initializing Entity Extractor...")
        # Load spaCy models for different languages
        try:
            self.nlp_en = spacy.load("en_core_web_lg")
            self.nlp_hi = None  # Will load on demand
            logger.info("Loaded English NER model")
        except:
            logger.warning("spaCy models not found, downloading...")
            import subprocess
            subprocess.run(["python", "-m", "spacy", "download", "en_core_web_lg"])
            self.nlp_en = spacy.load("en_core_web_lg")
        
        # Gazetteer for Indian political entities
        self.gazetteer = self._load_gazetteer()
        logger.info("Entity Extractor initialized")
    
    def _load_gazetteer(self) -> Dict[str, List[str]]:
        """Load political entities gazetteer"""
        return {
            "PERSON": [
                "Narendra Modi", "Rahul Gandhi", "Arvind Kejriwal",
                "Mamata Banerjee", "Amit Shah", "Priyanka Gandhi",
                "Yogi Adityanath", "MK Stalin", "Pinarayi Vijayan"
            ],
            "ORGANIZATION": [
                "BJP", "Congress", "AAP", "TMC", "DMK", "SP",
                "BSP", "JDU", "RJD", "Shiv Sena", "NCP"
            ],
            "LOCATION": [
                "Delhi", "Mumbai", "Kolkata", "Chennai", "Bangalore",
                "Hyderabad", "Ahmedabad", "Pune", "Jaipur", "Lucknow",
                "Gujarat", "Maharashtra", "Tamil Nadu", "Karnataka",
                "West Bengal", "Uttar Pradesh", "Bihar", "Rajasthan"
            ],
            "POLICY": [
                "GST", "Ayushman Bharat", "PM-KISAN", "MGNREGA",
                "Digital India", "Make in India", "Skill India",
                "Smart City Mission", "Swachh Bharat", "Beti Bachao Beti Padhao"
            ]
        }
    
    def extract_entities(self, text: str, language: str = "en") -> List[Dict[str, Any]]:
        """Extract named entities from text"""
        entities = []
        
        try:
            # Use appropriate NLP model
            if language == "en":
                doc = self.nlp_en(text)
            else:
                # Fallback to English model for other languages
                doc = self.nlp_en(text)
            
            # Extract entities from spaCy
            for ent in doc.ents:
                entities.append({
                    "text": ent.text,
                    "type": ent.label_,
                    "start": ent.start_char,
                    "end": ent.end_char,
                    "source": "spacy"
                })
            
            # Augment with gazetteer matches
            for entity_type, entity_list in self.gazetteer.items():
                for entity_name in entity_list:
                    # Case-insensitive search
                    pattern = re.compile(re.escape(entity_name), re.IGNORECASE)
                    for match in pattern.finditer(text):
                        # Avoid duplicates
                        if not any(e["text"].lower() == entity_name.lower() for e in entities):
                            entities.append({
                                "text": entity_name,
                                "type": entity_type,
                                "start": match.start(),
                                "end": match.end(),
                                "source": "gazetteer"
                            })
            
            # Deduplicate and sort by position
            unique_entities = []
            seen = set()
            for ent in sorted(entities, key=lambda x: x["start"]):
                key = (ent["text"].lower(), ent["type"])
                if key not in seen:
                    seen.add(key)
                    unique_entities.append(ent)
            
            logger.info(f"Extracted {len(unique_entities)} entities")
            return unique_entities
        
        except Exception as e:
            logger.error(f"Entity extraction failed: {e}")
            return []


class SentimentAnalyzer:
    """Multilingual sentiment analysis"""
    
    def __init__(self):
        logger.info("Initializing Sentiment Analyzer...")
        # Use multilingual sentiment model
        self.model_name = "cardiffnlp/twitter-xlm-roberta-base-sentiment"
        self.tokenizer = AutoTokenizer.from_pretrained(self.model_name)
        self.model = AutoModelForSequenceClassification.from_pretrained(self.model_name)
        self.classifier = pipeline(
            "sentiment-analysis",
            model=self.model,
            tokenizer=self.tokenizer,
            device=-1  # CPU, use 0 for GPU
        )
        logger.info("Sentiment Analyzer initialized")
    
    def analyze_sentiment(self, text: str) -> Dict[str, Any]:
        """Analyze sentiment of text"""
        try:
            # Truncate if too long
            max_length = 512
            if len(text) > max_length:
                text = text[:max_length]
            
            result = self.classifier(text)[0]
            
            # Convert to unified format
            label_map = {
                "positive": 1.0,
                "neutral": 0.0,
                "negative": -1.0
            }
            
            sentiment_value = label_map.get(result["label"].lower(), 0.0)
            
            return {
                "label": result["label"],
                "score": sentiment_value,
                "confidence": result["score"],
                "analysis": self._detailed_analysis(text)
            }
        
        except Exception as e:
            logger.error(f"Sentiment analysis failed: {e}")
            return {
                "label": "neutral",
                "score": 0.0,
                "confidence": 0.0,
                "error": str(e)
            }
    
    def _detailed_analysis(self, text: str) -> Dict[str, Any]:
        """Detailed sentiment analysis"""
        # Count positive/negative indicators
        positive_words = [
            "good", "great", "excellent", "improve", "benefit", "success",
            "अच्छा", "बेहतर", "सफल", "लाभ"
        ]
        negative_words = [
            "bad", "poor", "fail", "problem", "crisis", "corrupt",
            "बुरा", "खराब", "समस्या", "संकट"
        ]
        
        text_lower = text.lower()
        positive_count = sum(1 for word in positive_words if word in text_lower)
        negative_count = sum(1 for word in negative_words if word in text_lower)
        
        return {
            "positive_indicators": positive_count,
            "negative_indicators": negative_count,
            "word_count": len(text.split())
        }


class TopicClassifier:
    """Hierarchical topic classification"""
    
    def __init__(self):
        logger.info("Initializing Topic Classifier...")
        self.topics = self._load_topic_taxonomy()
        # Use zero-shot classification for flexible topics
        self.classifier = pipeline(
            "zero-shot-classification",
            model="facebook/bart-large-mnli",
            device=-1
        )
        logger.info("Topic Classifier initialized")
    
    def _load_topic_taxonomy(self) -> Dict[str, List[str]]:
        """Load hierarchical topic taxonomy"""
        return {
            "Politics": ["Elections", "Government Policy", "Legislation", "Political Parties"],
            "Economy": ["Budget", "GST", "Employment", "GDP", "Inflation", "Trade"],
            "Infrastructure": ["Roads", "Railways", "Airports", "Metro", "Smart Cities"],
            "Education": ["Schools", "Universities", "Skill Development", "Literacy"],
            "Healthcare": ["Hospitals", "Insurance", "Vaccination", "Ayushman Bharat"],
            "Agriculture": ["MSP", "Farmer Welfare", "Irrigation", "Crop Insurance"],
            "Social Welfare": ["Poverty", "Housing", "Women Empowerment", "Child Welfare"],
            "Environment": ["Climate Change", "Pollution", "Renewable Energy", "Conservation"],
            "Technology": ["Digital India", "Startups", "AI", "Cybersecurity"],
            "Defence": ["Military", "Border Security", "Defence Procurement"],
            "Foreign Policy": ["Diplomacy", "Trade Relations", "International Cooperation"]
        }
    
    def classify_topics(self, text: str, top_k: int = 3) -> List[Dict[str, Any]]:
        """Classify text into topics"""
        try:
            # Get all topic labels (including sub-topics)
            all_topics = []
            for parent, subtopics in self.topics.items():
                all_topics.append(parent)
                all_topics.extend(subtopics)
            
            # Truncate text
            max_length = 512
            if len(text) > max_length:
                text = text[:max_length]
            
            # Classify
            result = self.classifier(
                text,
                candidate_labels=all_topics,
                multi_label=True
            )
            
            # Get top K topics
            topics = []
            for i in range(min(top_k, len(result["labels"]))):
                topic_label = result["labels"][i]
                topic_score = result["scores"][i]
                
                # Find parent topic
                parent = self._find_parent_topic(topic_label)
                
                topics.append({
                    "topic": topic_label,
                    "parent": parent,
                    "confidence": topic_score,
                    "hierarchical_path": f"{parent}/{topic_label}" if parent != topic_label else topic_label
                })
            
            logger.info(f"Classified into {len(topics)} topics")
            return topics
        
        except Exception as e:
            logger.error(f"Topic classification failed: {e}")
            return []
    
    def _find_parent_topic(self, topic: str) -> str:
        """Find parent topic for a given topic"""
        for parent, subtopics in self.topics.items():
            if topic == parent or topic in subtopics:
                return parent
        return topic  # Return self if no parent found


# Initialize global instances
entity_extractor = EntityExtractor()
sentiment_analyzer = SentimentAnalyzer()
topic_classifier = TopicClassifier()


if __name__ == "__main__":
    # Test
    test_text = """
    Prime Minister Narendra Modi announced a new healthcare scheme for farmers in Gujarat.
    The BJP government will provide free health insurance under Ayushman Bharat.
    """
    
    print("Entities:", entity_extractor.extract_entities(test_text))
    print("Sentiment:", sentiment_analyzer.analyze_sentiment(test_text))
    print("Topics:", topic_classifier.classify_topics(test_text))
