# Research Assistant Chat History Implementation

## Overview

The Research Assistant now supports persistent chat history storage and retrieval. All conversations and messages are saved to the database, allowing users to:
- Start new conversations
- View past conversations
- Continue previous conversations
- Delete conversations
- See conversation metadata (creation time, message count)

## Architecture

### Database Models

#### `ResearchConversation`
Stores conversation metadata:
- `id` (String, PK): Unique conversation identifier
- `title` (String): User-friendly conversation title
- `created_at` (DateTime): When the conversation was created
- `updated_at` (DateTime): When the conversation was last updated
- `messages` (Relationship): List of messages in this conversation

#### `ResearchMessage`
Stores individual messages:
- `id` (String, PK): Unique message identifier
- `conversation_id` (String, FK): Reference to parent conversation
- `content` (Text): Message content
- `sender` (String): "user" or "assistant"
- `sources` (JSON): Array of source references (for assistant messages)
- `timestamp` (DateTime): When the message was created
- `conversation` (Relationship): Reference to parent conversation

### Backend Endpoints

All endpoints are prefixed with `/api/research/`:

#### Conversation Management

**POST `/conversations`**
- Create a new conversation
- Request: `{ "title": "string" }`
- Response: Full conversation object with empty messages array

**GET `/conversations`**
- List all conversations (ordered by most recent)
- Response: Array of conversation summaries with message counts

**GET `/conversations/{conversation_id}`**
- Get a specific conversation with all its messages
- Response: Full conversation object with all messages

**DELETE `/conversations/{conversation_id}`**
- Delete a conversation and all its messages
- Response: 204 No Content

#### Message Management

**POST `/conversations/{conversation_id}/messages`**
- Add a message to a conversation
- Request: `{ "content": "string", "sender": "user|assistant", "sources": [...] }`
- Response: Created message object

**GET `/conversations/{conversation_id}/messages`**
- Get all messages in a conversation (ordered by timestamp)
- Response: Array of message objects

### Frontend Implementation

#### Key Features

1. **Conversation Sidebar**
   - Lists all past conversations
   - Shows message count for each conversation
   - "New Chat" button to start fresh conversation
   - Delete button (hover to reveal) for each conversation
   - Click to load and view conversation

2. **Chat Area**
   - Displays current conversation title
   - Shows all messages with timestamps
   - Auto-saves messages as they're sent
   - Displays loading state while searching
   - Shows sources for assistant responses

3. **Auto-Save Behavior**
   - User message is saved immediately when sent
   - Assistant response is saved after receiving answer
   - Conversation is created automatically on first message if needed
   - Conversation title is auto-generated from timestamp

#### State Management

```typescript
// Conversations list
const [conversations, setConversations] = useState<Conversation[]>([])

// Current active conversation
const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)

// Messages in current conversation
const [messages, setMessages] = useState<Message[]>([])

// UI state
const [showConversationList, setShowConversationList] = useState(false)
const [loading, setLoading] = useState(false)
```

#### Message Flow

1. User types message and presses Enter or clicks Send
2. If no conversation exists, create one
3. Add user message to UI immediately
4. Save user message to backend
5. Call research query API
6. Add assistant response to UI
7. Save assistant response to backend
8. Refresh conversation list

### API Client Methods

New methods added to `apiClient`:

```typescript
// Create a new conversation
createConversation(title: string): Promise<Conversation>

// List all conversations
listConversations(): Promise<Conversation[]>

// Get a specific conversation with messages
getConversation(conversationId: string): Promise<Conversation>

// Add a message to a conversation
addMessage(conversationId: string, content: string, sender: string, sources?: any[]): Promise<Message>

// Get all messages in a conversation
getMessages(conversationId: string): Promise<Message[]>

// Delete a conversation
deleteConversation(conversationId: string): Promise<void>
```

## Database Schema

