from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import Column, String, DateTime, Integer, JSON, func
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from database import get_db, Base
import uuid

router = APIRouter()

def generate_uuid():
    return str(uuid.uuid4())

# Workspace model
class Workspace(Base):
    __tablename__ = "workspaces"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    description = Column(String)
    owner = Column(String, nullable=False)
    saved_queries = Column(Integer, default=0)
    annotations = Column(Integer, default=0)
    tags = Column(JSON, default=list)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

# Pydantic schemas
class WorkspaceCreate(BaseModel):
    name: str
    description: Optional[str] = None
    owner: str
    tags: Optional[List[str]] = []

class WorkspaceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[List[str]] = None

class WorkspaceResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    owner: str
    saved_queries: int
    annotations: int
    tags: List[str]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

@router.get("/", response_model=List[WorkspaceResponse])
async def get_workspaces(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    """Get all workspaces"""
    # Create table if it doesn't exist
    Base.metadata.create_all(bind=db.get_bind())
    
    workspaces = db.query(Workspace).offset(skip).limit(limit).all()
    return workspaces

@router.get("/{workspace_id}", response_model=WorkspaceResponse)
async def get_workspace(workspace_id: str, db: Session = Depends(get_db)):
    """Get a specific workspace"""
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return workspace

@router.post("/", response_model=WorkspaceResponse)
async def create_workspace(workspace: WorkspaceCreate, db: Session = Depends(get_db)):
    """Create a new workspace"""
    # Create table if it doesn't exist
    Base.metadata.create_all(bind=db.get_bind())
    
    db_workspace = Workspace(
        id=generate_uuid(),
        name=workspace.name,
        description=workspace.description,
        owner=workspace.owner,
        tags=workspace.tags or []
    )
    db.add(db_workspace)
    db.commit()
    db.refresh(db_workspace)
    return db_workspace

@router.patch("/{workspace_id}", response_model=WorkspaceResponse)
async def update_workspace(
    workspace_id: str,
    workspace: WorkspaceUpdate,
    db: Session = Depends(get_db)
):
    """Update a workspace"""
    db_workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not db_workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    for key, value in workspace.dict(exclude_unset=True).items():
        setattr(db_workspace, key, value)
    
    db.commit()
    db.refresh(db_workspace)
    return db_workspace

@router.delete("/{workspace_id}")
async def delete_workspace(workspace_id: str, db: Session = Depends(get_db)):
    """Delete a workspace"""
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    db.delete(workspace)
    db.commit()
    return {"message": "Workspace deleted successfully"}
