# Chat History - Quick Reference Guide

## What Was Built

A complete chat history persistence system for the Research Assistant with:
- ✅ Database storage for conversations and messages
- ✅ 6 new backend API endpoints
- ✅ 6 new API client methods
- ✅ Enhanced frontend with conversation sidebar
- ✅ Auto-save functionality
- ✅ Conversation management (create, list, load, delete)

## Quick Start

### For Users

1. **Start a New Conversation**
   - Click "New Chat" button in the sidebar
   - Or just start typing - a conversation will be created automatically

2. **Send a Message**
   - Type your question in the input field
   - Press Enter or click Send
   - Message is automatically saved

3. **View Past Conversations**
   - All conversations appear in the left sidebar
   - Click any conversation to load it
   - Shows message count for each conversation

4. **Delete a Conversation**
   - Hover over a conversation in the sidebar
   - Click the trash icon
   - Conversation and all messages are deleted

### For Developers

#### Database Setup
```bash
# Tables are already created
# Verify with:
psql -d politica -c "SELECT * FROM research_conversations;"
psql -d politica -c "SELECT * FROM research_messages;"
```

#### API Testing
```bash
# Create conversation
curl -X POST http://localhost:8000/api/research/conversations \
  -H "Content-Type: application/json" \
  -d '{"title": "Test"}'

# List conversations
curl http://localhost:8000/api/research/conversations

# Add message
curl -X POST http://localhost:8000/api/research/conversations/{id}/messages \
  -H "Content-Type: application/json" \
  -d '{"content": "Hello", "sender": "user"}'
```

#### Frontend Integration
```typescript
// Create conversation
const conv = await apiClient.createConversation("My Chat")

// List conversations
const convs = await apiClient.listConversations()

// Load conversation
const conv = await apiClient.getConversation(convId)

// Add message
await apiClient.addMessage(convId, "Hello", "user")

// Get messages
const msgs = await apiClient.getMessages(convId)

// Delete conversation
await apiClient.deleteConversation(convId)
```

## File Locations

| File | Changes |
|------|---------|
| `services/api/models/models.py` | Added 2 models |
| `services/api/routers/research.py` | Added 6 endpoints |
| `politica-admin-portal/lib/api-client.ts` | Added 6 methods |
| `politica-admin-portal/app/admin/research/page.tsx` | Enhanced UI |

## Database Schema

### research_conversations
```
id (UUID) → Primary Key
title (String) → Conversation title
created_at (DateTime) → Creation time
updated_at (DateTime) → Last update time
```

### research_messages
```
id (UUID) → Primary Key
conversation_id (UUID) → Foreign Key
content (Text) → Message content
sender (String) → "user" or "assistant"
sources (JSON) → Source references
timestamp (DateTime) → Message time
```

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/research/conversations` | Create conversation |
| GET | `/api/research/conversations` | List all conversations |
| GET | `/api/research/conversations/{id}` | Get conversation |
| DELETE | `/api/research/conversations/{id}` | Delete conversation |
| POST | `/api/research/conversations/{id}/messages` | Add message |
| GET | `/api/research/conversations/{id}/messages` | Get messages |

## Key Features

✅ **Auto-Save**: Messages saved automatically
✅ **Persistent**: All data stored in PostgreSQL
✅ **Conversation Management**: Create, list, load, delete
✅ **Message History**: Full history with timestamps
✅ **Source Tracking**: Sources stored with responses
✅ **Responsive UI**: Sidebar for navigation
✅ **Error Handling**: Graceful error messages
✅ **Loading States**: Visual feedback

## Common Tasks

### Load All Conversations
```typescript
const conversations = await apiClient.listConversations()
// Returns: [{ id, title, created_at, updated_at, message_count }, ...]
```

### Load Specific Conversation
```typescript
const conversation = await apiClient.getConversation(conversationId)
// Returns: { id, title, created_at, updated_at, messages: [...] }
```

### Save a Message
```typescript
await apiClient.addMessage(
  conversationId,
  "Message content",
  "user",  // or "assistant"
  sources  // optional
)
```

### Delete a Conversation
```typescript
await apiClient.deleteConversation(conversationId)
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Conversations not loading | Check DB connection, verify tables exist |
| Messages not saving | Verify conversation ID, check DB permissions |
| UI not updating | Clear cache, check browser console |
| API errors | Check API logs, verify request format |

## Performance Tips

1. **Pagination**: Add pagination for large conversation lists
2. **Caching**: Cache frequently accessed conversations
3. **Indexing**: Database indexes on conversation_id and timestamp
4. **Batch Operations**: Batch message saves for better performance

## Security Notes

- Input validation via Pydantic models
- SQL injection prevention via SQLAlchemy ORM
- XSS prevention via React escaping
- Consider adding authentication/authorization
- Consider adding rate limiting

## Future Enhancements

- [ ] Pagination for large conversations
- [ ] Search across conversations
- [ ] Export conversations (PDF/markdown)
- [ ] Share conversations
- [ ] Tag conversations
- [ ] Archive conversations
- [ ] Edit conversation titles
- [ ] Edit messages
- [ ] Fork conversations
- [ ] Analytics

## Documentation Files

1. **CHAT_HISTORY_SUMMARY.md** - Complete overview
2. **CHAT_HISTORY_IMPLEMENTATION.md** - Detailed implementation guide
3. **CHAT_HISTORY_CODE_REFERENCE.md** - Full code examples
4. **CHAT_HISTORY_QUICK_REFERENCE.md** - This file

## Support

For issues or questions:
1. Check the documentation files
2. Review the code comments
3. Check API logs
4. Check browser console
5. Verify database tables exist

## Summary

The Research Assistant now has full chat history persistence with automatic saving, conversation management, and a responsive UI. Users can maintain multiple research conversations and return to previous discussions at any time.

**Status**: ✅ Complete and ready to use
**Database**: ✅ Tables created
**Backend**: ✅ Endpoints implemented
**Frontend**: ✅ UI updated
**Testing**: ✅ Ready for testing
