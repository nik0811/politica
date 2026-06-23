"""
Test suite for duplicate post and comment detection in ingestion endpoints.
"""
import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
import hashlib

from main import app
from database import get_db
from models.models import Document, PostComment, ApiToken, generate_uuid


client = TestClient(app)


@pytest.fixture(scope="session", autouse=True)
def setup_test_token():
    """Create a test API token for all tests."""
    from database import SessionLocal
    db = SessionLocal()
    try:
        # Check if test token already exists
        test_token_raw = "pol_test_token_12345"
        token_hash = hashlib.sha256(test_token_raw.encode()).hexdigest()
        
        existing = db.query(ApiToken).filter(ApiToken.token_hash == token_hash).first()
        if not existing:
            test_token = ApiToken(
                id=generate_uuid(),
                name="Test Token",
                token_hash=token_hash,
                token_prefix="pol_test_token_12345",
                is_active=True,
            )
            db.add(test_token)
            db.commit()
    finally:
        db.close()


@pytest.fixture
def auth_headers():
    """Return authorization headers with test token."""
    return {"Authorization": "Bearer pol_test_token_12345"}


@pytest.fixture
def sample_instagram_post():
    """Sample Instagram post data for testing."""
    import uuid
    unique_id = str(uuid.uuid4())[:8]
    
    base_post = {
        "text": "This is a test Instagram post about politics",
        "author": "Test Author",
        "author_handle": "@testauthor",
        "platform_url": f"https://instagram.com/p/ABC123_{unique_id}",
        "language": "en",
        "likes_count": 100,
        "comments_count": 2,
        "shares_count": 5,
        "views_count": 500,
        "reactions_count": 50,
        "published_at": "2024-01-15T10:00:00Z",
        "comments": [
            {
                "author": "Commenter 1",
                "author_handle": "@commenter1",
                "content": "Great post!",
                "likes_count": 10,
                "replies_count": 1,
                "published_at": "2024-01-15T11:00:00Z",
            },
            {
                "author": "Commenter 2",
                "author_handle": "@commenter2",
                "content": "I disagree with this",
                "likes_count": 5,
                "replies_count": 0,
                "published_at": "2024-01-15T12:00:00Z",
            },
        ],
    }
    
    # Store the URL for use in dependent fixtures
    base_post["_unique_id"] = unique_id
    return base_post


@pytest.fixture
def sample_instagram_post_new_comments(sample_instagram_post):
    """Same post with additional new comments."""
    return {
        "text": "This is a test Instagram post about politics",
        "author": "Test Author",
        "author_handle": "@testauthor",
        "platform_url": sample_instagram_post["platform_url"],  # Use same URL
        "language": "en",
        "likes_count": 150,  # Updated engagement
        "comments_count": 4,  # Updated count
        "shares_count": 8,
        "views_count": 750,
        "reactions_count": 75,
        "published_at": "2024-01-15T10:00:00Z",
        "comments": [
            {
                "author": "Commenter 1",
                "author_handle": "@commenter1",
                "content": "Great post!",
                "likes_count": 10,
                "replies_count": 1,
                "published_at": "2024-01-15T11:00:00Z",
            },
            {
                "author": "Commenter 2",
                "author_handle": "@commenter2",
                "content": "I disagree with this",
                "likes_count": 5,
                "replies_count": 0,
                "published_at": "2024-01-15T12:00:00Z",
            },
            {
                "author": "Commenter 3",
                "author_handle": "@commenter3",
                "content": "This is a new comment",
                "likes_count": 3,
                "replies_count": 0,
                "published_at": "2024-01-15T13:00:00Z",
            },
            {
                "author": "Commenter 4",
                "author_handle": "@commenter4",
                "content": "Another new perspective",
                "likes_count": 7,
                "replies_count": 2,
                "published_at": "2024-01-15T14:00:00Z",
            },
        ],
    }


def test_first_ingest_creates_post_with_all_comments(sample_instagram_post, auth_headers):
    """Test that first ingestion creates post with all comments."""
    response = client.post("/api/ingest/instagram", json=sample_instagram_post, headers=auth_headers)
    
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "created"
    assert data["new_comments_count"] == 2
    assert "Instagram post ingested successfully" in data["message"]
    assert "id" in data


