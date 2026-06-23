import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from llm import chat_completion, LLM_MODEL

router = APIRouter()


class ExtractRequest(BaseModel):
    html: str
    url: str
    platform: Optional[str] = None
    hint: Optional[str] = None


class CommentItem(BaseModel):
    author: str = ""
    content: str = ""
    likes_count: int = 0


class ExtractResponse(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    author: Optional[str] = None
    likes_count: int = 0
    comments_count: int = 0
    comments: list = []
    raw_response: Optional[str] = None


@router.post("/extract-from-html", response_model=ExtractResponse)
async def extract_from_html(
    req: ExtractRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Pass raw HTML to the configured LLM and extract structured political content data.
    Used as a fallback when the browser extension cannot parse a page automatically.
    """
    html_snippet = req.html[:8000]

    hint_line = f"Hint: {req.hint}" if req.hint else ""
    prompt = f"""You are a data extraction assistant for a political research platform.

Extract structured data from this webpage HTML.
URL: {req.url}
Platform: {req.platform or 'unknown'}
{hint_line}

HTML (may be truncated):
{html_snippet}

Return a JSON object with these fields (use null if not found):
{{
  "title": "post/article title or first 200 chars of content",
  "content": "main text content of the post",
  "author": "author username or name",
  "likes_count": 0,
  "comments_count": 0,
  "comments": [
    {{"author": "username", "content": "comment text", "likes_count": 0}}
  ]
}}

Return ONLY valid JSON, no explanation."""

    try:
        raw = await chat_completion(
            messages=[{"role": "user", "content": prompt}],
            model=LLM_MODEL,
            temperature=0,
            max_tokens=2000,
            json_mode=False,
        )

        # Strip markdown code fences if present
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            parts = cleaned.split("```")
            cleaned = parts[1] if len(parts) > 1 else cleaned
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
        cleaned = cleaned.strip()

        data = json.loads(cleaned)
        return ExtractResponse(
            title=data.get("title"),
            content=data.get("content"),
            author=data.get("author"),
            likes_count=int(data.get("likes_count") or 0),
            comments_count=int(data.get("comments_count") or 0),
            comments=data.get("comments") or [],
        )
    except json.JSONDecodeError:
        return ExtractResponse(raw_response=raw)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
