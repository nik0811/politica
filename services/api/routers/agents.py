from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional, Union
from pydantic import BaseModel
from datetime import datetime
from database import get_db
from models.models import AgentJob, Document as DocumentModel
from auth import get_current_user, require_role
import uuid
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

# Global scheduler state
_scheduler = None
_scheduler_config = {
    "enabled": False,
    "hour": 2,
    "minute": 0,
    "last_run": None,
}

AGENT_DEFINITIONS = [
    {
        "agent_type": "sentiment_analysis",
        "name": "Sentiment Analyzer",
        "description": "Classifies political content as positive, negative, or neutral using multilingual NLP.",
        "model": "XLM-RoBERTa",
        "default_model": "XLM-RoBERTa",
        "llm_powered": True,
        "status": "available",
    },
    {
        "agent_type": "entity_extraction",
        "name": "Entity Extractor",
        "description": "Identifies and classifies named entities: politicians, parties, locations, organizations.",
        "model": "spaCy NER",
        "default_model": "spaCy NER",
        "llm_powered": True,
        "status": "available",
    },
    {
        "agent_type": "topic_classification",
        "name": "Topic Classifier",
        "description": "Assigns zero-shot topic labels to documents without training data.",
        "model": "BART zero-shot",
        "default_model": "BART zero-shot",
        "llm_powered": True,
        "status": "available",
    },
    {
        "agent_type": "promise_extraction",
        "name": "Promise Extractor",
        "description": "Detects and structures political promises and commitments from speeches and manifestos.",
        "model": "GPT-4",
        "default_model": "GPT-4",
        "llm_powered": True,
        "status": "available",
    },
    {
        "agent_type": "embedding_generation",
        "name": "Embedding Generator",
        "description": "Generates dense vector embeddings for semantic search and similarity matching.",
        "model": "BGE-M3",
        "default_model": "BGE-M3",
        "llm_powered": True,
        "status": "available",
    },
]


class RunAgentRequest(BaseModel):
    agent_type: str
    document_ids: Union[List[str], str]  # list of IDs, "all", or "pending"
    options: Optional[dict] = None


@router.get("/")
async def get_agents():
    """List all available agent types with descriptions and status"""
    from llm import LLM_PROVIDER, LLM_MODEL
    result = []
    for agent in AGENT_DEFINITIONS:
        a = dict(agent)
        if a.get("llm_powered"):
            a["model"] = LLM_MODEL
            a["provider"] = LLM_PROVIDER
        else:
            a["provider"] = "local"
        result.append(a)
    return result


