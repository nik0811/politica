import json
import base64
import logging
import os
import asyncio

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Optional, List
from pydantic import BaseModel, field_validator
from datetime import datetime, timedelta
from database import get_db
from models.models import Document, PostComment, generate_uuid
from routers.settings import Settings
from llm import chat_completion, LLM_MODEL

logger = logging.getLogger(__name__)

router = APIRouter()

VALID_PLATFORMS = {"instagram", "twitter", "facebook"}
SCREENSHOTS_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads", "screenshots")


@router.post("/test")
async def test_token():
    """Simple endpoint to verify API token is valid. Returns 200 if auth passes."""
    return {"status": "ok", "message": "API token is valid"}


class CommentData(BaseModel):
    author: Optional[str] = None
    author_handle: Optional[str] = None
    content: str
    likes_count: int = 0
    replies_count: int = 0
    published_at: Optional[datetime] = None


class IngestPostBase(BaseModel):
    text: str
    author: Optional[str] = None
    author_handle: Optional[str] = None
    platform_url: str
    collected_at: Optional[datetime] = None
    language: str = "unknown"
    title: Optional[str] = None
    likes_count: int = 0
    comments_count: int = 0
    shares_count: int = 0
    views_count: int = 0
    reactions_count: int = 0
    engagement_rate: Optional[float] = None
    published_at: Optional[datetime] = None
    comments: Optional[List[CommentData]] = None


class IngestInstagramPost(IngestPostBase):
    pass


class IngestTwitterPost(IngestPostBase):
    pass


class IngestFacebookPost(IngestPostBase):
    pass


class IngestPageHTML(BaseModel):
    html: str
    platform: str
    url: str
    collected_at: Optional[datetime] = None

    @field_validator("platform")
    @classmethod
    def validate_platform(cls, v: str) -> str:
        v = v.lower()
        if v not in VALID_PLATFORMS:
            raise ValueError(f"platform must be one of {VALID_PLATFORMS}")
        return v


class IngestResponse(BaseModel):
    id: str
    status: str
    message: str
    new_comments_count: int = 0


class PageHTMLResponse(BaseModel):
    id: str
    status: str
    message: str
    instructions: Optional[str] = None
    ai_action: Optional[str] = None
    ai_selector: Optional[str] = None
    ai_scroll_direction: Optional[str] = None
    ai_reason: Optional[str] = None


class ScreenshotUpload(BaseModel):
    document_id: str
    image_data: str  # base64-encoded JPEG
    platform: str = "instagram"


def _screenshots_dir() -> str:
    path = os.path.abspath(SCREENSHOTS_DIR)
    os.makedirs(path, exist_ok=True)
    return path


def _comment_signature(comment: CommentData) -> tuple:
    """
    Generate a signature for a comment to detect duplicates.
    Uses author_handle, content, and published_at for comparison.
    Normalizes published_at to ISO format string for consistent comparison.
    """
    published_at_str = None
    if comment.published_at:
        # Normalize to ISO format string for consistent comparison
        if isinstance(comment.published_at, str):
            published_at_str = comment.published_at
        else:
            # Convert datetime to ISO format, removing timezone info for consistency
            published_at_str = comment.published_at.replace(tzinfo=None).isoformat()
    
    return (
        comment.author_handle or "",
        comment.content.strip().lower(),
        published_at_str,
    )


def _get_existing_comment_signatures(db: Session, document_id: str) -> set:
    """Get all existing comment signatures for a document."""
    existing_comments = db.query(PostComment).filter(
        PostComment.document_id == document_id
    ).all()
    return {
        (c.author_handle or "", c.content.strip().lower(), c.published_at.replace(tzinfo=None).isoformat() if c.published_at else None)
        for c in existing_comments
    }


def _find_new_comments(
    db: Session,
    document_id: str,
    incoming_comments: Optional[List[CommentData]],
) -> List[CommentData]:
    """
    Filter incoming comments to only return those not already in database.
    """
    if not incoming_comments:
        return []
    
    existing_signatures = _get_existing_comment_signatures(db, document_id)
    new_comments = []
    
    for comment in incoming_comments:
        signature = _comment_signature(comment)
        if signature not in existing_signatures:
            new_comments.append(comment)
    
    return new_comments


