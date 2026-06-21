from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from models.models import Entity as EntityModel

router = APIRouter()

@router.get("/")
async def get_entities(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """Get all entities"""
    entities = db.query(EntityModel).offset(skip).limit(limit).all()
    return entities

@router.get("/{entity_type}")
async def get_entities_by_type(
    entity_type: str,
    db: Session = Depends(get_db)
):
    """Get entities by type"""
    entities = db.query(EntityModel).filter(EntityModel.type == entity_type).all()
    return entities
