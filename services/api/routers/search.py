from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from database import get_db
from models.models import Document as DocumentModel

router = APIRouter()

@router.get("/")
async def search_documents(
    q: str = Query(..., description="Search query"),
    platform: str = None,
    language: str = None,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    """Search documents by query"""
    query = db.query(DocumentModel)
    
    # Basic text search (will be replaced with Elasticsearch/vector search)
    if q:
        query = query.filter(
            (DocumentModel.title.ilike(f"%{q}%")) | 
            (DocumentModel.content.ilike(f"%{q}%"))
        )
    
    if platform:
        query = query.filter(DocumentModel.platform == platform)
    
    if language:
        query = query.filter(DocumentModel.language == language)
    
    results = query.limit(limit).all()
    
    return {
        "documents": results,
        "total": len(results),
        "query": q
    }
