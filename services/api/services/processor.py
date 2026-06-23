"""
AI processing pipeline for ingested documents.

Single LLM call per document extracts: topics, entities, sentiment, promises.
Results are written back to the Document and related tables.

Integrated with RAG (Retrieval-Augmented Generation) to ground AI responses in actual data.
"""
import json
import logging
import asyncio
from typing import Optional
from datetime import datetime

from sqlalchemy.orm import Session

from database import SessionLocal
from models.models import Document, Topic, Entity, Promise, generate_uuid
from llm import chat_completion, LLM_MODEL
from services.search import retrieve_context_for_document, add_document_to_index

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a political intelligence analyst specializing in Indian politics,
particularly Goa state politics. Analyze the given social media post and extract structured information.

You have access to relevant context documents from the knowledge base. Use them to:
1. Ground your analysis in actual collected data
2. Identify patterns and connections to existing topics/entities
3. Validate sentiment assessment against similar posts
4. Ensure promises are consistent with historical patterns

Return ONLY valid JSON (no markdown fences, no explanation) with this exact structure:
{
  "sentiment": <float -1.0 to 1.0, where -1.0=very negative, 0.0=neutral, 1.0=very positive>,
  "topics": [<list of 1-5 short topic strings, e.g. "infrastructure", "elections", "flood relief">],
  "entities": [
    {"name": "<entity name>", "type": "<PERSON|ORGANIZATION|LOCATION|EVENT|POLICY>"}
  ],
  "promises": [
    {
      "text": "<exact promise text from post>",
      "topic": "<topic category>",
      "entity": "<who made the promise>",
      "timeline": "<when, e.g. '3 months', '2024', null>",
      "region": "<location, e.g. 'Panaji', 'Goa', null>",
      "confidence": <float 0.0-1.0>
    }
  ],
  "context_used": [<list of doc IDs from context that informed this analysis>]
}

