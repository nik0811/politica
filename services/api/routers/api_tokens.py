from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timedelta
from pydantic import BaseModel
import secrets
import hashlib

from database import get_db
from models.models import ApiToken, generate_uuid

router = APIRouter()

TOKEN_PREFIX = "pol_"
TOKEN_BYTE_LENGTH = 16  # 32 hex chars


def _generate_raw_token() -> str:
    return TOKEN_PREFIX + secrets.token_hex(TOKEN_BYTE_LENGTH)


def _hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode()).hexdigest()


# ── Schemas ───────────────────────────────────────────────────────────────────

class TokenCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    expires_in_days: Optional[int] = None


class TokenUpdateRequest(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None


class TokenResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    token_prefix: str
    is_active: bool
    created_at: datetime
    last_used_at: Optional[datetime]
    expires_at: Optional[datetime]


class TokenCreateResponse(TokenResponse):
    raw_token: str


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.post("/generate", response_model=TokenCreateResponse, status_code=201)
async def generate_token(body: TokenCreateRequest, db: Session = Depends(get_db)):
    """Generate a new API token. The raw token is returned ONCE and never stored."""
    raw_token = _generate_raw_token()
    token_hash = _hash_token(raw_token)
    prefix_display = raw_token[:12] + "..."

    expires_at = None
    if body.expires_in_days:
        expires_at = datetime.utcnow() + timedelta(days=body.expires_in_days)

    db_token = ApiToken(
        id=generate_uuid(),
        name=body.name,
        description=body.description,
        token_hash=token_hash,
        token_prefix=prefix_display,
        is_active=True,
        expires_at=expires_at,
    )
    db.add(db_token)
    db.commit()
    db.refresh(db_token)

    return TokenCreateResponse(
        id=db_token.id,
        name=db_token.name,
        description=db_token.description,
        token_prefix=db_token.token_prefix,
        is_active=db_token.is_active,
        created_at=db_token.created_at,
        last_used_at=db_token.last_used_at,
        expires_at=db_token.expires_at,
        raw_token=raw_token,
    )


@router.get("/", response_model=list[TokenResponse])
async def list_tokens(db: Session = Depends(get_db)):
    """List all API tokens (masked, no raw token)."""
    tokens = db.query(ApiToken).order_by(ApiToken.created_at.desc()).all()
    return [
        TokenResponse(
            id=t.id,
            name=t.name,
            description=t.description,
            token_prefix=t.token_prefix,
            is_active=t.is_active,
            created_at=t.created_at,
            last_used_at=t.last_used_at,
            expires_at=t.expires_at,
        )
        for t in tokens
    ]


@router.patch("/{token_id}", response_model=TokenResponse)
async def update_token(token_id: str, body: TokenUpdateRequest, db: Session = Depends(get_db)):
    """Update token name or toggle active status."""
    db_token = db.query(ApiToken).filter(ApiToken.id == token_id).first()
    if not db_token:
        raise HTTPException(status_code=404, detail="Token not found")

    if body.name is not None:
        db_token.name = body.name
    if body.is_active is not None:
        db_token.is_active = body.is_active

    db.commit()
    db.refresh(db_token)

    return TokenResponse(
        id=db_token.id,
        name=db_token.name,
        description=db_token.description,
        token_prefix=db_token.token_prefix,
        is_active=db_token.is_active,
        created_at=db_token.created_at,
        last_used_at=db_token.last_used_at,
        expires_at=db_token.expires_at,
    )


@router.delete("/{token_id}", status_code=204)
async def delete_token(token_id: str, db: Session = Depends(get_db)):
    """Permanently revoke and delete a token."""
    db_token = db.query(ApiToken).filter(ApiToken.id == token_id).first()
    if not db_token:
        raise HTTPException(status_code=404, detail="Token not found")

    db.delete(db_token)
    db.commit()