def test_duplicate_post_with_new_comments_updates_only_new(
    sample_instagram_post,
    sample_instagram_post_new_comments,
    auth_headers,
):
    """Test that re-ingesting same post only adds new comments."""
    # First ingest
    response1 = client.post("/api/ingest/instagram", json=sample_instagram_post, headers=auth_headers)
    assert response1.status_code == 201
    doc_id = response1.json()["id"]
    
    # Second ingest with new comments
    response2 = client.post("/api/ingest/instagram", json=sample_instagram_post_new_comments, headers=auth_headers)
    
    assert response2.status_code == 201
    data = response2.json()
    assert data["status"] == "updated"
    assert data["id"] == doc_id  # Same document ID
    assert data["new_comments_count"] == 2  # Only 2 new comments
    assert "updated with 2 new comment(s)" in data["message"]


def test_duplicate_post_no_new_comments_returns_no_changes(
    sample_instagram_post,
    auth_headers,
):
    """Test that re-ingesting same post with no new comments returns no_changes."""
    # First ingest
    response1 = client.post("/api/ingest/instagram", json=sample_instagram_post, headers=auth_headers)
    assert response1.status_code == 201
    doc_id = response1.json()["id"]
    
    # Second ingest with identical data
    response2 = client.post("/api/ingest/instagram", json=sample_instagram_post, headers=auth_headers)
    
    assert response2.status_code == 201
    data = response2.json()
    assert data["status"] == "no_changes"
    assert data["id"] == doc_id
    assert data["new_comments_count"] == 0
    assert "no new comments" in data["message"]


def test_duplicate_detection_ignores_case_and_whitespace(auth_headers):
    """Test that duplicate detection is case-insensitive and ignores extra whitespace."""
    post_data = {
        "text": "Test post",
        "author": "Test Author",
        "author_handle": "@testauthor",
        "platform_url": "https://instagram.com/p/XYZ789",
        "language": "en",
        "likes_count": 10,
        "comments_count": 1,
        "comments": [
            {
                "author": "Commenter",
                "author_handle": "@commenter",
                "content": "This is a comment",
                "likes_count": 0,
                "replies_count": 0,
                "published_at": "2024-01-15T10:00:00Z",
            },
        ],
    }
    
    # First ingest
    response1 = client.post("/api/ingest/instagram", json=post_data, headers=auth_headers)
    assert response1.status_code == 201
    doc_id = response1.json()["id"]
    
    # Second ingest with same comment but different case/whitespace
    post_data_modified = post_data.copy()
    post_data_modified["comments"] = [
        {
            "author": "Commenter",
            "author_handle": "@commenter",
            "content": "  THIS IS A COMMENT  ",  # Different case and whitespace
            "likes_count": 0,
            "replies_count": 0,
            "published_at": "2024-01-15T10:00:00Z",
        },
    ]
    
    response2 = client.post("/api/ingest/instagram", json=post_data_modified, headers=auth_headers)
    assert response2.status_code == 201
    data = response2.json()
    assert data["status"] == "no_changes"
    assert data["new_comments_count"] == 0


def test_last_updated_at_timestamp_updated(auth_headers):
    """Test that last_updated_at is updated on re-ingest."""
    import uuid
    unique_id = str(uuid.uuid4())[:8]
    post_data = {
        "text": "Test post",
        "author": "Test Author",
        "author_handle": "@testauthor",
        "platform_url": f"https://instagram.com/p/TIMESTAMP123_{unique_id}",
        "language": "en",
        "likes_count": 10,
        "comments_count": 0,
    }
    
    # First ingest
    response1 = client.post("/api/ingest/instagram", json=post_data, headers=auth_headers)
    assert response1.status_code == 201
    doc_id = response1.json()["id"]
    
    # Wait a moment and re-ingest
    import time
    time.sleep(1)
    
    response2 = client.post("/api/ingest/instagram", json=post_data, headers=auth_headers)
    assert response2.status_code == 201
    
    # Verify status is "no_changes" (since no new comments)
    data = response2.json()
    assert data["status"] == "no_changes"
    assert data["id"] == doc_id


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
