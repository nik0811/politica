from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import sys
sys.path.append('/shared')

from database import get_db
from models.models import Document as DocumentModel
from models.schemas import Document, DocumentCreate, DocumentUpdate

router = APIRouter()

@router.get("/", response_model=List[Document])
async def get_documents(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    """Get all documents with pagination"""
    documents = db.query(DocumentModel).offset(skip).limit(limit).all()
    return documents

@router.get("/{document_id}", response_model=Document)
async def get_document(document_id: str, db: Session = Depends(get_db)):
    """Get a specific document by ID"""
    document = db.query(DocumentModel).filter(DocumentModel.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document

@router.post("/", response_model=Document)
async def create_document(document: DocumentCreate, db: Session = Depends(get_db)):
    """Create a new document"""
    db_document = DocumentModel(**document.dict())
    db.add(db_document)
    db.commit()
    db.refresh(db_document)
    return db_document

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
