from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models.models import Topic as TopicModel

router = APIRouter()

@router.get("/")
async def get_topics(db: Session = Depends(get_db)):
    """Get all topics"""
    topics = db.query(TopicModel).all()
    return topics

@router.get("/{topic_id}")
async def get_topic(topic_id: str, db: Session = Depends(get_db)):
    """Get a specific topic"""
    topic = db.query(TopicModel).filter(TopicModel.id == topic_id).first()
    return topic
