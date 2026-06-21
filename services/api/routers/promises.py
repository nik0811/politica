from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models.models import Promise as PromiseModel

router = APIRouter()

@router.get("/")
async def get_promises(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    """Get all promises"""
    promises = db.query(PromiseModel).offset(skip).limit(limit).all()
    return promises

@router.get("/{promise_id}")
async def get_promise(promise_id: str, db: Session = Depends(get_db)):
    """Get a specific promise"""
    promise = db.query(PromiseModel).filter(PromiseModel.id == promise_id).first()
    return promise
