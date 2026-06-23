"""
Audit Logging Middleware
Automatically tracks significant user actions and writes to the audit_logs table.
"""

import uuid
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from jose import JWTError, jwt

from database import SessionLocal
from routers.logs import AuditLog
from config import settings

logger = logging.getLogger(__name__)

SECRET_KEY = settings.SECRET_KEY if hasattr(settings, 'SECRET_KEY') else "your-secret-key-change-this-in-production"
ALGORITHM = "HS256"

SENSITIVE_GET_PREFIXES = ("/api/settings", "/api/users")

ACTION_MAP = {
    ("POST", "/api/auth/login"): "User Login",
    ("POST", "/api/auth/register"): "User Registered",
    ("POST", "/api/documents"): "Document Created",
    ("PUT", "/api/documents"): "Document Updated",
    ("PATCH", "/api/documents"): "Document Updated",
    ("DELETE", "/api/documents"): "Document Deleted",
    ("POST", "/api/topics"): "Topic Created",
    ("PUT", "/api/topics"): "Topic Updated",
    ("DELETE", "/api/topics"): "Topic Deleted",
    ("POST", "/api/promises"): "Promise Created",
    ("PUT", "/api/promises"): "Promise Updated",
    ("DELETE", "/api/promises"): "Promise Deleted",
    ("POST", "/api/entities"): "Entity Created",
    ("PUT", "/api/entities"): "Entity Updated",
    ("DELETE", "/api/entities"): "Entity Deleted",
    ("POST", "/api/collector"): "Collection Started",
    ("PUT", "/api/settings"): "Settings Updated",
    ("PATCH", "/api/settings"): "Settings Updated",
    ("POST", "/api/workspaces"): "Workspace Created",
    ("PUT", "/api/workspaces"): "Workspace Updated",
    ("DELETE", "/api/workspaces"): "Workspace Deleted",
    ("POST", "/api/research"): "Research Created",
    ("POST", "/api/media"): "Media Uploaded",
    ("POST", "/api/users"): "User Created",
    ("PUT", "/api/users"): "User Updated",
    ("DELETE", "/api/users"): "User Deleted",
}


def _should_log(method: str, path: str) -> bool:
    """Determine if this request should be logged."""
    if method in ("POST", "PUT", "PATCH", "DELETE"):
        return True
    if method == "GET" and path.startswith(SENSITIVE_GET_PREFIXES):
        return True
    return False


def _get_action_name(method: str, path: str) -> str:
    """Generate a descriptive action name from method and path."""
    for (m, prefix), action in ACTION_MAP.items():
        if method == m and path.startswith(prefix):
            return action

    resource = path.rstrip("/").split("/api/")[-1].split("/")[0] if "/api/" in path else path
    resource = resource.replace("-", " ").replace("_", " ").title()

    method_labels = {
        "GET": "Viewed",
        "POST": "Created",
        "PUT": "Updated",
        "PATCH": "Updated",
        "DELETE": "Deleted",
    }
    verb = method_labels.get(method, method)
    return f"{resource} {verb}"


def _get_level(status_code: int) -> str:
    """Map HTTP status code to log level."""
    if 200 <= status_code < 300:
        return "success"
    if 400 <= status_code < 500:
        return "warning"
    if status_code >= 500:
        return "error"
    return "info"


def _extract_username(request: Request) -> str:
    """Extract username from JWT token in Authorization header."""
    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        return "anonymous"

    token = auth_header[7:]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub", "unknown")
    except JWTError:
        return "anonymous"


def _build_detail(method: str, path: str, status_code: int) -> str:
    """Build a detail string for the log entry."""
    return f"{method} {path} → {status_code}"


class AuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        method = request.method
        path = request.url.path

        # Cache request body for login endpoint so we can extract username
        login_username = None
        if method == "POST" and path == "/api/auth/login":
            try:
                body = await request.body()
                import json as _json
                payload = _json.loads(body)
                login_username = payload.get("username", "unknown")
            except Exception:
                login_username = "unknown"

        response = await call_next(request)

        if not _should_log(method, path):
            return response

        if path.startswith("/api/logs"):
            return response

        if path in ("/", "/health", "/docs", "/openapi.json", "/redoc"):
            return response

        # Skip redirect responses (trailing slash redirects)
        if 300 <= response.status_code < 400:
            return response

        try:
            username = _extract_username(request)
            action = _get_action_name(method, path)
            level = _get_level(response.status_code)
            detail = _build_detail(method, path, response.status_code)

            if path == "/api/auth/login":
                username = login_username or "unknown"
                if response.status_code == 200:
                    action = "User Login"
                    level = "success"
                else:
                    action = "Login Failed"
                    level = "warning"

            db = SessionLocal()
            try:
                log_entry = AuditLog(
                    id=str(uuid.uuid4()),
                    level=level,
                    action=action,
                    detail=detail,
                    user=username,
                )
                db.add(log_entry)
                db.commit()
            finally:
                db.close()

        except Exception as e:
            logger.warning(f"Audit logging failed: {e}")

        return response