def _create_document(
    db: Session,
    platform: str,
    data: IngestPostBase,
) -> Document:
    doc_id = generate_uuid()
    title = data.title or (data.text[:80] + "..." if len(data.text) > 80 else data.text)

    doc = Document(
        id=doc_id,
        title=title,
        content=data.text,
        url=data.platform_url,
        platform=platform,
        language=data.language,
        author=data.author,
        author_handle=data.author_handle,
        published_at=data.published_at,
        collected_at=data.collected_at or datetime.utcnow(),
        status="pending",
        likes_count=data.likes_count,
        comments_count=data.comments_count,
        shares_count=data.shares_count,
        views_count=data.views_count,
        reactions_count=data.reactions_count,
        engagement_rate=data.engagement_rate,
    )
    db.add(doc)

    if data.comments:
        for comment in data.comments:
            db.add(PostComment(
                id=generate_uuid(),
                document_id=doc_id,
                author=comment.author,
                author_handle=comment.author_handle,
                content=comment.content,
                likes_count=comment.likes_count,
                replies_count=comment.replies_count,
                published_at=comment.published_at,
                collected_at=data.collected_at or datetime.utcnow(),
            ))

    db.commit()
    db.refresh(doc)
    return doc


def _trigger_background_processing(doc_id: str, db: Session = None) -> None:
    """Fire-and-forget: schedule AI processing for the newly ingested document.
    
    Checks the 'auto_process' setting before triggering processing.
    """
    # Check if auto-processing is enabled
    if db:
        try:
            setting = db.query(Settings).filter(
                Settings.category == "processing",
                Settings.key == "auto_process"
            ).first()
            if setting and setting.value is False:
                logger.debug("Auto-processing disabled, skipping doc %s", doc_id)
                return
        except Exception as e:
            logger.debug("Could not check auto_process setting: %s", e)
    
    async def _run():
        try:
            from services.processor import process_document
            await process_document(doc_id)
        except Exception as exc:
            logger.warning("Background processing failed for %s: %s", doc_id, exc)

    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.ensure_future(_run())
        else:
            loop.run_until_complete(_run())
    except RuntimeError:
        logger.debug("No event loop for auto-processing doc %s", doc_id)


@router.post("/instagram", response_model=IngestResponse, status_code=201)
async def ingest_instagram(data: IngestInstagramPost, db: Session = Depends(get_db)):
    """
    Receive scraped Instagram post data from the browser extension.
    
    Handles duplicate detection:
    - If post URL already exists, only insert NEW comments
    - Update post's last_updated_at timestamp
    - Return appropriate status: "created", "updated", or "no_changes"
    """
    existing_post = db.query(Document).filter(
        Document.url == data.platform_url
    ).first()
    
    if existing_post:
        new_comments = _find_new_comments(db, existing_post.id, data.comments)
        
        if new_comments:
            for comment in new_comments:
                db.add(PostComment(
                    id=generate_uuid(),
                    document_id=existing_post.id,
                    author=comment.author,
                    author_handle=comment.author_handle,
                    content=comment.content,
                    likes_count=comment.likes_count,
                    replies_count=comment.replies_count,
                    published_at=comment.published_at,
                    collected_at=data.collected_at or datetime.utcnow(),
                ))
            
            existing_post.last_updated_at = datetime.utcnow()
            existing_post.comments_count = data.comments_count
            db.commit()
            db.refresh(existing_post)
            
            _trigger_background_processing(existing_post.id, db)
            return IngestResponse(
                id=existing_post.id,
                status="updated",
                message=f"Instagram post updated with {len(new_comments)} new comment(s)",
                new_comments_count=len(new_comments),
            )
        else:
            existing_post.last_updated_at = datetime.utcnow()
            db.commit()
            
            return IngestResponse(
                id=existing_post.id,
                status="no_changes",
                message="Instagram post already exists with no new comments",
                new_comments_count=0,
            )
    
    doc = _create_document(db, "instagram", data)
    _trigger_background_processing(doc.id, db)
    return IngestResponse(
        id=doc.id,
        status="created",
        message="Instagram post ingested successfully",
        new_comments_count=len(data.comments) if data.comments else 0,
    )


@router.post("/twitter", response_model=IngestResponse, status_code=201)
async def ingest_twitter(data: IngestTwitterPost, db: Session = Depends(get_db)):
    """
    Receive scraped Twitter/X post data from the browser extension.
    
    Handles duplicate detection:
    - If post URL already exists, only insert NEW comments
    - Update post's last_updated_at timestamp
    - Return appropriate status: "created", "updated", or "no_changes"
    """
    existing_post = db.query(Document).filter(
        Document.url == data.platform_url
    ).first()
    
    if existing_post:
        new_comments = _find_new_comments(db, existing_post.id, data.comments)
        
        if new_comments:
            for comment in new_comments:
                db.add(PostComment(
                    id=generate_uuid(),
                    document_id=existing_post.id,
                    author=comment.author,
                    author_handle=comment.author_handle,
                    content=comment.content,
                    likes_count=comment.likes_count,
                    replies_count=comment.replies_count,
                    published_at=comment.published_at,
                    collected_at=data.collected_at or datetime.utcnow(),
                ))
            
            existing_post.last_updated_at = datetime.utcnow()
            existing_post.comments_count = data.comments_count
            db.commit()
            db.refresh(existing_post)
            
            _trigger_background_processing(existing_post.id, db)
            return IngestResponse(
                id=existing_post.id,
                status="updated",
                message=f"Twitter post updated with {len(new_comments)} new comment(s)",
                new_comments_count=len(new_comments),
            )
        else:
            existing_post.last_updated_at = datetime.utcnow()
            db.commit()
            
            return IngestResponse(
                id=existing_post.id,
                status="no_changes",
                message="Twitter post already exists with no new comments",
                new_comments_count=0,
            )
    
    doc = _create_document(db, "twitter", data)
    _trigger_background_processing(doc.id, db)
    return IngestResponse(
        id=doc.id,
        status="created",
        message="Twitter post ingested successfully",
        new_comments_count=len(data.comments) if data.comments else 0,
    )


