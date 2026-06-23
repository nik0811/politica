from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional, Any
from datetime import datetime, timedelta
from pydantic import BaseModel, field_validator
from database import get_db
from models.models import CollectionTarget, BrowserSession as BrowserSessionModel, Document
import re
import json
import os

try:
    import redis as redis_lib
    _redis_available = True
except ImportError:
    _redis_available = False

router = APIRouter()

VALID_PLATFORMS = {"twitter", "instagram", "facebook", "youtube", "news", "reddit"}
VALID_MODES = {"on_demand", "cron", "daemon"}
VALID_TARGET_TYPES = {"keyword", "handle", "channel", "url", "subreddit"}

CRON_RE = re.compile(
    r'^(\*|[0-9,\-\*/]+)\s+(\*|[0-9,\-\*/]+)\s+(\*|[0-9,\-\*/]+)\s+(\*|[0-9,\-\*/]+)\s+(\*|[0-9,\-\*/]+)$'
)


def _validate_cron(expr: str) -> None:
    if not CRON_RE.match(expr.strip()):
        raise ValueError(f"Invalid cron expression: {expr!r}")


class CollectionTargetCreate(BaseModel):
    name: str
    platform: str
    target: str
    target_type: str = "keyword"
    mode: str = "on_demand"
    cron_expression: Optional[str] = None
    interval_minutes: int = 60
    max_items: int = 50
    headless: bool = True
    enabled: bool = True
    from_date: Optional[datetime] = None
    to_date: Optional[datetime] = None
    include_comments: bool = True
    max_comments_per_post: int = 10000

    @field_validator("platform")
    @classmethod
    def validate_platform(cls, v: str) -> str:
        if v not in VALID_PLATFORMS:
            raise ValueError(f"platform must be one of {VALID_PLATFORMS}")
        return v

    @field_validator("mode")
    @classmethod
    def validate_mode(cls, v: str) -> str:
        if v not in VALID_MODES:
            raise ValueError(f"mode must be one of {VALID_MODES}")
        return v

    @field_validator("target_type")
    @classmethod
    def validate_target_type(cls, v: str) -> str:
        if v not in VALID_TARGET_TYPES:
            raise ValueError(f"target_type must be one of {VALID_TARGET_TYPES}")
        return v

    @field_validator("cron_expression")
    @classmethod
    def validate_cron_expression(cls, v: Optional[str]) -> Optional[str]:
        if v:
            _validate_cron(v)
        return v


class CollectionTargetUpdate(BaseModel):
    name: Optional[str] = None
    platform: Optional[str] = None
    target: Optional[str] = None
    target_type: Optional[str] = None
    mode: Optional[str] = None
    cron_expression: Optional[str] = None
    interval_minutes: Optional[int] = None
    max_items: Optional[int] = None
    headless: Optional[bool] = None
    enabled: Optional[bool] = None
    is_running: Optional[bool] = None
    last_run_at: Optional[datetime] = None
    from_date: Optional[datetime] = None
    to_date: Optional[datetime] = None
    include_comments: Optional[bool] = None
    max_comments_per_post: Optional[int] = None

    @field_validator("cron_expression")
    @classmethod
    def validate_cron_expression(cls, v: Optional[str]) -> Optional[str]:
        if v:
            _validate_cron(v)
        return v


def _enqueue_job(target: CollectionTarget) -> None:
    """Push a run request onto the Redis queue used by the collector service."""
    if not _redis_available:
        return
    try:
        import os
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
        r = redis_lib.from_url(redis_url)
        job_data = json.dumps({
            "id": target.id,
            "url": target.target,
            "platform": target.platform,
            "max_items": target.max_items,
            "headless": target.headless,
            "from_date": target.from_date.isoformat() if target.from_date else None,
            "to_date": target.to_date.isoformat() if target.to_date else None,
            "include_comments": target.include_comments,
            "max_comments": target.max_comments_per_post,
        })
        r.rpush("collection:high", job_data)
    except Exception:
        pass  # Non-fatal; collector will still pick it up via DB polling


# ── Run history helpers ───────────────────────────────────────────────────────

