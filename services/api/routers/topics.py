from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from typing import List, Optional
from database import get_db
from models.models import Topic as TopicModel, Document as DocumentModel
from models.schemas import Topic, TopicCreate, TopicUpdate, Document

router = APIRouter()


@router.get("/")
async def get_topics(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get all topics with pagination and sentiment averages"""
    # Get topics with sentiment averages calculated from documents
    try:
        query = text("""
            SELECT 
                t.id,
                t.name,
                t.description,
                t.parent_id,
                t.document_count,
                t.created_at,
                COALESCE(AVG(d.sentiment), 0) as sentiment_avg
            FROM topics t
            LEFT JOIN documents d ON d.topics::jsonb ? t.name
            GROUP BY t.id, t.name, t.description, t.parent_id, t.document_count, t.created_at
            ORDER BY t.document_count DESC
            LIMIT :limit OFFSET :skip
        """)
        results = db.execute(query, {"limit": limit, "skip": skip}).fetchall()
        
        return [
            {
                "id": r.id,
                "name": r.name,
                "description": r.description,
                "parent_id": r.parent_id,
                "document_count": r.document_count or 0,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "sentiment_avg": float(r.sentiment_avg) if r.sentiment_avg else 0.0
            }
            for r in results
        ]
    except Exception as e:
        # Fallback to simple query without sentiment
        topics = db.query(TopicModel).offset(skip).limit(limit).all()
        return [
            {
                "id": t.id,
                "name": t.name,
                "description": t.description,
                "parent_id": t.parent_id,
                "document_count": t.document_count or 0,
                "created_at": t.created_at.isoformat() if t.created_at else None,
                "sentiment_avg": 0.0
            }
            for t in topics
        ]


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
