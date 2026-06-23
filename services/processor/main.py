# Politica Processor Service - OCR & NLP Pipeline

import logging
from typing import Dict, Any, List, Optional
import asyncio
from datetime import datetime

from paddleocr import PaddleOCR
from langdetect import detect, detect_langs
import fasttext
from sentence_transformers import SentenceTransformer
import numpy as np
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class OCREngine:
    """Multilingual OCR using PaddleOCR"""
    
    def __init__(self):
        logger.info("Initializing OCR Engine...")
        # Support multiple languages
        self.ocr = PaddleOCR(
            use_angle_cls=True,
            lang='en',  # Primary language
            use_gpu=False,  # Set to True if GPU available
            show_log=False
        )
        # Additional language models
        self.ocr_hindi = PaddleOCR(lang='hi', use_gpu=False, show_log=False)
        self.ocr_multilang = PaddleOCR(lang='latin', use_gpu=False, show_log=False)
        logger.info("OCR Engine initialized")
    
    def extract_text(self, image_path: str, language: str = 'en') -> Dict[str, Any]:
        """Extract text from image with confidence scores"""
        try:
            # Select appropriate OCR model
            if language in ['hi', 'hindi']:
                ocr_model = self.ocr_hindi
            elif language in ['en', 'english']:
                ocr_model = self.ocr
            else:
                ocr_model = self.ocr_multilang
            
            result = ocr_model.ocr(image_path, cls=True)
            
            if not result or not result[0]:
                return {"text": "", "confidence": 0.0, "blocks": []}
            
            # Extract text blocks with confidence
            blocks = []
            full_text = []
            total_confidence = 0
            
            for line in result[0]:
                bbox = line[0]
                text = line[1][0]
                confidence = line[1][1]
                
                blocks.append({
                    "text": text,
                    "confidence": confidence,
                    "bbox": bbox
                })
                full_text.append(text)
                total_confidence += confidence
            
            avg_confidence = total_confidence / len(blocks) if blocks else 0
            
            return {
                "text": " ".join(full_text),
                "confidence": avg_confidence,
                "blocks": blocks,
                "block_count": len(blocks)
            }
        
        except Exception as e:
            logger.error(f"OCR extraction failed: {e}")
            return {"text": "", "confidence": 0.0, "blocks": [], "error": str(e)}


class LanguageDetector:
    """Language detection and script normalization"""
    
    def __init__(self):
        logger.info("Initializing Language Detector...")
        # FastText model for better Indian language support
        try:
            self.fasttext_model = fasttext.load_model('lid.176.bin')
            self.use_fasttext = True
        except:
            logger.warning("FastText model not found, using langdetect only")
            self.use_fasttext = False
        logger.info("Language Detector initialized")
    
    def detect_language(self, text: str) -> Dict[str, Any]:
        """Detect language with confidence"""
        if not text or len(text.strip()) < 10:
            return {"language": "unknown", "confidence": 0.0, "script": "unknown"}
        
        try:
            # Primary detection with langdetect
            langs = detect_langs(text)
            primary_lang = langs[0]
            
            # Fallback to fasttext if available
            if self.use_fasttext:
                ft_result = self.fasttext_model.predict(text.replace('\n', ' '))
                ft_lang = ft_result[0][0].replace('__label__', '')
                ft_conf = float(ft_result[1][0])
                
                # Use fasttext if more confident
                if ft_conf > primary_lang.prob:
                    primary_lang = type('obj', (object,), {
                        'lang': ft_lang,
                        'prob': ft_conf
                    })
            
            # Detect script
            script = self._detect_script(text)
            
            return {
                "language": primary_lang.lang,
                "confidence": primary_lang.prob,
                "script": script,
                "iso_code": self._to_iso_code(primary_lang.lang)
            }
        
        except Exception as e:
            logger.error(f"Language detection failed: {e}")
            return {"language": "unknown", "confidence": 0.0, "script": "unknown", "error": str(e)}
    
    def _detect_script(self, text: str) -> str:
        """Detect script type"""
        # Check for common scripts
        if any('\u0900' <= char <= '\u097F' for char in text):
            return "devanagari"
        elif any('\u0A00' <= char <= '\u0A7F' for char in text):
            return "gurmukhi"
        elif any('\u0B00' <= char <= '\u0B7F' for char in text):
            return "oriya"
        elif any('\u0C00' <= char <= '\u0C7F' for char in text):
            return "telugu"
        elif any('\u0D00' <= char <= '\u0D7F' for char in text):
            return "malayalam"
        elif any('\u0A80' <= char <= '\u0AFF' for char in text):
            return "gujarati"
        elif any('\u0B80' <= char <= '\u0BFF' for char in text):
            return "tamil"
        elif any('\u0C80' <= char <= '\u0CFF' for char in text):
            return "kannada"
        elif any('\u0980' <= char <= '\u09FF' for char in text):
            return "bengali"
        else:
            return "latin"
    
    def _to_iso_code(self, lang: str) -> str:
        """Convert language code to ISO 639-1"""
        mapping = {
            'en': 'en', 'hi': 'hi', 'bn': 'bn', 'te': 'te', 'ta': 'ta',
            'mr': 'mr', 'gu': 'gu', 'kn': 'kn', 'ml': 'ml', 'pa': 'pa',
            'ur': 'ur', 'or': 'or', 'as': 'as'
        }
        return mapping.get(lang, lang)


