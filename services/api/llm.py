"""
Unified LLM provider using LiteLLM.
Supports: Ollama (local/free), OpenAI, AWS Bedrock.
Configure via environment variables.
"""
import os
import litellm
from typing import Optional

litellm.set_verbose = False

# Read from environment variables with proper defaults
_llm_provider = os.getenv("LLM_PROVIDER", "ollama").lower().strip()
_llm_model = os.getenv("LLM_MODEL", "ollama/llama3.2").lower().strip()

# Normalize provider names
if _llm_provider in ["bedrock", "aws"]:
    LLM_PROVIDER = "bedrock"
elif _llm_provider in ["openai", "gpt"]:
    LLM_PROVIDER = "openai"
else:
    LLM_PROVIDER = "ollama"

LLM_MODEL = _llm_model

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID", "")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "")
AWS_REGION_NAME = os.getenv("AWS_REGION_NAME", "us-east-1")

if LLM_PROVIDER == "ollama":
    litellm.ollama_base_url = OLLAMA_BASE_URL


async def chat_completion(
    messages: list,
    model: Optional[str] = None,
    temperature: float = 0.3,
    max_tokens: int = 1000,
    json_mode: bool = False,
) -> str:
    """
    Unified chat completion across all providers.
    Returns the text content of the response.
    Raises on failure — callers should catch and fallback if needed.
    """
    use_model = model or LLM_MODEL

    kwargs: dict = {
        "model": use_model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    if json_mode and "openai" in use_model:
        kwargs["response_format"] = {"type": "json_object"}

    if "bedrock" in use_model:
        kwargs["aws_access_key_id"] = AWS_ACCESS_KEY_ID
        kwargs["aws_secret_access_key"] = AWS_SECRET_ACCESS_KEY
        kwargs["aws_region_name"] = AWS_REGION_NAME
    elif "openai" in use_model or use_model.startswith("gpt"):
        kwargs["api_key"] = OPENAI_API_KEY

    response = await litellm.acompletion(**kwargs)
    return response.choices[0].message.content


def chat_completion_sync(
    messages: list,
    model: Optional[str] = None,
    temperature: float = 0.3,
    max_tokens: int = 1000,
    json_mode: bool = False,
) -> str:
    """Synchronous wrapper for use in non-async contexts (e.g. processor worker)."""
    import asyncio
    return asyncio.run(chat_completion(messages, model, temperature, max_tokens, json_mode))


def get_available_models() -> list:
    """Return configured models with live availability status."""
    models = []

    # Only check Ollama if it's the active provider
    if LLM_PROVIDER == "ollama":
        models.append({
            "id": LLM_MODEL if "ollama" in LLM_MODEL else "ollama/llama3.2",
            "provider": "ollama",
            "name": "Llama 3.2 (Local)",
            "description": "Local Ollama instance — free, private",
            "available": _check_ollama(),
        })

    if OPENAI_API_KEY:
        models.append({
            "id": "openai/gpt-4o",
            "provider": "openai",
            "name": "GPT-4o",
            "description": "OpenAI GPT-4o",
            "available": True,
        })
        models.append({
            "id": "openai/gpt-4o-mini",
            "provider": "openai",
            "name": "GPT-4o Mini",
            "description": "OpenAI GPT-4o Mini (fast, cheap)",
            "available": True,
        })

    if AWS_ACCESS_KEY_ID:
        bedrock_models = [
            {
                "id": "bedrock/us.anthropic.claude-sonnet-4-6",
                "provider": "bedrock",
                "name": "Claude Sonnet 4.6 (Bedrock)",
                "description": "Anthropic Claude Sonnet 4.6 via AWS Bedrock (cross-region inference)",
                "available": True,
            },
            {
                "id": "bedrock/anthropic.claude-3-sonnet-20240229-v1:0",
                "provider": "bedrock",
                "name": "Claude 3 Sonnet (Bedrock)",
                "description": "Anthropic Claude 3 Sonnet via AWS Bedrock",
                "available": True,
            },
            {
                "id": "bedrock/anthropic.claude-3-haiku-20240307-v1:0",
                "provider": "bedrock",
                "name": "Claude 3 Haiku (Bedrock)",
                "description": "Fast, cheap Anthropic model via AWS Bedrock",
                "available": True,
            },
        ]
        # Ensure the active model is always present in the list
        known_ids = {m["id"] for m in bedrock_models}
        if "bedrock" in LLM_MODEL and LLM_MODEL not in known_ids:
            bedrock_models.insert(0, {
                "id": LLM_MODEL,
                "provider": "bedrock",
                "name": f"{LLM_MODEL.split('/')[-1]} (Bedrock)",
                "description": "Active Bedrock model (from LLM_MODEL env var)",
                "available": True,
            })
        models.extend(bedrock_models)

    return models


def _check_ollama() -> bool:
    """Check if the Ollama server is reachable."""
    try:
        import urllib.request
        urllib.request.urlopen(f"{OLLAMA_BASE_URL}/api/tags", timeout=2)
        return True
    except Exception:
        return False