Rules:
- sentiment: assess overall political tone; score from -1.0 (very negative/criticism/failure) to 1.0 (very positive/progress/achievement), 0.0 is neutral
- topics: use concise lowercase English labels relevant to Indian politics
- entities: only extract clearly named entities; include politicians, parties (BJP, Congress, AAP, etc.), places in Goa
- promises: only include explicit commitments ("will build", "promise to", "committed to", "we will", "shall provide")
- If no promises exist, return empty array []
- Keep entity names clean and normalized (e.g. "Pramod Sawant" not "@pramodsawant_goa")
- Use context documents to validate and ground your analysis
- Include context_used field with IDs of documents that informed your analysis"""


def _build_prompt(doc: Document, db: Session, context_docs: list = None) -> str:
    """Build prompt with RAG context for document processing."""
    parts = [f"POST (platform: {doc.platform}):"]
    if doc.author:
        parts.append(f"Author: {doc.author}")
    if doc.author_handle:
        parts.append(f"Handle: {doc.author_handle}")
    parts.append(f"\nContent:\n{doc.content[:3000]}")

    # Include top comments if available (up to 5)
    if doc.comments:
        top_comments = sorted(doc.comments, key=lambda c: c.likes_count or 0, reverse=True)[:5]
        if top_comments:
            parts.append("\nTop comments:")
            for c in top_comments:
                author_label = c.author_handle or c.author or "unknown"
                parts.append(f"  @{author_label}: {c.content[:200]}")

    # Add RAG context from similar documents
    if context_docs is None:
        context_docs = retrieve_context_for_document(db, doc, top_k=3)
    
    if context_docs:
        parts.append("\n--- CONTEXT FROM KNOWLEDGE BASE ---")
        parts.append("Similar documents that may inform this analysis:")
        for ctx_doc in context_docs:
            parts.append(f"\nDocument: {ctx_doc['title']}")
            parts.append(f"Author: {ctx_doc['author']} ({ctx_doc['platform']})")
            parts.append(f"Sentiment: {ctx_doc['sentiment']}")
            parts.append(f"Topics: {', '.join(ctx_doc['topics']) if ctx_doc['topics'] else 'N/A'}")
            parts.append(f"Content: {ctx_doc['content']}")
        parts.append("--- END CONTEXT ---\n")

    return "\n".join(parts)


def _parse_llm_response(raw: str) -> dict:
    """Parse LLM JSON response, stripping markdown fences if present."""
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        # Remove first line (```json or ```) and last line (```)
        cleaned = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    return json.loads(cleaned)


async def process_document(document_id: str) -> bool:
    """
    Process a single document with the LLM and write results back to DB.
    Integrates RAG to ground analysis in actual data.
    Returns True on success, False on failure.
    """
    db: Session = SessionLocal()
    try:
        doc = db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            logger.error("Document %s not found", document_id)
            return False

        if doc.status == "processed":
            logger.info("Document %s already processed, skipping", document_id)
            return True

        # Mark as processing
        doc.status = "processing"
        db.commit()

        # Retrieve context documents for RAG
        context_docs = retrieve_context_for_document(db, doc, top_k=3)
        prompt_text = _build_prompt(doc, db, context_docs)

        try:
            raw_response = await chat_completion(
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt_text},
                ],
                model=LLM_MODEL,
                temperature=0.1,
                max_tokens=1200,
                json_mode=True,
            )
            result = _parse_llm_response(raw_response)
        except Exception as exc:
            logger.error("LLM call failed for document %s: %s", document_id, exc)
            doc.status = "failed"
            db.commit()
            return False

        _apply_results(db, doc, result)
        doc.status = "processed"
        db.commit()

        # Add document to search index for future RAG queries
        add_document_to_index(doc)

        logger.info(
            "Processed document %s: sentiment=%.2f topics=%s entities=%d promises=%d",
            document_id,
            doc.sentiment or 0,
            doc.topics,
            len(result.get("entities", [])),
            len(result.get("promises", [])),
        )
        return True

    except Exception as exc:
        logger.error("Unexpected error processing document %s: %s", document_id, exc)
        try:
            doc = db.query(Document).filter(Document.id == document_id).first()
            if doc:
                doc.status = "failed"
                db.commit()
        except Exception:
            pass
        return False
    finally:
        db.close()


def _apply_results(db: Session, doc: Document, result: dict) -> None:
    """Write LLM extraction results into the document and related tables."""
    # Sentiment
    raw_sentiment = result.get("sentiment")
    if isinstance(raw_sentiment, (int, float)):
        doc.sentiment = max(-1.0, min(1.0, float(raw_sentiment)))

    # Topics — store on document JSON field and upsert Topic rows
    raw_topics = result.get("topics") or []
    topic_names = [t for t in raw_topics if isinstance(t, str) and t.strip()][:5]
    doc.topics = topic_names

    for name in topic_names:
        name = name.strip().lower()
        existing_topic = db.query(Topic).filter(Topic.name == name).first()
        if existing_topic:
            existing_topic.document_count = (existing_topic.document_count or 0) + 1
        else:
            db.add(Topic(
                id=generate_uuid(),
                name=name,
                description=f"Auto-extracted topic from {doc.platform} posts",
                document_count=1,
            ))

    # Entities — store on document JSON field and upsert Entity rows
    raw_entities = result.get("entities") or []
    entity_names = []
    for ent in raw_entities:
        if not isinstance(ent, dict):
            continue
        name = (ent.get("name") or "").strip()
        ent_type = (ent.get("type") or "UNKNOWN").strip().upper()
        if not name:
            continue
        entity_names.append(name)
        existing_entity = db.query(Entity).filter(Entity.name == name).first()
        if existing_entity:
            existing_entity.mention_count = (existing_entity.mention_count or 0) + 1
        else:
            db.add(Entity(
                id=generate_uuid(),
                name=name,
                type=ent_type,
                mention_count=1,
            ))
    doc.entities = entity_names

    # Promises — insert new Promise rows
    raw_promises = result.get("promises") or []
    for p in raw_promises:
        if not isinstance(p, dict):
            continue
        text = (p.get("text") or "").strip()
        if not text:
            continue
        confidence = p.get("confidence")
        if not isinstance(confidence, (int, float)):
            confidence = 0.7
        db.add(Promise(
            id=generate_uuid(),
            document_id=doc.id,
            text=text,
            topic=(p.get("topic") or "general").strip(),
            entity=(p.get("entity") or doc.author or "unknown").strip(),
            timeline=p.get("timeline"),
            region=p.get("region"),
            confidence=max(0.0, min(1.0, float(confidence))),
            status="pending",
        ))


async def process_batch(document_ids: list[str], concurrency: int = 3) -> dict:
    """
    Process multiple documents concurrently.
    Returns summary: {"processed": N, "failed": M, "skipped": K}
    """
    semaphore = asyncio.Semaphore(concurrency)

    async def _guarded(doc_id: str) -> bool:
        async with semaphore:
            return await process_document(doc_id)

    results = await asyncio.gather(*[_guarded(did) for did in document_ids], return_exceptions=True)

    processed = sum(1 for r in results if r is True)
    failed = sum(1 for r in results if r is False or isinstance(r, Exception))
    return {"processed": processed, "failed": failed, "total": len(document_ids)}


def get_pending_document_ids(db: Session, limit: int = 50) -> list[str]:
    """Return IDs of documents with status='pending'."""
    docs = (
        db.query(Document.id)
        .filter(Document.status == "pending")
        .limit(limit)
        .all()
    )
    return [d.id for d in docs]