@router.post("/facebook", response_model=IngestResponse, status_code=201)
async def ingest_facebook(data: IngestFacebookPost, db: Session = Depends(get_db)):
    """
    Receive scraped Facebook post data from the browser extension.
    
    Handles duplicate detection:
    - If post URL already exists, only insert NEW comments
    - Update post's last_updated_at timestamp
    - Return appropriate status: "created", "updated", or "no_changes"
    """
    existing_post = db.query(Document).filter(
        Document.url == data.platform_url
    ).first()
    
    if existing_post:
        new_comments = _find_new_comments(db, existing_post.id, data.comments)
        
        if new_comments:
            for comment in new_comments:
                db.add(PostComment(
                    id=generate_uuid(),
                    document_id=existing_post.id,
                    author=comment.author,
                    author_handle=comment.author_handle,
                    content=comment.content,
                    likes_count=comment.likes_count,
                    replies_count=comment.replies_count,
                    published_at=comment.published_at,
                    collected_at=data.collected_at or datetime.utcnow(),
                ))
            
            existing_post.last_updated_at = datetime.utcnow()
            existing_post.comments_count = data.comments_count
            db.commit()
            db.refresh(existing_post)
            
            _trigger_background_processing(existing_post.id, db)
            return IngestResponse(
                id=existing_post.id,
                status="updated",
                message=f"Facebook post updated with {len(new_comments)} new comment(s)",
                new_comments_count=len(new_comments),
            )
        else:
            existing_post.last_updated_at = datetime.utcnow()
            db.commit()
            
            return IngestResponse(
                id=existing_post.id,
                status="no_changes",
                message="Facebook post already exists with no new comments",
                new_comments_count=0,
            )
    
    doc = _create_document(db, "facebook", data)
    _trigger_background_processing(doc.id, db)
    return IngestResponse(
        id=doc.id,
        status="created",
        message="Facebook post ingested successfully",
        new_comments_count=len(data.comments) if data.comments else 0,
    )


