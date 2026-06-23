from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models.models import Promise as PromiseModel
from models.schemas import Promise, PromiseCreate, PromiseUpdate

router = APIRouter()


@router.get("/", response_model=List[Promise])
async def get_promises(
    skip: int = 0,
    limit: int = 20,
    topic: Optional[str] = None,
    entity: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get all promises with pagination and filters"""
    query = db.query(PromiseModel)
    if topic:
        query = query.filter(PromiseModel.topic == topic)
    if entity:
        query = query.filter(PromiseModel.entity == entity)
    if status:
        query = query.filter(PromiseModel.status == status)
    return query.offset(skip).limit(limit).all()


@router.get("/{promise_id}", response_model=Promise)
async def get_promise(promise_id: str, db: Session = Depends(get_db)):
    """Get a specific promise"""
    promise = db.query(PromiseModel).filter(PromiseModel.id == promise_id).first()
    if not promise:
        raise HTTPException(status_code=404, detail="Promise not found")
    return promise


@router.post("/", response_model=Promise, status_code=201)
async def create_promise(promise: PromiseCreate, db: Session = Depends(get_db)):
    """Create a new promise"""
    import uuid
    db_promise = PromiseModel(id=str(uuid.uuid4()), **promise.dict())
    db.add(db_promise)
    db.commit()
    db.refresh(db_promise)
    return db_promise


@router.patch("/{promise_id}", response_model=Promise)
async def update_promise(
    promise_id: str,
    promise: PromiseUpdate,
    db: Session = Depends(get_db)
):
    """Update a promise's status, confidence, or other fields"""
    db_promise = db.query(PromiseModel).filter(PromiseModel.id == promise_id).first()
    if not db_promise:
        raise HTTPException(status_code=404, detail="Promise not found")

    for key, value in promise.dict(exclude_unset=True).items():
        setattr(db_promise, key, value)

    db.commit()
    db.refresh(db_promise)
    return db_promise


@router.delete("/{promise_id}")
async def delete_promise(promise_id: str, db: Session = Depends(get_db)):
    """Delete a promise"""
    db_promise = db.query(PromiseModel).filter(PromiseModel.id == promise_id).first()
    if not db_promise:
        raise HTTPException(status_code=404, detail="Promise not found")

    db.delete(db_promise)
    db.commit()
    return {"message": "Promise deleted successfully"}