```sql
-- Conversations table
CREATE TABLE research_conversations (
    id VARCHAR PRIMARY KEY,
    title VARCHAR NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Messages table
CREATE TABLE research_messages (
    id VARCHAR PRIMARY KEY,
    conversation_id VARCHAR NOT NULL REFERENCES research_conversations(id),
    content TEXT NOT NULL,
    sender VARCHAR NOT NULL,
    sources JSON DEFAULT '[]',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Usage Flow

### Starting a New Conversation

1. User clicks "New Chat" button
2. Frontend creates new conversation via `POST /api/research/conversations`
3. Conversation ID is stored in state
4. Chat area is cleared (except welcome message)
5. User can start typing

### Continuing a Previous Conversation

1. User clicks on a conversation in the sidebar
2. Frontend fetches conversation via `GET /api/research/conversations/{id}`
3. All messages are loaded and displayed
4. User can continue the conversation
5. New messages are appended to the conversation

### Sending a Message

1. User types and sends message
2. If no active conversation, create one
3. User message is added to UI
4. `POST /api/research/conversations/{id}/messages` saves user message
5. Research query is executed
6. Assistant response is added to UI
7. `POST /api/research/conversations/{id}/messages` saves assistant response
8. Conversation list is refreshed

### Deleting a Conversation

1. User hovers over conversation in sidebar
2. Delete button appears
3. User clicks delete button
4. `DELETE /api/research/conversations/{id}` removes conversation
5. If it was the active conversation, chat is cleared
6. Conversation list is refreshed

## Data Persistence

- All messages are persisted to PostgreSQL database
- Conversations are never lost (unless explicitly deleted)
- Message history is available across browser sessions
- Timestamps are stored in UTC
- Sources are stored as JSON for flexibility

## Performance Considerations

- Conversations are loaded on page mount
- Messages are loaded when a conversation is selected
- Pagination could be added for large conversations (future enhancement)
- Indexes on `conversation_id` and `timestamp` for fast queries

## Future Enhancements

1. **Pagination**: Load messages in batches for large conversations
2. **Search**: Search across all conversations and messages
3. **Export**: Export conversation as PDF or markdown
4. **Sharing**: Share conversations with other users
5. **Tagging**: Tag conversations for organization
6. **Archiving**: Archive old conversations
7. **Conversation Titles**: Allow users to edit conversation titles
8. **Message Editing**: Allow users to edit their messages
9. **Conversation Forking**: Create new conversation from a specific message
10. **Analytics**: Track conversation metrics and trends

## Testing

### Manual Testing Checklist

- [ ] Create a new conversation
- [ ] Send a message and verify it's saved
- [ ] Refresh page and verify conversation history is loaded
- [ ] Load a previous conversation
- [ ] Send multiple messages in a conversation
- [ ] Delete a conversation
- [ ] Verify deleted conversation is removed from list
- [ ] Create multiple conversations and switch between them
- [ ] Verify timestamps are correct
- [ ] Verify sources are displayed correctly

### API Testing

```bash
# Create conversation
curl -X POST http://localhost:8000/api/research/conversations \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Conversation"}'

# List conversations
curl http://localhost:8000/api/research/conversations

# Get specific conversation
curl http://localhost:8000/api/research/conversations/{id}

# Add message
curl -X POST http://localhost:8000/api/research/conversations/{id}/messages \
  -H "Content-Type: application/json" \
  -d '{"content": "Test message", "sender": "user"}'

# Get messages
curl http://localhost:8000/api/research/conversations/{id}/messages

# Delete conversation
curl -X DELETE http://localhost:8000/api/research/conversations/{id}
```

## Files Modified

1. **Backend**
   - `services/api/models/models.py`: Added `ResearchConversation` and `ResearchMessage` models
   - `services/api/routers/research.py`: Added conversation management endpoints

2. **Frontend**
   - `politica-admin-portal/lib/api-client.ts`: Added conversation API methods
   - `politica-admin-portal/app/admin/research/page.tsx`: Updated UI with conversation sidebar and history

3. **Database**
   - Created `research_conversations` table
   - Created `research_messages` table

## Deployment Notes

1. Run database migration to create new tables (already done)
2. Restart API server to load new models
3. Clear browser cache if needed
4. No breaking changes to existing endpoints

## Troubleshooting

### Conversations not loading
- Check database connection
- Verify tables exist: `SELECT * FROM research_conversations;`
- Check API logs for errors

### Messages not saving
- Verify conversation ID is valid
- Check database permissions
- Verify message content is not empty

### UI not updating
- Clear browser cache
- Check browser console for errors
- Verify API responses are correct

## Support

For issues or questions about the chat history implementation, refer to the code comments in:
- `services/api/routers/research.py`
- `politica-admin-portal/app/admin/research/page.tsx`