def _stale_running(session: BrowserSessionModel) -> bool:
    """A 'running' session older than 1 hour is considered stale/failed."""
    if session.status != "running":
        return False
    if not session.started_at:
        return True
    return datetime.utcnow() - session.started_at > timedelta(hours=1)


def _count_docs_for_session(db: Session, platform: str, started: Optional[datetime], session_items: int = 0, completed: Optional[datetime] = None) -> int:
    """Count documents collected on this platform during the session window."""
    if not started:
        return session_items  # fall back to what the session recorded
    window_end = completed if completed else started + timedelta(hours=3)
    count = (
        db.query(func.count(Document.id))
        .filter(
            Document.platform == platform,
            Document.collected_at >= started,
            Document.collected_at <= window_end,
        )
        .scalar()
    ) or 0
    return count if count > 0 else session_items


def _sample_docs_for_session(
    db: Session, platform: str, started: Optional[datetime], completed: Optional[datetime] = None
) -> list[dict]:
    """Return up to 3 document titles/URLs collected during the session window."""
    if not started:
        return []
    window_end = completed if completed else started + timedelta(hours=3)
    docs = (
        db.query(Document.title, Document.url)
        .filter(
            Document.platform == platform,
            Document.collected_at >= started,
            Document.collected_at <= window_end,
        )
        .limit(3)
        .all()
    )
    return [{"title": d.title, "url": d.url} for d in docs]


def _session_to_run(
    session: BrowserSessionModel,
    target_id: str,
    target_name: str,
    platform: str,
    doc_count: int,
    sample_content: Optional[list] = None,
) -> dict:
    """Serialize a BrowserSession + document count into a run history dict."""
    started = session.started_at
    completed = session.completed_at
    duration_minutes: Optional[int] = None
    if started and completed:
        duration_minutes = max(0, int((completed - started).total_seconds() / 60))

    status = "stale" if _stale_running(session) else session.status
    # Prefer DB doc count; fall back to the counter tracked on the session itself
    items = doc_count if doc_count > 0 else (session.items_collected or 0)

    return {
        "id": session.id,
        "target_id": target_id,
        "target_name": target_name,
        "platform": platform,
        "status": status,
        "items_collected": items,
        "started_at": started.isoformat() if started else None,
        "completed_at": completed.isoformat() if completed else None,
        "duration_minutes": duration_minutes,
        "sample_content": sample_content or [],
    }


# ── CRUD ─────────────────────────────────────────────────────────────────────

@router.get("/")
async def list_targets(
    platform: Optional[str] = None,
    enabled: Optional[bool] = None,
    db: Session = Depends(get_db),
):
    """List all collection targets, with optional filters."""
    # Safety: reset is_running for any target with no active browser session
    running_targets = db.query(CollectionTarget).filter(CollectionTarget.is_running == True).all()
    changed = False
    for t in running_targets:
        active = db.query(BrowserSessionModel).filter(
            BrowserSessionModel.status == "running",
            BrowserSessionModel.platform == t.platform,
            BrowserSessionModel.url == t.target,
        ).first()
        if active is None:
            t.is_running = False
            changed = True
    if changed:
        db.commit()

    q = db.query(CollectionTarget)
    if platform:
        q = q.filter(CollectionTarget.platform == platform)
    if enabled is not None:
        q = q.filter(CollectionTarget.enabled == enabled)
    return q.order_by(CollectionTarget.created_at.desc()).all()


@router.post("/", status_code=201)
async def create_target(body: CollectionTargetCreate, db: Session = Depends(get_db)):
    """Create a new collection target."""
    if body.mode == "cron" and not body.cron_expression:
        raise HTTPException(status_code=400, detail="cron_expression is required when mode=cron")

    t = CollectionTarget(**body.model_dump())
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


# NOTE: Static paths must be declared before /{target_id} to avoid FastAPI treating them as target_ids.

