# Duplicate Post & Comment Detection Implementation

## Overview

This implementation prevents duplicate ingestion of posts and comments in the Politica system. When a post URL is scraped multiple times, the system intelligently detects which comments are new and only inserts those, avoiding data duplication while keeping engagement metrics up-to-date.

<<FACT: project | 0.9>> Implemented duplicate detection for post ingestion to prevent duplicate comments and posts in database <</FACT>>

## Architecture

### 1. Database Schema Changes

#### Added Column to Document Model
```python
# In models/models.py
last_updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
```

**Purpose**: Tracks when a post was last updated with new comments. Automatically set on creation and updated on every modification.

### 2. Duplicate Detection Logic

#### Comment Signature Generation
```python
def _comment_signature(comment: CommentData) -> tuple:
    """
    Generate a signature for a comment to detect duplicates.
    Uses author_handle, content, and published_at for comparison.
    """
    return (
        comment.author_handle or "",
        comment.content.strip().lower(),  # Case-insensitive, whitespace-normalized
        comment.published_at,
    )
```

**Key Features**:
- **Case-insensitive**: "Great post!" and "GREAT POST!" are treated as the same
- **Whitespace-normalized**: Extra spaces are stripped before comparison
- **Timestamp-aware**: Comments with same content but different timestamps are treated as different
- **Author-aware**: Includes author handle to distinguish comments from different users

#### Existing Comment Lookup
```python
def _get_existing_comment_signatures(db: Session, document_id: str) -> set:
    """Get all existing comment signatures for a document."""
    existing_comments = db.query(PostComment).filter(
        PostComment.document_id == document_id
    ).all()
    return {
        (c.author_handle or "", c.content.strip().lower(), c.published_at)
        for c in existing_comments
    }
```

**Performance**: Uses set-based lookup for O(1) duplicate detection.

#### New Comment Filtering
```python
def _find_new_comments(
    db: Session,
    document_id: str,
    incoming_comments: Optional[List[CommentData]],
) -> List[CommentData]:
    """Filter incoming comments to only return those not already in database."""
    if not incoming_comments:
        return []
    
    existing_signatures = _get_existing_comment_signatures(db, document_id)
    new_comments = []
    
    for comment in incoming_comments:
        signature = _comment_signature(comment)
        if signature not in existing_signatures:
            new_comments.append(comment)
    
    return new_comments
```

### 3. Ingestion Endpoint Logic

Each platform endpoint (`/instagram`, `/twitter`, `/facebook`) follows this flow:

```
1. Check if post URL already exists in database
   ├─ If NOT found:
   │  └─ Create new post with all comments (status: "created")
   │
   └─ If found:
      ├─ Find new comments not in database
      ├─ If new comments exist:
      │  ├─ Insert only new comments
      │  ├─ Update post's last_updated_at timestamp
      │  ├─ Update comments_count
      │  └─ Return status: "updated" with count of new comments
      │
      └─ If no new comments:
         ├─ Update post's last_updated_at timestamp
         └─ Return status: "no_changes"
```

### 4. Response Format

The `IngestResponse` model now includes:

```python
class IngestResponse(BaseModel):
    id: str                          # Document ID
    status: str                      # "created" | "updated" | "no_changes"
    message: str                     # Human-readable message
    new_comments_count: int = 0      # Number of new comments added
```

**Status Values**:
- `"created"`: New post inserted with all comments
- `"updated"`: Existing post updated with new comments
- `"no_changes"`: Post exists, no new comments found

## Usage Examples

### Example 1: First Ingestion (New Post)

**Request**:
```json
POST /api/ingest/instagram
{
  "text": "Political announcement",
  "author": "John Doe",
  "author_handle": "@johndoe",
  "platform_url": "https://instagram.com/p/ABC123",
  "comments": [
    {
      "author": "User1",
      "author_handle": "@user1",
      "content": "Great post!",
      "published_at": "2024-01-15T11:00:00Z"
    },
    {
      "author": "User2",
      "author_handle": "@user2",
      "content": "I disagree",
      "published_at": "2024-01-15T12:00:00Z"
    }
  ]
}
```

**Response** (201 Created):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "created",
  "message": "Instagram post ingested successfully",
  "new_comments_count": 2
}
```

### Example 2: Re-ingestion with New Comments

**Request** (same URL, but with 2 new comments added):
```json
POST /api/ingest/instagram
{
  "text": "Political announcement",
  "author": "John Doe",
  "author_handle": "@johndoe",
  "platform_url": "https://instagram.com/p/ABC123",
  "comments": [
    {
      "author": "User1",
      "author_handle": "@user1",
      "content": "Great post!",
      "published_at": "2024-01-15T11:00:00Z"
    },
    {
      "author": "User2",
      "author_handle": "@user2",
      "content": "I disagree",
      "published_at": "2024-01-15T12:00:00Z"
    },
    {
      "author": "User3",
      "author_handle": "@user3",
      "content": "This is new!",
      "published_at": "2024-01-15T13:00:00Z"
    },
    {
      "author": "User4",
      "author_handle": "@user4",
      "content": "Another new comment",
      "published_at": "2024-01-15T14:00:00Z"
    }
  ]
}
```

**Response** (201 Created):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "updated",
  "message": "Instagram post updated with 2 new comment(s)",
  "new_comments_count": 2
}
```

**Database State**:
- Post document: Same ID, `last_updated_at` updated to current time
- Comments: 4 total (2 original + 2 new)
- No duplicates created

