from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models.models import Entity as EntityModel
from models.schemas import Entity, EntityCreate, EntityUpdate

router = APIRouter()


@router.get("/", response_model=List[Entity])
async def get_entities(
    skip: int = 0,
    limit: int = 50,
    type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get all entities with optional type filter"""
    query = db.query(EntityModel)
    if type:
        query = query.filter(EntityModel.type == type)
    return query.offset(skip).limit(limit).all()


@router.get("/{entity_id}", response_model=Entity)
async def get_entity(entity_id: str, db: Session = Depends(get_db)):
    """Get a specific entity by ID"""
    entity = db.query(EntityModel).filter(EntityModel.id == entity_id).first()
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")
    return entity


@router.post("/", response_model=Entity, status_code=201)
async def create_entity(entity: EntityCreate, db: Session = Depends(get_db)):
    """Create a new entity"""
    import uuid
    existing = db.query(EntityModel).filter(EntityModel.name == entity.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Entity with this name already exists")
    db_entity = EntityModel(id=str(uuid.uuid4()), **entity.dict())
    db.add(db_entity)
    db.commit()
    db.refresh(db_entity)
    return db_entity


@router.patch("/{entity_id}", response_model=Entity)
async def update_entity(
    entity_id: str,
    entity: EntityUpdate,
    db: Session = Depends(get_db)
):
    """Update an entity"""
    db_entity = db.query(EntityModel).filter(EntityModel.id == entity_id).first()
    if not db_entity:
        raise HTTPException(status_code=404, detail="Entity not found")

    for key, value in entity.dict(exclude_unset=True).items():
        setattr(db_entity, key, value)

    db.commit()
    db.refresh(db_entity)
    return db_entity


@router.delete("/{entity_id}")
async def delete_entity(entity_id: str, db: Session = Depends(get_db)):
    """Delete an entity"""
    db_entity = db.query(EntityModel).filter(EntityModel.id == entity_id).first()
    if not db_entity:
        raise HTTPException(status_code=404, detail="Entity not found")

    db.delete(db_entity)
    db.commit()
    return {"message": "Entity deleted successfully"}