@router.get("/jobs")
async def get_agent_jobs(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    """List recent agent jobs"""
    jobs = db.query(AgentJob).order_by(AgentJob.created_at.desc()).offset(skip).limit(limit).all()
    return jobs


@router.post("/run")
async def run_agent(
    body: RunAgentRequest,
    db: Session = Depends(get_db),
    _: dict = Depends(require_role(["Admin", "Editor"])),
):
    """Enqueue an agent job to run on documents"""
    valid_types = {a["agent_type"] for a in AGENT_DEFINITIONS}
    if body.agent_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Unknown agent_type: {body.agent_type}")

    # Determine how many documents will be processed
    if body.document_ids == "all":
        total = db.query(func.count()).select_from(DocumentModel).scalar() or 0
    elif body.document_ids == "pending":
        total = db.query(func.count()).filter(DocumentModel.status == "pending").scalar() or 0
    else:
        total = len(body.document_ids) if isinstance(body.document_ids, list) else 0

    job = AgentJob(
        id=str(uuid.uuid4()),
        agent_type=body.agent_type,
        status="pending",
        documents_processed=0,
        documents_total=total,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


@router.get("/jobs/{job_id}")
async def get_agent_job(job_id: str, db: Session = Depends(get_db)):
    """Get the status of a specific agent job"""
    job = db.query(AgentJob).filter(AgentJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


# ─── LLM Provider endpoints ──────────────────────────────────────────────────

@router.get("/llm/models")
async def get_llm_models(current_user: dict = Depends(get_current_user)):
    """Get available LLM models and their live status"""
    from llm import get_available_models, LLM_PROVIDER, LLM_MODEL
    return {
        "current_provider": LLM_PROVIDER,
        "current_model": LLM_MODEL,
        "models": get_available_models(),
    }


@router.post("/llm/test")
async def test_llm(current_user: dict = Depends(get_current_user)):
    """Test the configured LLM with a minimal prompt"""
    from llm import chat_completion, LLM_PROVIDER, LLM_MODEL
    try:
        result = await chat_completion(
            [{"role": "user", "content": "Say 'LLM working' in exactly 3 words."}],
            max_tokens=20,
        )
        return {"status": "ok", "response": result, "provider": LLM_PROVIDER, "model": LLM_MODEL}
    except Exception as e:
        # Return error but include provider info for debugging
        from llm import LLM_PROVIDER, LLM_MODEL
        return {
            "status": "error", 
            "error": str(e),
            "provider": LLM_PROVIDER,
            "model": LLM_MODEL,
            "note": "Check that your LLM provider credentials are configured correctly in .env"
        }


# ─── Daily Scheduler endpoints ──────────────────────────────────────────────────

class SchedulerConfig(BaseModel):
    enabled: bool
    hour: int = 2
    minute: int = 0


@router.get("/scheduler/config")
async def get_scheduler_config(current_user: dict = Depends(get_current_user)):
    """Get the current scheduler configuration"""
    return _scheduler_config


@router.post("/scheduler/config")
async def update_scheduler_config(
    config: SchedulerConfig,
    db: Session = Depends(get_db),
    _: dict = Depends(require_role(["Admin"])),
):
    """Update scheduler configuration"""
    global _scheduler, _scheduler_config
    
    _scheduler_config["enabled"] = config.enabled
    _scheduler_config["hour"] = max(0, min(23, config.hour))
    _scheduler_config["minute"] = max(0, min(59, config.minute))
    
    if config.enabled:
        _start_scheduler(db)
    else:
        _stop_scheduler()
    
    return _scheduler_config


@router.post("/run-daily")
async def run_daily_agents(
    db: Session = Depends(get_db),
    _: dict = Depends(require_role(["Admin", "Editor"])),
):
    """Manually trigger the daily agent run"""
    agents_to_run = [
        "sentiment_analysis",
        "entity_extraction",
        "topic_classification",
        "promise_extraction",
    ]
    
    jobs = []
    for agent_type in agents_to_run:
        # Count pending documents
        total = db.query(func.count()).filter(DocumentModel.status == "pending").scalar() or 0
        
        if total > 0:
            job = AgentJob(
                id=str(uuid.uuid4()),
                agent_type=agent_type,
                status="pending",
                documents_processed=0,
                documents_total=total,
            )
            db.add(job)
            jobs.append(job)
    
    if jobs:
        db.commit()
        for job in jobs:
            db.refresh(job)
    
    _scheduler_config["last_run"] = datetime.now().isoformat()
    
    logger.info(f"Daily agent run triggered: {len(jobs)} jobs created")
    
    return {
        "status": "success",
        "jobs_created": len(jobs),
        "jobs": [{"id": j.id, "agent_type": j.agent_type} for j in jobs],
        "timestamp": _scheduler_config["last_run"],
    }


def _start_scheduler(db: Session):
    """Start the APScheduler background scheduler"""
    global _scheduler
    
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        from apscheduler.triggers.cron import CronTrigger
        
        if _scheduler is not None:
            _scheduler.shutdown()
        
        _scheduler = BackgroundScheduler()
        
        # Schedule the daily run
        _scheduler.add_job(
            _scheduled_daily_run,
            CronTrigger(hour=_scheduler_config["hour"], minute=_scheduler_config["minute"]),
            id="daily_agents",
            name="Daily AI Agents Run",
            replace_existing=True,
        )
        
        _scheduler.start()
        logger.info(f"Scheduler started: daily run at {_scheduler_config['hour']:02d}:{_scheduler_config['minute']:02d}")
    except ImportError:
        logger.warning("APScheduler not installed. Install with: pip install apscheduler")
    except Exception as e:
        logger.error(f"Failed to start scheduler: {e}")


def _stop_scheduler():
    """Stop the APScheduler background scheduler"""
    global _scheduler
    
    if _scheduler is not None:
        try:
            _scheduler.shutdown()
            _scheduler = None
            logger.info("Scheduler stopped")
        except Exception as e:
            logger.error(f"Failed to stop scheduler: {e}")


def _scheduled_daily_run():
    """Background job that runs daily agents"""
    try:
        from database import SessionLocal
        db = SessionLocal()
        
        agents_to_run = [
            "sentiment_analysis",
            "entity_extraction",
            "topic_classification",
            "promise_extraction",
        ]
        
        for agent_type in agents_to_run:
            total = db.query(func.count()).filter(DocumentModel.status == "pending").scalar() or 0
            
            if total > 0:
                job = AgentJob(
                    id=str(uuid.uuid4()),
                    agent_type=agent_type,
                    status="pending",
                    documents_processed=0,
                    documents_total=total,
                )
                db.add(job)
        
        db.commit()
        _scheduler_config["last_run"] = datetime.now().isoformat()
        logger.info("Daily agent run completed")
    except Exception as e:
        logger.error(f"Error in scheduled daily run: {e}")
    finally:
        db.close()