@router.get("/platform-auth-status")
async def get_platform_auth_status():
    """Check which platforms have credentials configured."""
    import os
    from pathlib import Path
    from dotenv import dotenv_values

    # Merge: shell env (highest priority) → api/.env
    api_env_path = Path(__file__).parent.parent / ".env"

    dot_vars: dict = {}
    if api_env_path.exists():
        dot_vars.update(dotenv_values(api_env_path))

    def _get(key: str) -> str:
        return os.environ.get(key) or dot_vars.get(key, "")

    platforms = ['instagram', 'facebook', 'twitter', 'youtube', 'reddit']
    status = {}
    for p in platforms:
        prefix = p.upper()
        has_creds = bool(_get(f'{prefix}_USERNAME') or _get(f'{prefix}_EMAIL'))
        status[p] = {'configured': has_creds}
    return status


PROFILES_DIR = os.environ.get("PROFILES_DIR", os.path.expanduser("~/.politica/profiles"))

COOKIE_PLATFORMS = {"instagram", "facebook", "twitter", "youtube", "reddit"}


class CookieImportBody(BaseModel):
    cookies: List[Any]


def _transform_cookie(c: dict) -> dict:
    """Convert Cookie-Editor JSON format to Playwright storageState format."""
    transformed = {
        "name": c.get("name", ""),
        "value": c.get("value", ""),
        "domain": c.get("domain", ""),
        "path": c.get("path", "/"),
        "expires": c.get("expirationDate", c.get("expires", -1)),
        "httpOnly": c.get("httpOnly", False),
        "secure": c.get("secure", False),
        "sameSite": c.get("sameSite", "Lax"),
    }
    return transformed


@router.post("/platform-cookies/{platform}")
async def import_platform_cookies(platform: str, body: CookieImportBody):
    """Import browser cookies for a platform (from Cookie-Editor JSON export)."""
    if platform not in COOKIE_PLATFORMS:
        raise HTTPException(status_code=400, detail=f"platform must be one of {COOKIE_PLATFORMS}")
    if not body.cookies:
        raise HTTPException(status_code=400, detail="cookies array must not be empty")

    profile_dir = os.path.join(PROFILES_DIR, platform)
    os.makedirs(profile_dir, exist_ok=True)

    cookies_path = os.path.join(profile_dir, "cookies.json")
    state_path = os.path.join(profile_dir, "state.json")

    transformed = [_transform_cookie(c) for c in body.cookies if isinstance(c, dict)]

    with open(cookies_path, "w") as f:
        json.dump(body.cookies, f, indent=2)

    state = {"cookies": transformed, "origins": []}
    with open(state_path, "w") as f:
        json.dump(state, f, indent=2)

    return {"success": True, "cookies_imported": len(transformed)}


@router.delete("/platform-cookies/{platform}", status_code=204)
async def remove_platform_cookies(platform: str):
    """Remove imported cookies for a platform (logout)."""
    if platform not in COOKIE_PLATFORMS:
        raise HTTPException(status_code=400, detail=f"platform must be one of {COOKIE_PLATFORMS}")

    profile_dir = os.path.join(PROFILES_DIR, platform)
    for filename in ("cookies.json", "state.json"):
        filepath = os.path.join(profile_dir, filename)
        if os.path.exists(filepath):
            os.remove(filepath)


@router.get("/platform-cookie-status")
async def get_platform_cookie_status():
    """Check which platforms have imported cookies (state.json present)."""
    result = {}
    for platform in COOKIE_PLATFORMS:
        state_path = os.path.join(PROFILES_DIR, platform, "state.json")
        result[platform] = {"has_cookies": os.path.exists(state_path)}
    return result


@router.get("/runs/all")
async def get_all_runs(limit: int = 50, db: Session = Depends(get_db)):
    """Return recent collection runs across all targets with actual document counts."""
    targets = db.query(CollectionTarget).all()

    sessions = (
        db.query(BrowserSessionModel)
        .order_by(BrowserSessionModel.started_at.desc())
        .limit(limit)
        .all()
    )

    results = []
    for session in sessions:
        # Skip sessions with no timestamps and zero items — these are uninitialised noise
        is_noise = (
            (session.items_collected or 0) == 0
            and session.status != "running"
            and (
                session.started_at is None
                or datetime.utcnow() - session.started_at > timedelta(minutes=5)
            )
        )
        if is_noise:
            continue

        # Find matching target: exact match first, then substring match on url
        linked_target = next(
            (t for t in targets if t.target == session.url and t.platform == session.platform),
            None,
        )
        if linked_target is None:
            linked_target = next(
                (
                    t
                    for t in targets
                    if t.platform == session.platform
                    and (session.url in t.target or t.target in session.url)
                ),
                None,
            )

        target_id = linked_target.id if linked_target else ""
        target_name = linked_target.name if linked_target else session.url
        platform = session.platform

        doc_count = _count_docs_for_session(db, platform, session.started_at, session.items_collected or 0, completed=session.completed_at)
        sample = _sample_docs_for_session(db, platform, session.started_at, completed=session.completed_at)
        results.append(_session_to_run(session, target_id, target_name, platform, doc_count, sample))

    return results


