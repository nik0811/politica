from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models.models import Topic as TopicModel, Document as DocumentModel
from models.schemas import Topic, TopicCreate, TopicUpdate, Document

router = APIRouter()


@router.get("/", response_model=List[Topic])
async def get_topics(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get all topics with pagination"""
    return db.query(TopicModel).offset(skip).limit(limit).all()


@router.get("/{topic_id}/documents", response_model=List[Document])
async def get_topic_documents(
    topic_id: str,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """Get all documents that mention a specific topic"""
    topic = db.query(TopicModel).filter(TopicModel.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    documents = (
        db.query(DocumentModel)
        .filter(DocumentModel.topics.contains(topic.name))
        .offset(skip)
        .limit(limit)
        .all()
    )
    return documents


@router.get("/{topic_id}", response_model=Topic)
async def get_topic(topic_id: str, db: Session = Depends(get_db)):
    """Get a specific topic"""
    topic = db.query(TopicModel).filter(TopicModel.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    return topic


@router.post("/", response_model=Topic, status_code=201)
async def create_topic(topic: TopicCreate, db: Session = Depends(get_db)):
    """Create a new topic"""
    import uuid
    existing = db.query(TopicModel).filter(TopicModel.name == topic.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Topic with this name already exists")
    db_topic = TopicModel(id=str(uuid.uuid4()), **topic.dict())
    db.add(db_topic)
    db.commit()
    db.refresh(db_topic)
    return db_topic


@router.patch("/{topic_id}", response_model=Topic)
async def update_topic(
    topic_id: str,
    topic: TopicUpdate,
    db: Session = Depends(get_db)
):
    """Update a topic"""
    db_topic = db.query(TopicModel).filter(TopicModel.id == topic_id).first()
    if not db_topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    for key, value in topic.dict(exclude_unset=True).items():
        setattr(db_topic, key, value)

    db.commit()
    db.refresh(db_topic)
    return db_topic


@router.delete("/{topic_id}")
async def delete_topic(topic_id: str, db: Session = Depends(get_db)):
    """Delete a topic"""
    db_topic = db.query(TopicModel).filter(TopicModel.id == topic_id).first()
    if not db_topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    db.delete(db_topic)
    db.commit()
    return {"message": "Topic deleted successfully"}
