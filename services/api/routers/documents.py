from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional, Union
from pydantic import BaseModel
from datetime import datetime
import asyncio
import sys
sys.path.append('/shared')

from database import get_db
from models.models import Document as DocumentModel, PostComment as PostCommentModel
from models.schemas import Document, DocumentCreate, DocumentUpdate, PostComment

router = APIRouter()


@router.get("/", response_model=List[Document])
async def get_documents(
    skip: int = 0,
    limit: int = 20,
    platform: Optional[str] = None,
    status: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get all documents with pagination, platform/status filters, and optional date range."""
    query = db.query(DocumentModel)
    if platform:
        query = query.filter(DocumentModel.platform == platform)
    if status:
        query = query.filter(DocumentModel.status == status)
    if from_date:
        try:
            query = query.filter(DocumentModel.published_at >= datetime.fromisoformat(from_date))
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid from_date format: {from_date}")
    if to_date:
        try:
            query = query.filter(DocumentModel.published_at <= datetime.fromisoformat(to_date))
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid to_date format: {to_date}")
    return query.order_by(DocumentModel.published_at.desc()).offset(skip).limit(limit).all()


@router.post("/", response_model=Document)
async def create_document(document: DocumentCreate, db: Session = Depends(get_db)):
    """Create a new document"""
    db_document = DocumentModel(**document.dict())
    db.add(db_document)
    db.commit()
    db.refresh(db_document)
    return db_document


class BatchProcessRequest(BaseModel):
    document_ids: Union[List[str], str] = "pending"
    concurrency: int = 3


@router.post("/process-batch")
async def process_documents_batch(
    body: BatchProcessRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Process multiple documents in the background.
    document_ids: list of IDs, "pending" (all pending docs), or "all" (pending + failed).
    """
    from services.processor import get_pending_document_ids, process_batch as _batch

    if body.document_ids == "pending":
        ids = get_pending_document_ids(db, limit=100)
    elif body.document_ids == "all":
        docs = db.query(DocumentModel.id).filter(
            DocumentModel.status.in_(["pending", "failed"])
        ).limit(100).all()
        ids = [d.id for d in docs]
    else:
        ids = list(body.document_ids)

    if not ids:
        return {"message": "No documents to process", "total": 0, "status": "done"}

    async def _run_batch():
        await _batch(ids, concurrency=body.concurrency)

    background_tasks.add_task(_run_batch)

    return {
        "message": f"Batch processing started for {len(ids)} documents",
        "total": len(ids),
        "status": "queued",
    }


@router.get("/{document_id}", response_model=Document)
async def get_document(document_id: str, db: Session = Depends(get_db)):
    """Get a specific document by ID"""
    document = db.query(DocumentModel).filter(DocumentModel.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


@router.patch("/{document_id}", response_model=Document)
async def update_document(
    document_id: str,
    document: DocumentUpdate,
    db: Session = Depends(get_db)
):
    """Update a document"""
    db_document = db.query(DocumentModel).filter(DocumentModel.id == document_id).first()
    if not db_document:
        raise HTTPException(status_code=404, detail="Document not found")

    for key, value in document.dict(exclude_unset=True).items():
        setattr(db_document, key, value)

    db.commit()
    db.refresh(db_document)
    return db_document


@router.delete("/{document_id}")
async def delete_document(document_id: str, db: Session = Depends(get_db)):
    """Delete a document"""
    db_document = db.query(DocumentModel).filter(DocumentModel.id == document_id).first()
    if not db_document:
        raise HTTPException(status_code=404, detail="Document not found")

    db.delete(db_document)
    db.commit()
    return {"message": "Document deleted successfully"}


@router.post("/{document_id}/process")
async def process_document(
    document_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Trigger AI processing for a single document (fire-and-forget background task)."""
    db_document = db.query(DocumentModel).filter(DocumentModel.id == document_id).first()
    if not db_document:
        raise HTTPException(status_code=404, detail="Document not found")

    if db_document.status == "processed":
        return {"message": "Document already processed", "document_id": document_id, "status": "processed"}

    db_document.status = "pending"
    db.commit()

    async def _run():
        from services.processor import process_document as _process
        await _process(document_id)

    background_tasks.add_task(_run)

    return {"message": "Document queued for AI processing", "document_id": document_id, "status": "pending"}


@router.get("/{document_id}/comments", response_model=List[PostComment])
async def get_document_comments(
    document_id: str,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get all comments for a document, ordered by likes descending."""
    document = db.query(DocumentModel).filter(DocumentModel.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    comments = (
        db.query(PostCommentModel)
        .filter(PostCommentModel.document_id == document_id)
        .order_by(PostCommentModel.likes_count.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return comments
