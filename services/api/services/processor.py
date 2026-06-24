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
from models.models import Document, Topic, Entity, Promise, PostComment, generate_uuid
from llm import chat_completion, LLM_MODEL
from services.search import retrieve_context_for_document, add_document_to_index

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a political intelligence analyst specializing in Indian politics,
particularly Goa state politics. Analyze the given social media post and extract structured information.

You have access to:
1. The full post content with ALL its comments/replies and engagement metrics (likes, shares, views)
2. Relevant context documents from the knowledge base (cross-platform: Instagram, Facebook, Twitter)

Use ALL available data to:
1. Ground your analysis in actual collected data — consider engagement signals (high views/shares = more impact)
2. Factor in public reaction from comments when assessing sentiment
3. Identify patterns and connections to existing topics/entities across platforms
4. Validate promises against historical patterns
5. Weight sentiment: a post with many negative comments should lean negative even if the post text is neutral

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
- sentiment: assess overall political tone including public reaction from comments; score from -1.0 (very negative/criticism/failure) to 1.0 (very positive/progress/achievement), 0.0 is neutral
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

    # Include video transcription when available — this is the actual spoken words from the video
    if getattr(doc, 'transcription', None):
        parts.append(f"\nVideo Transcription (spoken audio from the video):\n{doc.transcription[:5000]}")

    # Include engagement metrics
    engagement = []
    if doc.likes_count:   engagement.append(f"likes={doc.likes_count}")
    if doc.shares_count:  engagement.append(f"shares/retweets={doc.shares_count}")
    if doc.views_count:   engagement.append(f"views={doc.views_count}")
    if doc.comments_count: engagement.append(f"comments={doc.comments_count}")
    if doc.reactions_count: engagement.append(f"reactions={doc.reactions_count}")
    if engagement:
        parts.append(f"\nEngagement: {', '.join(engagement)}")

    # Include ALL comments/replies (up to 20, sorted by likes)
    if doc.comments:
        top_comments = sorted(doc.comments, key=lambda c: c.likes_count or 0, reverse=True)[:20]
        if top_comments:
            parts.append(f"\nComments/Replies ({len(doc.comments)} total, showing top {len(top_comments)}):")
            for c in top_comments:
                author_label = c.author_handle or c.author or "unknown"
                sentiment_label = f" [sentiment: {c.sentiment:.2f}]" if c.sentiment is not None else ""
                parts.append(f"  @{author_label}: {c.content[:300]}{sentiment_label}")

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


def get_pending_document_ids(db: Session, limit: int = 100) -> list[str]:
    """Return IDs of documents with status='pending' or 'failed' (retry failed ones)."""
    docs = (
        db.query(Document.id)
        .filter(Document.status.in_(["pending", "failed"]))
        .limit(limit)
        .all()
    )
    return [d.id for d in docs]


# ─── Comment Processing ─────────────────────────────────────────────────────────

COMMENT_SYSTEM_PROMPT = """You are a political sentiment analyst specializing in Indian politics.
Analyze the given social media comment and extract structured information.

Return ONLY valid JSON (no markdown fences, no explanation) with this exact structure:
{
  "sentiment": <float -1.0 to 1.0, where -1.0=very negative, 0.0=neutral, 1.0=very positive>,
  "sentiment_label": "<positive|negative|neutral>",
  "topics": [<list of 0-3 short topic strings if relevant>],
  "entities": [
    {"name": "<entity name>", "type": "<PERSON|ORGANIZATION|LOCATION>"}
  ]
}

Rules:
- sentiment: assess the comment's tone toward the subject matter
- sentiment_label: "positive" if sentiment > 0.3, "negative" if sentiment < -0.3, else "neutral"
- topics: only include if clearly relevant to a political topic
- entities: only extract clearly named politicians, parties, or places
- Keep responses concise - comments are short"""


async def process_comment(comment_id: str) -> bool:
    """
    Process a single comment with the LLM for sentiment analysis.
    Returns True on success, False on failure.
    """
    db: Session = SessionLocal()
    try:
        comment = db.query(PostComment).filter(PostComment.id == comment_id).first()
        if not comment:
            logger.error("Comment %s not found", comment_id)
            return False

        if comment.processed_at is not None:
            logger.info("Comment %s already processed, skipping", comment_id)
            return True

        # Build prompt
        prompt_text = f"Comment by @{comment.author_handle or comment.author or 'unknown'}:\n{comment.content[:500]}"

        try:
            raw_response = await chat_completion(
                messages=[
                    {"role": "system", "content": COMMENT_SYSTEM_PROMPT},
                    {"role": "user", "content": prompt_text},
                ],
                model=LLM_MODEL,
                temperature=0.1,
                max_tokens=300,
                json_mode=True,
            )
            result = _parse_llm_response(raw_response)
        except Exception as exc:
            logger.error("LLM call failed for comment %s: %s", comment_id, exc)
            return False

        # Apply results
        raw_sentiment = result.get("sentiment")
        if isinstance(raw_sentiment, (int, float)):
            comment.sentiment = max(-1.0, min(1.0, float(raw_sentiment)))
        
        comment.sentiment_label = result.get("sentiment_label", "neutral")
        comment.topics = result.get("topics", [])
        comment.entities = [e.get("name") for e in result.get("entities", []) if isinstance(e, dict)]
        comment.processed_at = datetime.utcnow()
        
        db.commit()

        logger.info(
            "Processed comment %s: sentiment=%.2f (%s)",
            comment_id,
            comment.sentiment or 0,
            comment.sentiment_label,
        )
        return True

    except Exception as exc:
        logger.error("Unexpected error processing comment %s: %s", comment_id, exc)
        return False
    finally:
        db.close()


async def process_comments_batch(comment_ids: list[str], concurrency: int = 5) -> dict:
    """
    Process multiple comments concurrently.
    Returns summary: {"processed": N, "failed": M}
    """
    semaphore = asyncio.Semaphore(concurrency)

    async def _guarded(cid: str) -> bool:
        async with semaphore:
            return await process_comment(cid)

    results = await asyncio.gather(*[_guarded(cid) for cid in comment_ids], return_exceptions=True)

    processed = sum(1 for r in results if r is True)
    failed = sum(1 for r in results if r is False or isinstance(r, Exception))
    return {"processed": processed, "failed": failed, "total": len(comment_ids)}


def get_pending_comment_ids(db: Session, limit: int = 100) -> list[str]:
    """Return IDs of comments that haven't been processed yet."""
    comments = (
        db.query(PostComment.id)
        .filter(PostComment.processed_at.is_(None))
        .limit(limit)
        .all()
    )
    return [c.id for c in comments]
