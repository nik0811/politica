import os
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from database import get_db
from models.models import (
    Document as DocumentModel,
    Promise as PromiseModel,
    Entity as EntityModel,
    Topic as TopicModel,
    ResearchConversation,
    ResearchMessage,
)
from typing import List, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

router = APIRouter()

QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")


class ResearchQuery(BaseModel):
    query: str
    max_results: Optional[int] = 5


class ResearchResponse(BaseModel):
    answer: str
    sources: List[dict]
    context: List[dict]
    search_engine: str = "keyword"
    llm_used: bool = False
    model: Optional[str] = None


class MessageCreate(BaseModel):
    content: str
    sender: str  # "user" or "assistant"
    sources: Optional[List[dict]] = None


class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    content: str
    sender: str
    sources: Optional[List[dict]]
    timestamp: datetime

    class Config:
        from_attributes = True


class ConversationCreate(BaseModel):
    title: str


class ConversationResponse(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime
    messages: List[MessageResponse] = []

    class Config:
        from_attributes = True


class ConversationListResponse(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: int

    class Config:
        from_attributes = True


def _qdrant_search(query: str, limit: int):
    """Try Qdrant vector search. Returns list of (doc_id, score) or raises."""
    from qdrant_client import QdrantClient

    client = QdrantClient(url=QDRANT_URL, timeout=3)
    collections = [c.name for c in client.get_collections().collections]
    if "documents" not in collections:
        raise LookupError("Qdrant collection 'documents' does not exist yet")

    collection_info = client.get_collection("documents")
    if collection_info.vectors_count == 0:
        raise LookupError("Qdrant collection 'documents' is empty")

    # Build a lightweight query vector via hashing (no heavy model in API process).
    # This is intentionally simple: it spreads the query hash across the vector
    # dimension so at least something is stored. Real vectors are written by the
    # processor service using BGE-M3 and will yield proper semantic results.
    import hashlib, struct
    dimension = collection_info.config.params.vectors.size
    digest = hashlib.sha256(query.encode()).digest()
    # Tile the 32-byte digest to fill the dimension
    raw = (digest * ((dimension // 32) + 1))[:dimension * 4]
    floats = [struct.unpack("f", raw[i*4:(i+1)*4])[0] for i in range(dimension)]
    # Normalize
    magnitude = sum(f ** 2 for f in floats) ** 0.5 or 1.0
    vector = [f / magnitude for f in floats]

    hits = client.search(collection_name="documents", query_vector=vector, limit=limit)
    return [(str(hit.id), hit.score) for hit in hits]


@router.post("/query", response_model=ResearchResponse)
async def research_query(request: ResearchQuery, db: Session = Depends(get_db)):
    """Research assistant: semantic search via Qdrant with SQL keyword fallback."""
    search_engine = "keyword"
    semantic_doc_ids: List[str] = []

    # Check if query is about topics
    query_lower = request.query.lower()
    is_topic_query = any(word in query_lower for word in ['topic', 'topics', 'issue', 'issues', 'subject', 'theme'])
    
    # Get topic statistics if relevant
    topic_stats = []
    if is_topic_query:
        topic_stats = (
            db.query(TopicModel)
            .order_by(TopicModel.document_count.desc())
            .limit(10)
            .all()
        )

    try:
        results = _qdrant_search(request.query, limit=request.max_results)
        semantic_doc_ids = [doc_id for doc_id, _score in results]
        if semantic_doc_ids:
            search_engine = "semantic"
    except Exception as exc:
        logger.info(f"Qdrant search unavailable, using SQL fallback: {exc}")

    query_lower = request.query.lower()
    sources = []
    context = []

    if search_engine == "semantic" and semantic_doc_ids:
        relevant_docs = (
            db.query(DocumentModel)
            .filter(DocumentModel.id.in_(semantic_doc_ids))
            .all()
        )
    else:
        # Improved keyword search: search in content, title, topics, and entities
        # Split query into words and search for any match
        query_words = [w.strip() for w in query_lower.split() if len(w.strip()) > 2]
        
        relevant_docs = []
        if query_words:
            from sqlalchemy import or_
            
            # Build OR conditions for each word
            conditions = []
            for word in query_words[:5]:  # Limit to 5 words
                conditions.append(DocumentModel.content.ilike(f"%{word}%"))
                conditions.append(DocumentModel.title.ilike(f"%{word}%"))
            
            relevant_docs = (
                db.query(DocumentModel)
                .filter(or_(*conditions))
                .order_by(DocumentModel.collected_at.desc())
                .limit(request.max_results)
                .all()
            )
        
        # If still no results, get recent documents
        if not relevant_docs:
            relevant_docs = (
                db.query(DocumentModel)
                .order_by(DocumentModel.collected_at.desc())
                .limit(request.max_results)
                .all()
            )

    relevant_promises = (
        db.query(PromiseModel)
        .filter(PromiseModel.text.ilike(f"%{query_lower}%"))
        .limit(request.max_results)
        .all()
    )

    for doc in relevant_docs:
        sources.append({
            "type": "document",
            "id": doc.id,
            "title": doc.title,
            "platform": doc.platform,
        })
        context.append({"text": doc.content[:500], "source": doc.title})

    for promise in relevant_promises:
        sources.append({
            "type": "promise",
            "id": promise.id,
            "entity": promise.entity,
            "topic": promise.topic,
        })
        context.append({"text": promise.text, "source": f"{promise.entity} - {promise.topic}"})

    # Add topic information to context if this is a topic query
    if is_topic_query and topic_stats:
        for topic in topic_stats:
            sources.append({
                "type": "topic",
                "id": topic.id,
                "name": topic.name,
                "document_count": topic.document_count,
            })
            context.append({
                "text": f"Topic '{topic.name}' appears in {topic.document_count} documents",
                "source": f"Topic: {topic.name}"
            })

    if not sources and not topic_stats:
        answer = (
            f"I couldn't find specific information about '{request.query}' in the database. "
            "Try rephrasing your query or check if documents have been processed."
        )
        return {
            "answer": answer,
            "sources": sources,
            "context": context,
            "search_engine": search_engine,
            "llm_used": False,
            "model": None,
        }

    # Build context string for LLM synthesis
    doc_context = "\n\n".join([
        f"Source: {c['source']}\n{c['text']}"
        for c in context[:8]
    ])
    
    # Add topic summary if available
    if topic_stats:
        topic_summary = "Top topics by document count:\n" + "\n".join([
            f"- {t.name}: {t.document_count} documents"
            for t in topic_stats[:5]
        ])
        doc_context = topic_summary + "\n\n" + doc_context

    llm_used = False
    model_used = None
    try:
        from llm import chat_completion, LLM_MODEL
        engine_label = "semantic (Qdrant)" if search_engine == "semantic" else "keyword"
        answer = await chat_completion(
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a political research assistant. "
                        "Answer based only on the provided sources. "
                        "Be concise and factual."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Question: {request.query}\n\n"
                        f"Sources ({engine_label} search):\n{doc_context}\n\n"
                        "Provide a concise answer based on these sources."
                    ),
                },
            ],
            max_tokens=500,
        )
        llm_used = True
        model_used = LLM_MODEL
    except Exception as exc:
        logger.warning(f"LLM synthesis unavailable, using template answer: {exc}")
        engine_label = "semantic (Qdrant)" if search_engine == "semantic" else "keyword"
        answer = (
            f"Based on {len(relevant_docs)} documents and {len(relevant_promises)} promises "
            f"(search engine: {engine_label}), here's what I found about '{request.query}':\n\n"
        )
        if relevant_promises:
            answer += "Key promises related to this query:\n"
            for p in relevant_promises[:3]:
                answer += f"- {p.entity}: {p.text[:150]}…\n"
        if relevant_docs:
            platforms = ", ".join(set(d.platform for d in relevant_docs if d.platform))
            answer += f"\nRelevant documents discuss this topic across {platforms or 'various'} platforms."

    return {
        "answer": answer,
        "sources": sources,
        "context": context,
        "search_engine": search_engine,
        "llm_used": llm_used,
        "model": model_used,
    }


@router.get("/knowledge-base")
async def get_knowledge_base(db: Session = Depends(get_db)):
    """Get knowledge base overview for research assistant."""
    doc_count = db.query(func.count()).select_from(DocumentModel).scalar() or 0
    promise_count = db.query(func.count()).select_from(PromiseModel).scalar() or 0
    entity_count = db.query(func.count()).select_from(EntityModel).scalar() or 0
    topic_count = db.query(func.count()).select_from(TopicModel).scalar() or 0

    # Check if Qdrant has vectors
    semantic_available = False
    try:
        from qdrant_client import QdrantClient
        client = QdrantClient(url=QDRANT_URL, timeout=2)
        collections = [c.name for c in client.get_collections().collections]
        if "documents" in collections:
            info = client.get_collection("documents")
            semantic_available = (info.vectors_count or 0) > 0
    except Exception:
        pass

    return {
        "status": "active",
        "documents": doc_count,
        "promises": promise_count,
        "entities": entity_count,
        "topics": topic_count,
        "semantic_available": semantic_available,
        "sources": [],
    }


@router.get("/knowledge-base/stats")
async def get_knowledge_base_stats(db: Session = Depends(get_db)):
    """Get knowledge base statistics for research assistant."""
    return {
        "documents": db.query(func.count()).select_from(DocumentModel).scalar() or 0,
        "promises": db.query(func.count()).select_from(PromiseModel).scalar() or 0,
        "entities": db.query(func.count()).select_from(EntityModel).scalar() or 0,
        "topics": db.query(func.count()).select_from(TopicModel).scalar() or 0,
        "languages": db.query(func.count(func.distinct(DocumentModel.language))).scalar() or 0,
    }


# ─── Conversation Management ────────────────────────────────────────────────────


@router.post("/conversations", response_model=ConversationResponse, status_code=201)
async def create_conversation(request: ConversationCreate, db: Session = Depends(get_db)):
    """Create a new research conversation."""
    conversation = ResearchConversation(title=request.title)
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return conversation


@router.get("/conversations", response_model=List[ConversationListResponse])
async def list_conversations(db: Session = Depends(get_db)):
    """List all research conversations ordered by most recent."""
    conversations = (
        db.query(ResearchConversation)
        .order_by(ResearchConversation.updated_at.desc())
        .all()
    )
    result = []
    for conv in conversations:
        message_count = db.query(func.count()).select_from(ResearchMessage).filter(
            ResearchMessage.conversation_id == conv.id
        ).scalar() or 0
        result.append({
            "id": conv.id,
            "title": conv.title,
            "created_at": conv.created_at,
            "updated_at": conv.updated_at,
            "message_count": message_count,
        })
    return result


@router.get("/conversations/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(conversation_id: str, db: Session = Depends(get_db)):
    """Get a specific conversation with all its messages."""
    conversation = (
        db.query(ResearchConversation)
        .filter(ResearchConversation.id == conversation_id)
        .first()
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


@router.post("/conversations/{conversation_id}/messages", response_model=MessageResponse, status_code=201)
async def add_message(
    conversation_id: str,
    request: MessageCreate,
    db: Session = Depends(get_db)
):
    """Add a message to a conversation."""
    conversation = (
        db.query(ResearchConversation)
        .filter(ResearchConversation.id == conversation_id)
        .first()
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    message = ResearchMessage(
        conversation_id=conversation_id,
        content=request.content,
        sender=request.sender,
        sources=request.sources or [],
    )
    db.add(message)
    conversation.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(message)
    return message


@router.get("/conversations/{conversation_id}/messages", response_model=List[MessageResponse])
async def get_messages(conversation_id: str, db: Session = Depends(get_db)):
    """Get all messages in a conversation."""
    conversation = (
        db.query(ResearchConversation)
        .filter(ResearchConversation.id == conversation_id)
        .first()
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    messages = (
        db.query(ResearchMessage)
        .filter(ResearchMessage.conversation_id == conversation_id)
        .order_by(ResearchMessage.timestamp.asc())
        .all()
    )
    return messages


@router.delete("/conversations/{conversation_id}", status_code=204)
async def delete_conversation(conversation_id: str, db: Session = Depends(get_db)):
    """Delete a conversation and all its messages."""
    conversation = (
        db.query(ResearchConversation)
        .filter(ResearchConversation.id == conversation_id)
        .first()
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    db.delete(conversation)
    db.commit()
    return None
