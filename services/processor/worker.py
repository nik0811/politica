# Politica Processor Worker - polls for pending jobs and documents

import asyncio
import logging
import os
import time
from datetime import datetime

from sqlalchemy import create_engine, Column, String, Text, DateTime, JSON, Integer
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy import func

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://politica:politica_dev_pass@localhost:5432/politica")

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

POLL_INTERVAL = int(os.getenv("POLL_INTERVAL_SECONDS", "10"))


# --------------------------------------------------------------------------- #
# Minimal ORM models (mirrors what the API service has)
# --------------------------------------------------------------------------- #

class AgentJob(Base):
    __tablename__ = "agent_jobs"

    id = Column(String, primary_key=True)
    agent_type = Column(String, nullable=False)
    status = Column(String, default="pending")  # pending | running | completed | failed
    documents_processed = Column(Integer, default=0)
    documents_total = Column(Integer, default=0)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)


class Document(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True)
    title = Column(String)
    content = Column(Text)
    platform = Column(String)
    language = Column(String)
    status = Column(String, default="pending")  # pending | processing | processed | failed
    sentiment = Column(String, nullable=True)
    topics = Column(JSON, nullable=True)
    entities = Column(JSON, nullable=True)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)


# --------------------------------------------------------------------------- #
# NLP stubs — real heavy models are in nlp_components.py; we use lightweight
# fallbacks here so the worker starts even without GPU/large model downloads.
# --------------------------------------------------------------------------- #

def run_sentiment(text: str) -> float:
    """Lightweight keyword-based sentiment fallback. Returns -1.0 to 1.0."""
    positive_words = {"progress", "develop", "growth", "improve", "success", "support", "benefit"}
    negative_words = {"fail", "corrupt", "crisis", "decline", "protest", "arrest", "violence"}
    lower = text.lower()
    pos = sum(1 for w in positive_words if w in lower)
    neg = sum(1 for w in negative_words if w in lower)
    if pos > neg:
        return 0.5  # positive
    if neg > pos:
        return -0.5  # negative
    return 0.0  # neutral


def run_entity_extraction(text: str) -> list:
    """Return empty list — real extraction done by NLP components."""
    return []


def run_topic_classification(text: str) -> list:
    """Return generic topics based on simple keyword matching."""
    keyword_topics = {
        "economy": ["economy", "gdp", "inflation", "tax", "budget", "finance"],
        "healthcare": ["health", "hospital", "medicine", "vaccine", "doctor"],
        "education": ["school", "education", "student", "university", "college"],
        "infrastructure": ["road", "bridge", "construction", "infrastructure", "highway"],
        "security": ["police", "security", "crime", "army", "defence"],
    }
    lower = text.lower()
    found = [topic for topic, kws in keyword_topics.items() if any(k in lower for k in kws)]
    return found or ["general"]


def process_document_nlp(db, doc: Document):
    """Run NLP pipeline on a single document and persist results."""
    text = (doc.content or "") + " " + (doc.title or "")
    doc.status = "processing"
    db.commit()

    try:
        doc.sentiment = run_sentiment(text)
        doc.topics = run_topic_classification(text)
        doc.entities = run_entity_extraction(text)
        doc.status = "processed"
        db.commit()
        logger.info(f"Processed document {doc.id}: sentiment={doc.sentiment}, topics={doc.topics}")
    except Exception as exc:
        doc.status = "failed"
        db.commit()
        logger.error(f"Failed to process document {doc.id}: {exc}")


def handle_agent_job(db, job: AgentJob):
    """Run an agent job and update its status."""
    job.status = "running"
    job.started_at = datetime.now()
    db.commit()
    logger.info(f"Running job {job.id} type={job.agent_type}")

    try:
        docs = db.query(Document).all()
        processed = 0

        for doc in docs:
            text = (doc.content or "") + " " + (doc.title or "")
            if job.agent_type == "sentiment_analysis":
                doc.sentiment = run_sentiment(text)
            elif job.agent_type == "topic_classification":
                doc.topics = run_topic_classification(text)
            elif job.agent_type == "entity_extraction":
                doc.entities = run_entity_extraction(text)
            elif job.agent_type == "embedding_generation":
                # Embedding stored in Qdrant by main.py; skip here
                pass
            elif job.agent_type == "promise_extraction":
                pass  # Requires LLM — handled separately
            processed += 1
            job.documents_processed = processed
            db.commit()

        job.status = "completed"
        job.completed_at = datetime.now()
        db.commit()
        logger.info(f"Job {job.id} completed: {processed} documents")
    except Exception as exc:
        job.status = "failed"
        job.error = str(exc)
        job.completed_at = datetime.now()
        db.commit()
        logger.error(f"Job {job.id} failed: {exc}")


# --------------------------------------------------------------------------- #
# Polling loop
# --------------------------------------------------------------------------- #

def poll_once():
    db = SessionLocal()
    try:
        # 1. Process pending agent jobs
        pending_jobs = db.query(AgentJob).filter(AgentJob.status == "pending").all()
        for job in pending_jobs:
            handle_agent_job(db, job)

        # 2. Process pending documents through full NLP pipeline
        pending_docs = db.query(Document).filter(Document.status == "pending").all()
        for doc in pending_docs:
            process_document_nlp(db, doc)
    except Exception as exc:
        logger.error(f"Poll cycle error: {exc}")
    finally:
        db.close()


def wait_for_db(retries: int = 15, delay: int = 5):
    """Block until the database is reachable."""
    for attempt in range(1, retries + 1):
        try:
            with engine.connect():
                logger.info("Database connection established")
                return
        except Exception as exc:
            logger.warning(f"DB not ready (attempt {attempt}/{retries}): {exc}")
            time.sleep(delay)
    raise RuntimeError("Could not connect to the database after multiple retries")


if __name__ == "__main__":
    logger.info("Politica Processor Worker starting…")
    wait_for_db()

    # Ensure tables exist (non-destructive)
    Base.metadata.create_all(bind=engine)

    logger.info(f"Polling every {POLL_INTERVAL}s for pending jobs and documents")
    while True:
        poll_once()
        time.sleep(POLL_INTERVAL)
