# Implementation Summary: Duplicate Post & Comment Detection

## What Was Implemented

A complete duplicate detection system for the Politica ingestion pipeline that prevents duplicate posts and comments from being stored in the database.

## Changes Made

### 1. Database Schema (`services/api/models/models.py`)

**Added Column to Document Model**:
```python
last_updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
```

- Automatically tracks when a post was last updated
- Set on creation, updated on every modification
- Enables tracking of post update history

### 2. Backend Logic (`services/api/routers/ingestion.py`)

**Added Three Helper Functions**:

1. **`_comment_signature(comment: CommentData) -> tuple`**
   - Generates a unique signature for each comment
   - Uses: author_handle, normalized content, published_at
   - Case-insensitive and whitespace-normalized

2. **`_get_existing_comment_signatures(db: Session, document_id: str) -> set`**
   - Retrieves all existing comment signatures for a post
   - Returns a set for O(1) lookup performance

3. **`_find_new_comments(db: Session, document_id: str, incoming_comments: List[CommentData]) -> List[CommentData]`**
   - Filters incoming comments to only return new ones
   - Compares against existing signatures
   - Returns only comments not already in database

**Updated Response Model**:
```python
class IngestResponse(BaseModel):
    id: str
    status: str
    message: str
    new_comments_count: int = 0  # NEW FIELD
```

**Updated Endpoints** (`/instagram`, `/twitter`, `/facebook`):

Each endpoint now:
1. Checks if post URL already exists
2. If new post: Creates with all comments (status: "created")
3. If existing post:
   - Finds new comments not in database
   - If new comments exist: Inserts them, updates timestamp (status: "updated")
   - If no new comments: Updates timestamp only (status: "no_changes")

### 3. Testing (`services/api/tests/test_duplicate_detection.py`)

Comprehensive test suite covering:
- ✅ First ingestion creates post with all comments
- ✅ Re-ingestion with new comments adds only new ones
- ✅ Re-ingestion with no new comments returns no_changes
- ✅ Case-insensitive duplicate detection
- ✅ Whitespace-normalized duplicate detection
- ✅ Timestamp tracking on updates

### 4. Documentation

- **`DUPLICATE_DETECTION.md`**: Complete technical documentation
- **`DUPLICATE_DETECTION_QUICK_REF.md`**: Quick reference for API consumers

## How It Works

### Duplicate Detection Algorithm

Two comments are considered **duplicates** if they have:
1. Same author handle (case-sensitive)
2. Same content (case-insensitive, whitespace-trimmed)
3. Same published timestamp

### Example Flow

**First Ingestion**:
```
POST /api/ingest/instagram
├─ Check: Does URL exist? NO
├─ Action: Create new post
├─ Action: Insert all 5 comments
└─ Response: status="created", new_comments_count=5
```

**Second Ingestion (2 new comments)**:
```
POST /api/ingest/instagram
├─ Check: Does URL exist? YES
├─ Action: Find new comments (5 incoming, 5 existing)
├─ Result: 2 new comments found
├─ Action: Insert 2 new comments
├─ Action: Update last_updated_at
└─ Response: status="updated", new_comments_count=2
```

**Third Ingestion (no new comments)**:
```
POST /api/ingest/instagram
├─ Check: Does URL exist? YES
├─ Action: Find new comments (5 incoming, 7 existing)
├─ Result: 0 new comments found
├─ Action: Update last_updated_at
└─ Response: status="no_changes", new_comments_count=0
```

## Response Status Values

| Status | Meaning | Use Case |
|--------|---------|----------|
| `created` | New post inserted | First time scraping this URL |
| `updated` | Post exists, new comments added | Re-scraping found new comments |
| `no_changes` | Post exists, no new comments | Re-scraping found no new comments |

## Key Features

✅ **Prevents Duplicate Posts**: Only one document per URL
✅ **Prevents Duplicate Comments**: Comments matched by author + content + timestamp
✅ **Case-Insensitive Matching**: "Great post!" = "GREAT POST!"
✅ **Whitespace-Normalized**: Extra spaces ignored
✅ **Timestamp Tracking**: `last_updated_at` updated on every ingest
✅ **Engagement Updates**: Comments count updated even if no new comments
✅ **Clear Status Messages**: API tells you exactly what happened
✅ **Efficient**: O(n+m) time complexity, minimal database queries
✅ **Backward Compatible**: Existing code continues to work

## Database Impact

### Before Implementation
- Scraping same post twice = 2 documents + 10 duplicate comments
- No way to track when post was last updated
- No distinction between new and old ingestions

### After Implementation
- Scraping same post twice = 1 document + only new comments added
- `last_updated_at` tracks update history
- Clear status indicates what was done

## API Usage

### Example: First Ingest
```bash
curl -X POST http://localhost:8000/api/ingest/instagram \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Post content",
    "platform_url": "https://instagram.com/p/ABC123",
    "comments": [
      {"author_handle": "@user1", "content": "Comment 1", ...},
      {"author_handle": "@user2", "content": "Comment 2", ...}
    ]
  }'
```

**Response**:
```json
{
  "id": "doc-123",
  "status": "created",
  "message": "Instagram post ingested successfully",
  "new_comments_count": 2
}
```

### Example: Re-Ingest with New Comments
```bash
curl -X POST http://localhost:8000/api/ingest/instagram \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Post content",
    "platform_url": "https://instagram.com/p/ABC123",
    "comments": [
      {"author_handle": "@user1", "content": "Comment 1", ...},
      {"author_handle": "@user2", "content": "Comment 2", ...},
      {"author_handle": "@user3", "content": "Comment 3", ...},  // NEW
      {"author_handle": "@user4", "content": "Comment 4", ...}   // NEW
    ]
  }'
```

**Response**:
```json
{
  "id": "doc-123",
  "status": "updated",
  "message": "Instagram post updated with 2 new comment(s)",
  "new_comments_count": 2
}
```

## Files Modified

1. **`services/api/models/models.py`**
   - Added `last_updated_at` column to Document model

2. **`services/api/routers/ingestion.py`**
   - Added 3 helper functions for duplicate detection
   - Updated IngestResponse model
   - Updated `/instagram`, `/twitter`, `/facebook` endpoints

## Files Added

1. **`services/api/tests/test_duplicate_detection.py`**
   - Comprehensive test suite

2. **`DUPLICATE_DETECTION.md`**
   - Complete technical documentation

3. **`DUPLICATE_DETECTION_QUICK_REF.md`**
   - Quick reference guide

## Testing

Run tests:
```bash
cd services/api
pytest tests/test_duplicate_detection.py -v
```

## Performance

- **Time Complexity**: O(n + m) where n = existing comments, m = incoming comments
- **Space Complexity**: O(n) for storing signatures
- **Database Queries**: 4 queries max (check post, fetch existing comments, insert new, update post)

## Backward Compatibility

✅ Fully backward compatible
- Existing code continues to work
- New field `new_comments_count` has default value of 0
- Status field provides clear indication of what happened

## Future Enhancements

1. Comment edit detection (same author/timestamp, different content)
2. Partial duplicate detection (fuzzy matching)
3. Batch ingestion support
4. Duplicate cleanup utility
5. Analytics dashboard for duplicate prevention metrics

## Summary

The implementation successfully prevents duplicate ingestion of posts and comments by:
- Detecting existing posts by URL
- Comparing incoming comments against existing ones
- Only inserting new comments
- Updating post metadata and timestamps
- Returning clear status messages

This ensures data integrity while allowing posts to be re-scraped to capture new comments without creating duplicates.
