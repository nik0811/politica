import os
import logging
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.models import Document as DocumentModel
from typing import Optional

logger = logging.getLogger(__name__)

router = APIRouter()

MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "localhost:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin")
SCREENSHOT_BUCKET = "screenshots"
THUMBNAIL_BUCKET = "thumbnails"


def _get_presigned_url(bucket: str, object_name: str) -> Optional[str]:
    """Return a 1-hour pre-signed GET URL for an object, or None if it doesn't exist."""
    try:
        from minio import Minio
        from minio.error import S3Error

        client = Minio(
            MINIO_ENDPOINT,
            access_key=MINIO_ACCESS_KEY,
            secret_key=MINIO_SECRET_KEY,
            secure=False,
        )
        # Probe that the object exists before generating URL
        client.stat_object(bucket, object_name)
        url = client.presigned_get_object(bucket, object_name, expires=timedelta(hours=1))
        return url
    except Exception as exc:
        logger.debug(f"No MinIO object {bucket}/{object_name}: {exc}")
        return None


def _screenshot_url(doc: DocumentModel) -> Optional[str]:
    """Return the best available screenshot URL for a document."""
    # Prefer locally stored screenshot from extension
    if doc.screenshot_path and os.path.isfile(doc.screenshot_path):
        return f"/api/ingest/screenshot/{doc.id}"
    # Fall back to MinIO pre-signed URL
    return _get_presigned_url(SCREENSHOT_BUCKET, f"{doc.id}.png")


@router.get("/gallery")
async def get_media_gallery(
    skip: int = 0,
    limit: int = 50,
    platform: str = None,
    db: Session = Depends(get_db),
):
    """Get media gallery — documents that have screenshots (local or MinIO)."""
    query = db.query(DocumentModel).filter(DocumentModel.url.isnot(None))

    if platform:
        query = query.filter(DocumentModel.platform == platform)

    documents = query.order_by(DocumentModel.created_at.desc()).offset(skip).limit(limit).all()

    media_items = []
    for doc in documents:
        screenshot_url = _screenshot_url(doc)
        media_items.append({
            "id": doc.id,
            "document_id": doc.id,
            "title": doc.title,
            "platform": doc.platform,
            "url": doc.url,
            "author_handle": doc.author_handle,
            "published_at": doc.published_at.isoformat() if doc.published_at else None,
            "screenshot_url": screenshot_url,
            "has_screenshot": screenshot_url is not None,
            "content": doc.content[:200] if doc.content else "",
            "entities": doc.entities if doc.entities else [],
            "topics": doc.topics if doc.topics else [],
            "created_at": doc.created_at.isoformat() if doc.created_at else None,
        })

    return {"items": media_items, "total": len(media_items)}


@router.get("/document/{document_id}/screenshot")
async def get_document_screenshot(document_id: str, db: Session = Depends(get_db)):
    """Get screenshot URL for a specific document."""
    document = db.query(DocumentModel).filter(DocumentModel.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    screenshot_url = _screenshot_url(document)
    thumbnail_url = _get_presigned_url(THUMBNAIL_BUCKET, f"{document_id}.png")

    return {
        "document_id": document_id,
        "screenshot_url": screenshot_url,
        "thumbnail_url": thumbnail_url,
        "has_screenshot": screenshot_url is not None,
    }
