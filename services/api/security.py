# Authentication, Authorization, and Security

import logging
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status, Security
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm, HTTPBearer, HTTPAuthorizationCredentials
import secrets
from enum import Enum

logger = logging.getLogger(__name__)

# Configuration
SECRET_KEY = secrets.token_urlsafe(32)  # Generate secure key
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
REFRESH_TOKEN_EXPIRE_DAYS = 30

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")
security = HTTPBearer()


class Role(str, Enum):
    """User roles for RBAC"""
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    ANALYST = "analyst"
    VIEWER = "viewer"


class Permission(str, Enum):
    """Permissions for resources"""
    READ = "read"
    WRITE = "write"
    DELETE = "delete"
    ADMIN = "admin"


# Role-Permission mapping
ROLE_PERMISSIONS = {
    Role.SUPER_ADMIN: [Permission.READ, Permission.WRITE, Permission.DELETE, Permission.ADMIN],
    Role.ADMIN: [Permission.READ, Permission.WRITE, Permission.DELETE],
    Role.ANALYST: [Permission.READ, Permission.WRITE],
    Role.VIEWER: [Permission.READ]
}


class SecurityManager:
    """Centralized security management"""
    
    def __init__(self):
        logger.info("Initializing Security Manager...")
        self.audit_log = []
        logger.info("Security Manager initialized")
    
    def hash_password(self, password: str) -> str:
        """Hash password using bcrypt"""
        return pwd_context.hash(password)
    
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify password against hash"""
        return pwd_context.verify(plain_password, hashed_password)
    
    def create_access_token(self, data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
        """Create JWT access token"""
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        
        to_encode.update({
            "exp": expire,
            "iat": datetime.utcnow(),
            "type": "access"
        })
        
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        return encoded_jwt
    
    def create_refresh_token(self, data: Dict[str, Any]) -> str:
        """Create JWT refresh token"""
        to_encode = data.copy()
        expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
        
        to_encode.update({
            "exp": expire,
            "iat": datetime.utcnow(),
            "type": "refresh"
        })
        
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        return encoded_jwt
    
    def decode_token(self, token: str) -> Dict[str, Any]:
        """Decode and validate JWT token"""
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            return payload
        except JWTError as e:
            logger.error(f"Token validation failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"}
            )
    
    def check_permission(self, user_role: Role, required_permission: Permission) -> bool:
        """Check if user role has required permission"""
        user_permissions = ROLE_PERMISSIONS.get(user_role, [])
        return required_permission in user_permissions
    
    def log_audit(self, event: Dict[str, Any]):
        """Log security audit event"""
        audit_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "event": event["action"],
            "user": event.get("user", "unknown"),
            "resource": event.get("resource", ""),
            "status": event.get("status", "success"),
            "ip_address": event.get("ip_address", ""),
            "details": event.get("details", {})
        }
        self.audit_log.append(audit_entry)
        
        # In production, write to database or log file
        logger.info(f"Audit: {audit_entry}")
    
    def get_audit_logs(self, filters: Dict[str, Any] = None, limit: int = 100) -> List[Dict[str, Any]]:
        """Retrieve audit logs"""
        logs = self.audit_log[-limit:]
        
        if filters:
            if filters.get("user"):
                logs = [log for log in logs if log["user"] == filters["user"]]
            if filters.get("action"):
                logs = [log for log in logs if log["event"] == filters["action"]]
            if filters.get("start_date"):
                logs = [log for log in logs if log["timestamp"] >= filters["start_date"]]
        
        return logs


class DataEncryption:
    """Data encryption at rest and in transit"""
    
    def __init__(self):
        from cryptography.fernet import Fernet
        self.key = Fernet.generate_key()
        self.cipher = Fernet(self.key)
    
    def encrypt(self, data: str) -> bytes:
        """Encrypt sensitive data"""
        return self.cipher.encrypt(data.encode())
    
    def decrypt(self, encrypted_data: bytes) -> str:
        """Decrypt sensitive data"""
        return self.cipher.decrypt(encrypted_data).decode()


# Dependency for protected routes
async def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)) -> Dict[str, Any]:
    """Dependency to get current authenticated user"""
    token = credentials.credentials
    security_manager = SecurityManager()
    payload = security_manager.decode_token(token)
    
    username = payload.get("sub")
    if username is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )
    
    return {
        "username": username,
        "role": payload.get("role", Role.VIEWER),
        "permissions": ROLE_PERMISSIONS.get(payload.get("role", Role.VIEWER), [])
    }


async def require_permission(permission: Permission):
    """Dependency to require specific permission"""
    async def permission_checker(current_user: Dict = Depends(get_current_user)):
        user_role = current_user["role"]
        security_manager = SecurityManager()
        
        if not security_manager.check_permission(user_role, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required: {permission.value}"
            )
        return current_user
    
    return permission_checker


# Initialize global security manager
security_manager = SecurityManager()
data_encryption = DataEncryption()


if __name__ == "__main__":
    # Test security features
    sm = SecurityManager()
    
    # Test password hashing
    password = "secure_password_123"
    hashed = sm.hash_password(password)
    print("Password hashed:", hashed[:20] + "...")
    print("Verification:", sm.verify_password(password, hashed))
    
    # Test token generation
    token = sm.create_access_token({"sub": "admin", "role": Role.ADMIN.value})
    print("Token generated:", token[:20] + "...")
    
    # Test token decoding
    decoded = sm.decode_token(token)
    print("Token decoded:", decoded)
    
    # Test audit logging
    sm.log_audit({
        "action": "login",
        "user": "admin",
        "status": "success",
        "ip_address": "192.168.1.1"
    })
    print("Audit logs:", len(sm.get_audit_logs()))
