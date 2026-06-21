from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models.models import BrowserSession as BrowserSessionModel
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

@router.get("/sessions")
async def get_browser_sessions(db: Session = Depends(get_db)):
    """Get all browser collection sessions"""
    sessions = db.query(BrowserSessionModel).filter(
        BrowserSessionModel.status.in_(["running", "paused"])
    ).all()
    return sessions

@router.get("/sessions/{session_id}")
async def get_browser_session(session_id: str, db: Session = Depends(get_db)):
    """Get a specific browser session"""
    session = db.query(BrowserSessionModel).filter(
        BrowserSessionModel.id == session_id
    ).first()
    return session

@router.post("/sessions")
async def create_browser_session(
    url: str,
    platform: str,
    mode: str = "headless",
    db: Session = Depends(get_db)
):
    """Create a new browser collection session"""
    session = BrowserSessionModel(
        url=url,
        platform=platform,
        mode=mode,
        status="running"
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session

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
        return {"error": "Session not found"}
    
    if action == "pause":
        session.status = "paused"
    elif action == "resume":
        session.status = "running"
    elif action == "stop":
        session.status = "completed"
    
    db.commit()
    return {"status": "success", "action": action}

@router.post("/trigger-headed")
async def trigger_headed_mode(url: str, platform: str, db: Session = Depends(get_db)):
    """Manually trigger headed mode for a URL"""
    session = BrowserSessionModel(
        url=url,
        platform=platform,
        mode="headed",
        status="running"
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session

@router.websocket("/sessions/{session_id}/stream")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """WebSocket endpoint for real-time session updates"""
    await manager.connect(websocket)
    try:
        while True:
            # Send periodic updates
            await asyncio.sleep(2)
            await websocket.send_json({
                "type": "log",
                "message": f"Session {session_id} is running...",
                "timestamp": str(asyncio.get_event_loop().time())
            })
    except WebSocketDisconnect:
        manager.disconnect(websocket)