class EmbeddingEngine:
    """Generate embeddings using BGE-M3"""
    
    def __init__(self):
        logger.info("Initializing Embedding Engine...")
        # BGE-M3 for multilingual embeddings
        self.model = SentenceTransformer('BAAI/bge-m3')
        self.dimension = 1024  # BGE-M3 dimension
        
        # Initialize Qdrant client
        self.qdrant = QdrantClient(host="localhost", port=6333)
        self._ensure_collection()
        logger.info("Embedding Engine initialized")
    
    def _ensure_collection(self):
        """Create Qdrant collection if not exists"""
        try:
            collections = self.qdrant.get_collections().collections
            if not any(c.name == "documents" for c in collections):
                self.qdrant.create_collection(
                    collection_name="documents",
                    vectors_config=VectorParams(
                        size=self.dimension,
                        distance=Distance.COSINE
                    )
                )
                logger.info("Created Qdrant collection: documents")
        except Exception as e:
            logger.error(f"Failed to create Qdrant collection: {e}")
    
    def generate_embedding(self, text: str) -> np.ndarray:
        """Generate embedding vector for text"""
        try:
            embedding = self.model.encode(text, normalize_embeddings=True)
            return embedding
        except Exception as e:
            logger.error(f"Embedding generation failed: {e}")
            return np.zeros(self.dimension)
    
    def store_embedding(self, doc_id: str, text: str, metadata: Dict[str, Any]) -> bool:
        """Store document embedding in Qdrant"""
        try:
            embedding = self.generate_embedding(text)
            
            self.qdrant.upsert(
                collection_name="documents",
                points=[
                    PointStruct(
                        id=doc_id,
                        vector=embedding.tolist(),
                        payload={
                            "text": text[:1000],  # Store preview
                            "metadata": metadata,
                            "timestamp": datetime.utcnow().isoformat()
                        }
                    )
                ]
            )
            logger.info(f"Stored embedding for document: {doc_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to store embedding: {e}")
            return False
    
    def search_similar(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Search for similar documents"""
        try:
            query_embedding = self.generate_embedding(query)
            
            results = self.qdrant.search(
                collection_name="documents",
                query_vector=query_embedding.tolist(),
                limit=limit
            )
            
            return [
                {
                    "id": hit.id,
                    "score": hit.score,
                    "text": hit.payload.get("text", ""),
                    "metadata": hit.payload.get("metadata", {})
                }
                for hit in results
            ]
        except Exception as e:
            logger.error(f"Vector search failed: {e}")
            return []


class DocumentProcessor:
    """Main document processing orchestrator"""
    
    def __init__(self):
        logger.info("Initializing Document Processor...")
        self.ocr = OCREngine()
        self.lang_detector = LanguageDetector()
        self.embeddings = EmbeddingEngine()
        logger.info("Document Processor ready")
    
    async def process_document(self, doc_id: str, content: str, image_paths: List[str] = None) -> Dict[str, Any]:
        """Process a document through the full pipeline"""
        logger.info(f"Processing document: {doc_id}")
        
        result = {
            "doc_id": doc_id,
            "text": content,
            "language": {},
            "ocr_results": [],
            "embedding_stored": False,
            "processed_at": datetime.utcnow().isoformat()
        }
        
        try:
            # Step 1: OCR if images provided
            if image_paths:
                ocr_texts = []
                for img_path in image_paths:
                    ocr_result = self.ocr.extract_text(img_path)
                    if ocr_result["text"]:
                        ocr_texts.append(ocr_result["text"])
                        result["ocr_results"].append(ocr_result)
                
                # Append OCR text to content
                if ocr_texts:
                    result["text"] = content + "\n\n" + "\n".join(ocr_texts)
            
            # Step 2: Language Detection
            result["language"] = self.lang_detector.detect_language(result["text"])
            
            # Step 3: Generate and store embeddings
            embedding_stored = self.embeddings.store_embedding(
                doc_id=doc_id,
                text=result["text"],
                metadata={
                    "language": result["language"]["language"],
                    "confidence": result["language"]["confidence"],
                    "has_ocr": bool(image_paths)
                }
            )
            result["embedding_stored"] = embedding_stored
            
            logger.info(f"Document processed successfully: {doc_id}")
            return result
        
        except Exception as e:
            logger.error(f"Document processing failed: {e}")
            result["error"] = str(e)
            return result


# Initialize global processor instance
processor = DocumentProcessor()


if __name__ == "__main__":
    # Test the processor
    test_text = "नमस्ते, यह एक टेस्ट डॉक्यूमेंट है। This is a test document in Hindi and English."
    
    async def test():
        result = await processor.process_document(
            doc_id="test_001",
            content=test_text
        )
        print("Processing Result:", result)
    
    asyncio.run(test())
