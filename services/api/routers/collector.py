from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from pydantic import BaseModel
from database import get_db
from models.models import BrowserSession as BrowserSessionModel, Document as DocumentModel, CollectionTarget
import json
import asyncio

router = APIRouter()

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except:
                pass

manager = ConnectionManager()


class StartCollectionRequest(BaseModel):
    platform: str
    target: str
    headless: Optional[bool] = True


@router.get("/status")
async def get_collector_status(db: Session = Depends(get_db)):
    """Get overall collector service status"""
    active_sessions = db.query(func.count()).filter(
        BrowserSessionModel.status == "running"
    ).scalar() or 0

    total_sessions = db.query(func.count()).select_from(BrowserSessionModel).scalar() or 0

    total_collected = db.query(func.sum(BrowserSessionModel.items_collected)).scalar() or 0

    return {
        "status": "operational",
        "active_sessions": active_sessions,
        "total_sessions": total_sessions,
        "total_items_collected": total_collected,
    }


@router.get("/sessions")
async def get_browser_sessions(db: Session = Depends(get_db)):
    """Get all browser collection sessions"""
    sessions = db.query(BrowserSessionModel).order_by(
        BrowserSessionModel.started_at.desc()
    ).limit(50).all()
    return sessions


@router.get("/sessions/{session_id}")
async def get_browser_session(session_id: str, db: Session = Depends(get_db)):
    """Get a specific browser session"""
    session = db.query(BrowserSessionModel).filter(
        BrowserSessionModel.id == session_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.post("/start")
async def start_collection(
    body: StartCollectionRequest,
    db: Session = Depends(get_db)
):
    """Start a new on-demand collection job.
    
    Creates a CollectionTarget with mode=on_demand and immediately triggers it,
    returning a BrowserSession record for progress tracking.
    """
    target = CollectionTarget(
        name=f"{body.platform.capitalize()} – {body.target[:60]}",
        platform=body.platform,
        target=body.target,
        target_type="keyword",
        mode="on_demand",
        headless=body.headless if body.headless is not None else True,
        enabled=True,
    )
    db.add(target)
    db.commit()
    db.refresh(target)

    mode = "headless" if target.headless else "headed"
    session = BrowserSessionModel(
        url=body.target,
        platform=body.platform,
        mode=mode,
        status="running",
        items_collected=0,
        progress=0.0,
        issues=[],
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    # Enqueue to Redis for the collector service
    try:
        import redis as redis_lib
        import os
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
        r = redis_lib.from_url(redis_url)
        job_data = json.dumps({
            "id": session.id,
            "url": body.target,
            "platform": body.platform,
            "max_items": 50,
            "headless": target.headless,
        })
        r.rpush("collection:high", job_data)
    except Exception:
        pass  # Non-fatal

    return session


@router.post("/stop/{session_id}")
async def stop_collection(session_id: str, db: Session = Depends(get_db)):
    """Stop a running collection session"""
    from datetime import datetime
    session = db.query(BrowserSessionModel).filter(
        BrowserSessionModel.id == session_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.status = "completed"
    if not session.completed_at:
        session.completed_at = datetime.utcnow()

    # Reset is_running on the matching collection target
    target = db.query(CollectionTarget).filter(
        CollectionTarget.platform == session.platform,
        CollectionTarget.target == session.url,
    ).first()
    if target is None:
        # Fallback: substring match
        target = db.query(CollectionTarget).filter(
            CollectionTarget.platform == session.platform,
            CollectionTarget.is_running == True,
        ).first()
    if target:
        target.is_running = False

    db.commit()
    return {"status": "stopped", "session_id": session_id}


@router.post("/sessions/{session_id}/control")
async def control_browser_session(
    session_id: str,
    action: str,  # pause, resume, stop
    db: Session = Depends(get_db)
):
    """Control a browser session (pause/resume/stop)"""
    session = db.query(BrowserSessionModel).filter(
        BrowserSessionModel.id == session_id
    ).first()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    from datetime import datetime
    action_map = {
        "pause": "paused",
        "resume": "running",
        "stop": "completed",
    }
    if action not in action_map:
        raise HTTPException(status_code=400, detail=f"Unknown action: {action}")

    new_status = action_map[action]
    session.status = new_status

    if new_status == "completed" and not session.completed_at:
        session.completed_at = datetime.utcnow()

    # Reset is_running on the matching collection target when stopping
    if new_status == "completed":
        target = db.query(CollectionTarget).filter(
            CollectionTarget.platform == session.platform,
            CollectionTarget.target == session.url,
        ).first()
        if target is None:
            target = db.query(CollectionTarget).filter(
                CollectionTarget.platform == session.platform,
                CollectionTarget.is_running == True,
            ).first()
        if target:
            target.is_running = False

    db.commit()
    return {"status": "success", "action": action}


@router.websocket("/sessions/{session_id}/stream")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """WebSocket endpoint for real-time session updates"""
    await manager.connect(websocket)
    try:
        while True:
            await asyncio.sleep(2)
            await websocket.send_json({
                "type": "log",
                "message": f"Session {session_id} is running...",
                "timestamp": str(asyncio.get_event_loop().time())
            })
    except WebSocketDisconnect:
        manager.disconnect(websocket)
