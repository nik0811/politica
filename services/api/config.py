import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Environment
    ENVIRONMENT: str = "development"
    
    # Database
    DATABASE_URL: str = "postgresql://politica:politica_dev_pass@localhost:5432/politica"
    
    # Redis
    REDIS_URL: str = "redis://redis:6379"
    
    # MinIO
    MINIO_ENDPOINT: str = "minio:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_SECURE: bool = False
    
    # Qdrant
    QDRANT_URL: str = "http://qdrant:6333"
    
    # Elasticsearch
    ELASTICSEARCH_URL: str = "http://elasticsearch:9200"
    
    # Security
    SECRET_KEY: str = "politica-secret-key-change-in-production-use-openssl-rand-hex-32"
    JWT_SECRET: str = "your-secret-key-change-in-production"
    API_SECRET_KEY: str = "your-api-secret-change-in-production"
    
    # API
    API_V1_PREFIX: str = "/api"

    # LLM Provider (LiteLLM)
    LLM_PROVIDER: str = "ollama"       # ollama | openai | bedrock
    LLM_MODEL: str = "ollama/llama3.2"
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"  # Allow extra env vars

settings = Settings()
