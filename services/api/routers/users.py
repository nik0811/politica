from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import Column, String, DateTime, JSON, func
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime
from database import get_db, Base
from auth import require_role
import uuid

router = APIRouter()

def generate_uuid():
    return str(uuid.uuid4())

# User model
class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    username = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=True)  # Password hash for authentication
    role = Column(String, nullable=False)
    status = Column(String, default="active")  # active, inactive, suspended
    permissions = Column(JSON, default=list)
    last_login = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

# Pydantic schemas
class UserCreate(BaseModel):
    name: str
    username: str
    email: EmailStr
    role: str = "Viewer"
    permissions: Optional[List[str]] = ["read"]

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    status: Optional[str] = None
    permissions: Optional[List[str]] = None

class UserResponse(BaseModel):
    id: str
    name: str
    username: str
    email: str
    role: str
    status: str
    permissions: List[str]
    last_login: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

@router.get("/", response_model=List[UserResponse])
async def get_users(
    skip: int = 0,
    limit: int = 50,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get all users"""
    Base.metadata.create_all(bind=db.get_bind())
    
    query = db.query(User)
    
    if status:
        query = query.filter(User.status == status)
    
    users = query.offset(skip).limit(limit).all()
    return users

@router.get("/stats")
async def get_user_stats(db: Session = Depends(get_db)):
    """Get user statistics"""
    Base.metadata.create_all(bind=db.get_bind())
    
    total = db.query(func.count()).select_from(User).scalar() or 0
    active = db.query(func.count()).filter(User.status == "active").scalar() or 0
    inactive = db.query(func.count()).filter(User.status == "inactive").scalar() or 0
    suspended = db.query(func.count()).filter(User.status == "suspended").scalar() or 0
    
    return {
        "total": total,
        "active": active,
        "inactive": inactive,
        "suspended": suspended
    }

@router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: str, db: Session = Depends(get_db)):
    """Get a specific user"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.post("/", response_model=UserResponse)
async def create_user(user: UserCreate, db: Session = Depends(get_db)):
    """Create a new user"""
    Base.metadata.create_all(bind=db.get_bind())
    
    # Check if username or email already exists
    existing = db.query(User).filter(
        (User.username == user.username) | (User.email == user.email)
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Username or email already exists")
    
    db_user = User(
        id=generate_uuid(),
        name=user.name,
        username=user.username,
        email=user.email,
        role=user.role,
        status="active",
        permissions=user.permissions or ["read"]
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    user: UserUpdate,
    db: Session = Depends(get_db),
    _: dict = Depends(require_role(["Admin"])),
):
    """Update a user"""
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    for key, value in user.dict(exclude_unset=True).items():
        setattr(db_user, key, value)
    
    db.commit()
    db.refresh(db_user)
    return db_user

@router.delete("/{user_id}")
async def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    _: dict = Depends(require_role(["Admin"])),
):
    """Delete a user"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    db.delete(user)
    db.commit()
    return {"message": "User deleted successfully"}

@router.post("/{user_id}/login")
async def record_login(user_id: str, db: Session = Depends(get_db)):
    """Record user login"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.last_login = datetime.now()
    db.commit()
    return {"message": "Login recorded"}
