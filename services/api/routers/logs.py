from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import Column, String, DateTime, Text, func
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from database import get_db, Base
import uuid

router = APIRouter()

def generate_uuid():
    return str(uuid.uuid4())

# AuditLog model
class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    level = Column(String, nullable=False)  # info, success, warning, error
    action = Column(String, nullable=False)
    detail = Column(Text)
    user = Column(String, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

# Pydantic schemas
class AuditLogCreate(BaseModel):
    level: str
    action: str
    detail: Optional[str] = None
    user: str

class AuditLogResponse(BaseModel):
    id: str
    level: str
    action: str
    detail: Optional[str]
    user: str
    created_at: datetime
    
    class Config:
        from_attributes = True

@router.get("/", response_model=List[AuditLogResponse])
async def get_logs(
    skip: int = 0,
    limit: int = 100,
    level: Optional[str] = None,
    user: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get audit logs with filtering"""
    # Create table if it doesn't exist
    Base.metadata.create_all(bind=db.get_bind())
    
    query = db.query(AuditLog)
    
    if level and level != "all":
        query = query.filter(AuditLog.level == level)
    
    if user:
        query = query.filter(AuditLog.user == user)
    
    logs = query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()
    return logs

@router.post("/", response_model=AuditLogResponse)
async def create_log(log: AuditLogCreate, db: Session = Depends(get_db)):
    """Create a new audit log entry"""
    Base.metadata.create_all(bind=db.get_bind())
    
    db_log = AuditLog(
        id=generate_uuid(),
        level=log.level,
        action=log.action,
        detail=log.detail,
        user=log.user
    )
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log

@router.get("/stats")
async def get_log_stats(db: Session = Depends(get_db)):
    """Get log statistics by level"""
    Base.metadata.create_all(bind=db.get_bind())
    
    stats = {}
    for level in ["success", "error", "warning", "info"]:
        count = db.query(func.count()).filter(AuditLog.level == level).scalar()
        stats[level] = count or 0
    
    return stats