@router.get("/{target_id}")
async def get_target(target_id: str, db: Session = Depends(get_db)):
    """Get a single collection target by ID."""
    t = db.query(CollectionTarget).filter(CollectionTarget.id == target_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Collection target not found")
    return t


@router.patch("/{target_id}")
async def update_target(
    target_id: str,
    body: CollectionTargetUpdate,
    db: Session = Depends(get_db),
):
    """Partially update a collection target."""
    t = db.query(CollectionTarget).filter(CollectionTarget.id == target_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Collection target not found")

    update_data = body.model_dump(exclude_none=True)
    for field, value in update_data.items():
        setattr(t, field, value)

    db.commit()
    db.refresh(t)
    return t


@router.delete("/{target_id}", status_code=204)
async def delete_target(target_id: str, db: Session = Depends(get_db)):
    """Delete a collection target and stop any active sessions for it."""
    t = db.query(CollectionTarget).filter(CollectionTarget.id == target_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Collection target not found")

    # Stop any active browser sessions tied to this target's URL + platform
    db.query(BrowserSessionModel).filter(
        BrowserSessionModel.url == t.target,
        BrowserSessionModel.platform == t.platform,
        BrowserSessionModel.status == "running",
    ).update({"status": "stopped", "completed_at": datetime.utcnow()})

    db.delete(t)
    db.commit()


@router.post("/{target_id}/run")
async def run_target(target_id: str, db: Session = Depends(get_db)):
    """Trigger an immediate on-demand run for a collection target."""
    t = db.query(CollectionTarget).filter(CollectionTarget.id == target_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Collection target not found")

    mode = "headless" if t.headless else "headed"
    now = datetime.utcnow()
    session = BrowserSessionModel(
        url=t.target,
        platform=t.platform,
        mode=mode,
        status="running",
        items_collected=0,
        progress=0.0,
        issues=[],
        started_at=now,
    )
    db.add(session)
    t.is_running = True
    t.last_run_at = now
    db.commit()
    db.refresh(session)

    _enqueue_job(t)

    return {"session_id": session.id, "target_id": t.id, "status": "queued"}


@router.get("/{target_id}/history")
async def get_target_history(target_id: str, limit: int = 20, db: Session = Depends(get_db)):
    """Return recent runs for a specific collection target with document counts."""
    t = db.query(CollectionTarget).filter(CollectionTarget.id == target_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Collection target not found")

    sessions = (
        db.query(BrowserSessionModel)
        .filter(
            BrowserSessionModel.url == t.target,
            BrowserSessionModel.platform == t.platform,
        )
        .order_by(BrowserSessionModel.started_at.desc())
        .limit(limit)
        .all()
    )

    return [
        _session_to_run(
            session, t.id, t.name, t.platform,
            _count_docs_for_session(db, t.platform, session.started_at, session.items_collected or 0, completed=session.completed_at),
            _sample_docs_for_session(db, t.platform, session.started_at, completed=session.completed_at),
        )
        for session in sessions
    ]


@router.post("/{target_id}/toggle")
async def toggle_target(target_id: str, db: Session = Depends(get_db)):
    """Toggle the enabled/disabled state of a collection target."""
    t = db.query(CollectionTarget).filter(CollectionTarget.id == target_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Collection target not found")

    t.enabled = not t.enabled
    db.commit()
    db.refresh(t)
    return {"id": t.id, "enabled": t.enabled}