@router.post("/page-html", response_model=PageHTMLResponse, status_code=201)
async def ingest_page_html(data: IngestPageHTML, db: Session = Depends(get_db)):
    """
    Receive raw page HTML from the extension, pass a cleaned snippet to the LLM
    for scraping guidance, store the result for logging, and return the AI decision
    immediately so the extension can act on it.
    """
    doc_id = generate_uuid()
    html_snippet = data.html[:8000]

    prompt = (
        "You are analyzing a social media page DOM. The browser extension scraper is stuck "
        "or uncertain. Analyze this HTML snippet and return JSON with exactly these fields:\n"
        '{"action": "scroll"|"click"|"collect"|"skip"|"stop", '
        '"selector": "css_selector_if_action_is_click_else_null", '
        '"scroll_direction": "down"|"up"|null, '
        '"reason": "brief explanation"}\n\n'
        "Focus on finding: comment load buttons, post thumbnails, pagination elements, "
        "or modal close buttons. Return ONLY valid JSON, no explanation.\n\n"
        f"URL: {data.url}\nPlatform: {data.platform}\n\nHTML (may be truncated):\n{html_snippet}"
    )

    ai_action = ai_selector = ai_scroll = ai_reason = None
    raw_ai_response = None

    try:
        raw_ai_response = await chat_completion(
            messages=[{"role": "user", "content": prompt}],
            model=LLM_MODEL,
            temperature=0,
            max_tokens=300,
            json_mode=True,
        )
        # Strip markdown fences if present
        cleaned = raw_ai_response.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```")[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
        parsed = json.loads(cleaned)
        ai_action = parsed.get("action")
        ai_selector = parsed.get("selector")
        ai_scroll = parsed.get("scroll_direction")
        ai_reason = parsed.get("reason")
    except Exception as exc:
        logger.warning("LLM call failed for page-html ingestion: %s", exc)

    doc = Document(
        id=doc_id,
        title=f"Raw HTML capture: {data.url[:60]}",
        content=data.html,
        url=data.url,
        platform=data.platform,
        language="unknown",
        collected_at=data.collected_at or datetime.utcnow(),
        status="pending_ai_review",
    )
    db.add(doc)
    db.commit()

    return PageHTMLResponse(
        id=doc_id,
        status="stored",
        message="Page HTML stored; AI analysis complete" if ai_action else "Page HTML stored; AI analysis unavailable",
        instructions=raw_ai_response,
        ai_action=ai_action,
        ai_selector=ai_selector,
        ai_scroll_direction=ai_scroll,
        ai_reason=ai_reason,
    )


@router.post("/screenshot")
async def upload_screenshot(data: ScreenshotUpload, db: Session = Depends(get_db)):
    """
    Receive a base64-encoded JPEG screenshot from the browser extension,
    save it to disk, and store the path on the Document record.
    """
    document = db.query(Document).filter(Document.id == data.document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail=f"Document {data.document_id} not found")

    try:
        image_bytes = base64.b64decode(data.image_data)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 image data")

    screenshots_path = _screenshots_dir()
    file_path = os.path.join(screenshots_path, f"{data.document_id}.jpg")

    with open(file_path, "wb") as f:
        f.write(image_bytes)

    document.screenshot_path = file_path
    db.commit()

    return {
        "document_id": data.document_id,
        "screenshot_url": f"/api/ingest/screenshot/{data.document_id}",
        "status": "saved",
    }


@router.get("/screenshot/{document_id}")
async def serve_screenshot(document_id: str, db: Session = Depends(get_db)):
    """Serve the locally stored screenshot for a document."""
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    if not document.screenshot_path or not os.path.isfile(document.screenshot_path):
        raise HTTPException(status_code=404, detail="Screenshot not found")

    return FileResponse(document.screenshot_path, media_type="image/jpeg")


# ── Stats & Logs (used by admin dashboard) ──────────────────────────────────

from sqlalchemy import func as sa_func


@router.get("/stats")
async def ingestion_stats(db: Session = Depends(get_db)):
    """Aggregated ingestion statistics for the admin dashboard."""
    now = datetime.utcnow()
    last_24h = now - timedelta(hours=24)
    last_7d = now - timedelta(days=7)

    total = db.query(sa_func.count(Document.id)).scalar() or 0
    total_comments = db.query(sa_func.count(PostComment.id)).scalar() or 0

    by_platform = (
        db.query(Document.platform, sa_func.count(Document.id))
        .group_by(Document.platform)
        .all()
    )

    last_24h_count = (
        db.query(sa_func.count(Document.id))
        .filter(Document.collected_at >= last_24h)
        .scalar() or 0
    )

    last_7d_count = (
        db.query(sa_func.count(Document.id))
        .filter(Document.collected_at >= last_7d)
        .scalar() or 0
    )

    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    posts_today = (
        db.query(sa_func.count(Document.id))
        .filter(Document.collected_at >= today_start, Document.status != "pending_ai_review")
        .scalar() or 0
    )

    comments_today = (
        db.query(sa_func.count(PostComment.id))
        .filter(PostComment.collected_at >= today_start)
        .scalar() or 0
    )

    ai_decisions = (
        db.query(sa_func.count(Document.id))
        .filter(Document.status == "pending_ai_review")
        .scalar() or 0
    )

    last_ingestion = (
        db.query(sa_func.max(Document.collected_at)).scalar()
    )

    return {
        "total_documents": total,
        "total_comments": total_comments,
        "by_platform": {p: c for p, c in by_platform},
        "last_24h": last_24h_count,
        "last_7d": last_7d_count,
        "posts_today": posts_today,
        "comments_today": comments_today,
        "ai_decisions_pending": ai_decisions,
        "last_ingestion_at": last_ingestion.isoformat() if last_ingestion else None,
    }


@router.get("/logs")
async def ingestion_logs(
    platform: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    skip: int = 0,
    db: Session = Depends(get_db),
):
    """Recent ingested documents log for the admin dashboard."""
    q = db.query(Document).order_by(Document.collected_at.desc())

    if platform:
        q = q.filter(Document.platform == platform)
    if status:
        q = q.filter(Document.status == status)

    docs = q.offset(skip).limit(limit).all()

    return [
        {
            "id": d.id,
            "title": d.title,
            "platform": d.platform,
            "author": d.author,
            "author_handle": d.author_handle,
            "url": d.url,
            "status": d.status,
            "collected_at": d.collected_at.isoformat() if d.collected_at else None,
            "likes_count": d.likes_count,
            "comments_count": d.comments_count,
        }
        for d in docs
    ]