### Example 3: Re-ingestion with No New Comments

**Request** (same URL, same comments):
```json
POST /api/ingest/instagram
{
  "text": "Political announcement",
  "author": "John Doe",
  "author_handle": "@johndoe",
  "platform_url": "https://instagram.com/p/ABC123",
  "comments": [
    {
      "author": "User1",
      "author_handle": "@user1",
      "content": "Great post!",
      "published_at": "2024-01-15T11:00:00Z"
    },
    {
      "author": "User2",
      "author_handle": "@user2",
      "content": "I disagree",
      "published_at": "2024-01-15T12:00:00Z"
    }
  ]
}
```

**Response** (201 Created):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "no_changes",
  "message": "Instagram post already exists with no new comments",
  "new_comments_count": 0
}
```

## Duplicate Detection Algorithm

### How Comments Are Matched

Two comments are considered **duplicates** if they have:
1. **Same author handle** (case-sensitive)
2. **Same content** (case-insensitive, whitespace-normalized)
3. **Same published timestamp**

### Examples

| Comment 1 | Comment 2 | Duplicate? | Reason |
|-----------|-----------|-----------|--------|
| `@user1` "Great post!" `2024-01-15T11:00:00Z` | `@user1` "Great post!" `2024-01-15T11:00:00Z` | ✅ Yes | Exact match |
| `@user1` "Great post!" `2024-01-15T11:00:00Z` | `@user1` "GREAT POST!" `2024-01-15T11:00:00Z` | ✅ Yes | Case-insensitive match |
| `@user1` "Great post!" `2024-01-15T11:00:00Z` | `@user1` "  Great post!  " `2024-01-15T11:00:00Z` | ✅ Yes | Whitespace-normalized |
| `@user1` "Great post!" `2024-01-15T11:00:00Z` | `@user2` "Great post!" `2024-01-15T11:00:00Z` | ❌ No | Different author |
| `@user1` "Great post!" `2024-01-15T11:00:00Z` | `@user1` "Great post!" `2024-01-15T12:00:00Z` | ❌ No | Different timestamp |
| `@user1` "Great post!" `2024-01-15T11:00:00Z` | `@user1` "Great post! " `2024-01-15T11:00:00Z` | ✅ Yes | Trailing space ignored |

## Implementation Details

### Files Modified

1. **`services/api/models/models.py`**
   - Added `last_updated_at` column to Document model

2. **`services/api/routers/ingestion.py`**
   - Added `_comment_signature()` helper function
   - Added `_get_existing_comment_signatures()` helper function
   - Added `_find_new_comments()` helper function
   - Updated `IngestResponse` model with `new_comments_count` field
   - Updated `/instagram` endpoint with duplicate detection
   - Updated `/twitter` endpoint with duplicate detection
   - Updated `/facebook` endpoint with duplicate detection

### Files Added

1. **`services/api/tests/test_duplicate_detection.py`**
   - Comprehensive test suite for duplicate detection
   - Tests for first ingestion, re-ingestion with new comments, re-ingestion with no changes
   - Tests for case-insensitive and whitespace-normalized matching
   - Tests for timestamp tracking

## Performance Considerations

### Time Complexity
- **First ingestion**: O(n) where n = number of comments
- **Re-ingestion**: O(n + m) where n = existing comments, m = incoming comments
  - O(n) to build existing signatures set
  - O(m) to check each incoming comment

### Space Complexity
- O(n) for storing existing comment signatures in memory

### Database Queries
- 1 query to check if post exists
- 1 query to fetch existing comments (only if post exists)
- 1 query to insert new comments (if any)
- 1 query to update post metadata

## Testing

Run the test suite:

```bash
cd services/api
pytest tests/test_duplicate_detection.py -v
```

**Test Coverage**:
- ✅ First ingestion creates post with all comments
- ✅ Re-ingestion with new comments adds only new ones
- ✅ Re-ingestion with no new comments returns no_changes
- ✅ Duplicate detection is case-insensitive
- ✅ Duplicate detection ignores extra whitespace
- ✅ last_updated_at timestamp is updated on re-ingestion

## Future Enhancements

1. **Comment Edit Detection**: Detect when existing comments are edited (different content, same author/timestamp)
2. **Partial Duplicate Detection**: Handle cases where comment content is slightly modified
3. **Batch Ingestion**: Support ingesting multiple posts in a single request
4. **Duplicate Cleanup**: Utility to find and merge duplicate posts that slipped through
5. **Analytics**: Track duplicate detection metrics (how many duplicates prevented, etc.)

## Troubleshooting

### Issue: Comments are still being duplicated

**Possible Causes**:
1. Different timestamps for same comment (platform may add milliseconds)
2. Extra whitespace in comment content
3. Different author handles (e.g., `@user` vs `user`)

**Solution**: Adjust the `_comment_signature()` function to normalize timestamps or use content hash instead.

### Issue: Legitimate new comments are being marked as duplicates

**Possible Causes**:
1. Multiple users posting identical comments
2. Timestamp precision issues

**Solution**: Consider adding comment ID from platform if available, or use a combination of author + content + timestamp with tolerance.

## Summary

The duplicate detection system:
- ✅ Prevents duplicate posts in the database
- ✅ Prevents duplicate comments for the same post
- ✅ Intelligently detects and inserts only new comments
- ✅ Updates post metadata and timestamps
- ✅ Returns clear status messages about what was done
- ✅ Handles case-insensitive and whitespace-normalized matching
- ✅ Maintains data integrity with minimal database queries
