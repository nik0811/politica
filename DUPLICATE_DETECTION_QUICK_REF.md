# Duplicate Detection - Quick Reference

## What Changed?

The ingestion endpoints now intelligently handle duplicate posts:
- **First time**: Post is created with all comments
- **Second time**: Only NEW comments are added (no duplicates)
- **No new comments**: Post is marked as updated but no comments added

## API Response Changes

### New Field in Response
```json
{
  "id": "...",
  "status": "created|updated|no_changes",
  "message": "...",
  "new_comments_count": 2  // NEW: Number of comments added
}
```

### Status Values

| Status | Meaning | Action |
|--------|---------|--------|
| `created` | New post inserted | All comments from request were added |
| `updated` | Post exists, new comments added | Only new comments were inserted |
| `no_changes` | Post exists, no new comments | Post was touched but no changes made |

## How Duplicates Are Detected

Comments are considered duplicates if they have:
- Same author handle
- Same content (case-insensitive, whitespace-trimmed)
- Same published timestamp

## Database Changes

### New Column
- `Document.last_updated_at` - Tracks when post was last updated

### Behavior
- Automatically set on post creation
- Updated every time post is re-ingested (even if no new comments)

## Examples

### Scenario 1: First Ingest
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

### Scenario 2: Re-ingest Same Post with 2 New Comments
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

### Scenario 3: Re-ingest Same Post, No New Comments
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
  "status": "no_changes",
  "message": "Instagram post already exists with no new comments",
  "new_comments_count": 0
}
```

## For Frontend/Extension Developers

### What to Check
1. **Status field**: Tells you what happened
2. **new_comments_count**: How many comments were actually added
3. **message**: Human-readable explanation

### Recommended Handling
```javascript
const response = await fetch('/api/ingest/instagram', {
  method: 'POST',
  body: JSON.stringify(postData)
});

const result = await response.json();

if (result.status === 'created') {
  console.log(`New post created with ${result.new_comments_count} comments`);
} else if (result.status === 'updated') {
  console.log(`Post updated with ${result.new_comments_count} new comments`);
} else if (result.status === 'no_changes') {
  console.log('Post already exists, no new comments');
}
```

## Database Query Examples

### Find Posts Updated Recently
```sql
SELECT * FROM documents 
WHERE last_updated_at > NOW() - INTERVAL '1 hour'
ORDER BY last_updated_at DESC;
```

### Count Comments Per Post
```sql
SELECT 
  d.id,
  d.title,
  COUNT(pc.id) as comment_count,
  d.last_updated_at
FROM documents d
LEFT JOIN post_comments pc ON d.id = pc.document_id
GROUP BY d.id
ORDER BY comment_count DESC;
```

### Find Posts Never Updated (Only Ingested Once)
```sql
SELECT * FROM documents 
WHERE created_at = last_updated_at
ORDER BY created_at DESC;
```

## Troubleshooting

### Q: Why is my comment being marked as duplicate?
**A**: Check:
1. Author handle matches exactly (case-sensitive)
2. Comment content is identical (case-insensitive)
3. Published timestamp is the same

### Q: Can I force re-ingest all comments?
**A**: Currently no. If you need to reset, delete the document and re-ingest.

### Q: What if the same comment appears with different timestamps?
**A**: It will be treated as a new comment (different timestamp = different comment).

### Q: How do I know if a post was updated?
**A**: Check `last_updated_at` field on the Document. If it's newer than `created_at`, the post was updated.
