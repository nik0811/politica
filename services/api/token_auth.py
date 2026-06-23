"""
API Token authentication for extension/external access.
Validates Bearer tokens against hashed tokens in the database.
Also accepts valid admin JWT tokens so the admin dashboard can access ingest stats/logs.
"""

import hashlib
from datetime import datetime
from typing import Optional, Union

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from database import get_db
from models.models import ApiToken

security = HTTPBearer(auto_error=False)


def _hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode()).hexdigest()


async def validate_api_token(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> Union[ApiToken, dict]:
    """
    Dependency that validates a Bearer token for ingestion endpoints.
    Accepts either:
      1. A pol_* API token (for extensions)
      2. A valid admin JWT token (for the admin dashboard)
    Updates last_used_at on successful API token authentication.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing API token. Provide a Bearer token in the Authorization header.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    raw_token = credentials.credentials

    # Try API token auth first (tokens start with pol_)
    if raw_token.startswith("pol_"):
        token_hash = _hash_token(raw_token)
        db_token = db.query(ApiToken).filter(ApiToken.token_hash == token_hash).first()

        if db_token is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid API token",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if not db_token.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="API token has been deactivated",
            )

        if db_token.expires_at and db_token.expires_at < datetime.utcnow():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="API token has expired",
            )

        db_token.last_used_at = datetime.utcnow()
        db.commit()
        return db_token

    # Fall back to JWT validation (for admin dashboard accessing stats/logs)
    try:
        from auth import decode_access_token
        token_data = decode_access_token(raw_token)
        return {"username": token_data.username, "user_id": token_data.user_id, "role": token_data.role}
    except HTTPException:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )
