from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import Column, String, Boolean, Text, DateTime, JSON, func
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from database import get_db, Base
from auth import require_role
from config import settings
import uuid

router = APIRouter()

def generate_uuid():
    return str(uuid.uuid4())

# Settings model
class Settings(Base):
    __tablename__ = "settings"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    category = Column(String, nullable=False)
    key = Column(String, nullable=False, unique=True)
    value = Column(JSON, nullable=False)
    description = Column(Text)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

# Pydantic schemas
class SettingUpdate(BaseModel):
    value: Any

class SettingResponse(BaseModel):
    id: str
    category: str
    key: str
    value: Any
    description: Optional[str]
    updated_at: Any
    
    class Config:
        from_attributes = True

@router.get("/")
async def get_all_settings(db: Session = Depends(get_db)):
    """Get all settings grouped by category"""
    Base.metadata.create_all(bind=db.get_bind())
    
    settings = db.query(Settings).all()
    
    # Group by category
    grouped = {}
    for setting in settings:
        if setting.category not in grouped:
            grouped[setting.category] = {}
        grouped[setting.category][setting.key] = {
            "value": setting.value,
            "description": setting.description
        }
    
    # If no settings exist, return defaults
    if not grouped:
        grouped = {
            "general": {
                "platform_name": {"value": "Politica", "description": "Platform name"},
                "organization": {"value": "Politica Intelligence Labs", "description": "Organization name"},
                "timezone": {"value": "Asia/Kolkata (IST +5:30)", "description": "Platform timezone"},
                "dark_mode": {"value": True, "description": "Enable dark mode"}
            },
            "notifications": {
                "email_enabled": {"value": True, "description": "Enable email notifications"},
                "slack_enabled": {"value": False, "description": "Enable Slack integration"},
                "daily_digest": {"value": True, "description": "Send daily digest"}
            },
            "processing": {
                "auto_process": {"value": True, "description": "Auto-process new documents"},
                "nlp_enabled": {"value": True, "description": "Enable NLP enrichment"},
                "min_confidence": {"value": 0.75, "description": "Minimum confidence threshold"}
            },
            "security": {
                "two_factor": {"value": False, "description": "Require 2FA"},
                "session_timeout": {"value": True, "description": "Auto-logout after 30 minutes"},
                "audit_log": {"value": True, "description": "Record all admin actions"}
            }
        }
    
    return grouped

@router.get("/{category}")
async def get_settings_by_category(category: str, db: Session = Depends(get_db)):
    """Get settings for a specific category"""
    Base.metadata.create_all(bind=db.get_bind())
    
    settings = db.query(Settings).filter(Settings.category == category).all()
    
    result = {}
    for setting in settings:
        result[setting.key] = {
            "value": setting.value,
            "description": setting.description
        }
    
    return result

@router.put("/{category}/{key}")
async def update_setting(
    category: str,
    key: str,
    update: SettingUpdate,
    db: Session = Depends(get_db),
    _: dict = Depends(require_role(["Admin"])),
):
    """Update a specific setting"""
    Base.metadata.create_all(bind=db.get_bind())
    
    setting = db.query(Settings).filter(
        Settings.category == category,
        Settings.key == key
    ).first()
    
    if setting:
        setting.value = update.value
        db.commit()
        db.refresh(setting)
        return {"message": "Setting updated", "value": setting.value}
    else:
        # Create new setting
        new_setting = Settings(
            id=generate_uuid(),
            category=category,
            key=key,
            value=update.value,
            description=f"{key} setting"
        )
        db.add(new_setting)
        db.commit()
        db.refresh(new_setting)
        return {"message": "Setting created", "value": new_setting.value}

@router.post("/bulk-update")
async def bulk_update_settings(
    settings_data: Dict[str, Dict[str, Any]],
    db: Session = Depends(get_db),
    _: dict = Depends(require_role(["Admin"])),
):
    """Bulk update settings"""
    Base.metadata.create_all(bind=db.get_bind())
    
    updated_count = 0
    for category, category_settings in settings_data.items():
        for key, value_data in category_settings.items():
            setting = db.query(Settings).filter(
                Settings.category == category,
                Settings.key == key
            ).first()
            
            if setting:
                setting.value = value_data.get("value")
                updated_count += 1
            else:
                new_setting = Settings(
                    id=generate_uuid(),
                    category=category,
                    key=key,
                    value=value_data.get("value"),
                    description=value_data.get("description", f"{key} setting")
                )
                db.add(new_setting)
                updated_count += 1
    
    db.commit()
    return {"message": f"Updated {updated_count} settings"}

# ─── LLM Provider Configuration ──────────────────────────────────────────────

class LLMModel(BaseModel):
    id: str
    provider: str
    name: str
    description: str
    available: bool

class LLMProviderConfig(BaseModel):
    active_provider: str
    active_model: str
    available_models: List[LLMModel]

@router.get("/llm-provider", response_model=LLMProviderConfig)
async def get_llm_provider_config():
    """Get the current LLM provider configuration from environment variables"""
    
    # Parse the active provider and model from config
    active_provider = settings.LLM_PROVIDER.lower()
    active_model = settings.LLM_MODEL
    
    # Define available models for each provider
    bedrock_models = [
        LLMModel(
            id="bedrock/us.anthropic.claude-sonnet-4-6",
            provider="bedrock",
            name="Claude Sonnet 4.6",
            description="Latest Claude model with improved reasoning",
            available=active_provider == "bedrock"
        ),
        LLMModel(
            id="bedrock/anthropic.claude-3-sonnet-20240229-v1:0",
            provider="bedrock",
            name="Claude 3 Sonnet",
            description="Balanced performance and speed",
            available=active_provider == "bedrock"
        ),
        LLMModel(
            id="bedrock/anthropic.claude-3-haiku-20240307-v1:0",
            provider="bedrock",
            name="Claude 3 Haiku",
            description="Fast and cost-effective",
            available=active_provider == "bedrock"
        ),
        LLMModel(
            id="bedrock/anthropic.claude-3-opus-20240229-v1:0",
            provider="bedrock",
            name="Claude 3 Opus",
            description="Most capable model",
            available=active_provider == "bedrock"
        ),
    ]
    
    ollama_models = [
        LLMModel(
            id="ollama/llama3.2",
            provider="ollama",
            name="Llama 3.2",
            description="Open-source model (local)",
            available=active_provider == "ollama"
        ),
        LLMModel(
            id="ollama/mistral",
            provider="ollama",
            name="Mistral",
            description="Fast open-source model (local)",
            available=active_provider == "ollama"
        ),
    ]
    
    openai_models = [
        LLMModel(
            id="openai/gpt-4o",
            provider="openai",
            name="GPT-4o",
            description="Latest OpenAI model",
            available=active_provider == "openai"
        ),
        LLMModel(
            id="openai/gpt-4-turbo",
            provider="openai",
            name="GPT-4 Turbo",
            description="Fast and capable",
            available=active_provider == "openai"
        ),
    ]
    
    # Combine all models
    all_models = bedrock_models + ollama_models + openai_models
    
    return LLMProviderConfig(
        active_provider=active_provider,
        active_model=active_model,
        available_models=all_models
    )
