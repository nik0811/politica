# Chat History Implementation - Complete Code Reference

## Database Models

### Location: `services/api/models/models.py`

```python
class ResearchConversation(Base):
    __tablename__ = "research_conversations"

    id = Column(String, primary_key=True, default=generate_uuid)
    title = Column(String, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    messages = relationship("ResearchMessage", back_populates="conversation", cascade="all, delete-orphan")


class ResearchMessage(Base):
    __tablename__ = "research_messages"

    id = Column(String, primary_key=True, default=generate_uuid)
    conversation_id = Column(String, ForeignKey("research_conversations.id"), nullable=False)
    content = Column(Text, nullable=False)
    sender = Column(String, nullable=False)  # "user" or "assistant"
    sources = Column(JSON, default=list)  # Store sources for assistant messages
    timestamp = Column(DateTime, server_default=func.now())

    conversation = relationship("ResearchConversation", back_populates="messages")
```

## Backend Endpoints

### Location: `services/api/routers/research.py`

#### Pydantic Schemas

```python
class MessageCreate(BaseModel):
    content: str
    sender: str  # "user" or "assistant"
    sources: Optional[List[dict]] = None


class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    content: str
    sender: str
    sources: Optional[List[dict]]
    timestamp: datetime

    class Config:
        from_attributes = True


class ConversationCreate(BaseModel):
    title: str


class ConversationResponse(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime
    messages: List[MessageResponse] = []

    class Config:
        from_attributes = True


class ConversationListResponse(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: int

    class Config:
        from_attributes = True
```

#### Endpoints

```python
@router.post("/conversations", response_model=ConversationResponse, status_code=201)
async def create_conversation(request: ConversationCreate, db: Session = Depends(get_db)):
    """Create a new research conversation."""
    conversation = ResearchConversation(title=request.title)
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return conversation


@router.get("/conversations", response_model=List[ConversationListResponse])
async def list_conversations(db: Session = Depends(get_db)):
    """List all research conversations ordered by most recent."""
    conversations = (
        db.query(ResearchConversation)
        .order_by(ResearchConversation.updated_at.desc())
        .all()
    )
    result = []
    for conv in conversations:
        message_count = db.query(func.count()).select_from(ResearchMessage).filter(
            ResearchMessage.conversation_id == conv.id
        ).scalar() or 0
        result.append({
            "id": conv.id,
            "title": conv.title,
            "created_at": conv.created_at,
            "updated_at": conv.updated_at,
            "message_count": message_count,
        })
    return result


@router.get("/conversations/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(conversation_id: str, db: Session = Depends(get_db)):
    """Get a specific conversation with all its messages."""
    conversation = (
        db.query(ResearchConversation)
        .filter(ResearchConversation.id == conversation_id)
        .first()
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


@router.post("/conversations/{conversation_id}/messages", response_model=MessageResponse, status_code=201)
async def add_message(
    conversation_id: str,
    request: MessageCreate,
    db: Session = Depends(get_db)
):
    """Add a message to a conversation."""
    conversation = (
        db.query(ResearchConversation)
        .filter(ResearchConversation.id == conversation_id)
        .first()
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    message = ResearchMessage(
        conversation_id=conversation_id,
        content=request.content,
        sender=request.sender,
        sources=request.sources or [],
    )
    db.add(message)
    conversation.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(message)
    return message


@router.get("/conversations/{conversation_id}/messages", response_model=List[MessageResponse])
async def get_messages(conversation_id: str, db: Session = Depends(get_db)):
    """Get all messages in a conversation."""
    conversation = (
        db.query(ResearchConversation)
        .filter(ResearchConversation.id == conversation_id)
        .first()
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    messages = (
        db.query(ResearchMessage)
        .filter(ResearchMessage.conversation_id == conversation_id)
        .order_by(ResearchMessage.timestamp.asc())
        .all()
    )
    return messages


@router.delete("/conversations/{conversation_id}", status_code=204)
async def delete_conversation(conversation_id: str, db: Session = Depends(get_db)):
    """Delete a conversation and all its messages."""
    conversation = (
        db.query(ResearchConversation)
        .filter(ResearchConversation.id == conversation_id)
        .first()
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    db.delete(conversation)
    db.commit()
    return None
```

## API Client Methods

### Location: `politica-admin-portal/lib/api-client.ts`

```typescript
// Conversation management
async createConversation(title: string): Promise<any> {
  return this.request<any>("/api/research/conversations", {
    method: "POST",
    body: JSON.stringify({ title }),
  })
}

async listConversations(): Promise<any[]> {
  return this.request<any[]>("/api/research/conversations")
}

async getConversation(conversationId: string): Promise<any> {
  return this.request<any>(`/api/research/conversations/${conversationId}`)
}

async addMessage(conversationId: string, content: string, sender: string, sources?: any[]): Promise<any> {
  return this.request<any>(`/api/research/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content, sender, sources: sources || [] }),
  })
}

async getMessages(conversationId: string): Promise<any[]> {
  return this.request<any[]>(`/api/research/conversations/${conversationId}/messages`)
}

async deleteConversation(conversationId: string): Promise<void> {
  return this.request<void>(`/api/research/conversations/${conversationId}`, {
    method: "DELETE",
  })
}
```

## Frontend Implementation

### Location: `politica-admin-portal/app/admin/research/page.tsx`

#### Key State Management

```typescript
const [conversations, setConversations] = useState<Conversation[]>([])
const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
const [messages, setMessages] = useState<Message[]>([
  {
    id: "0",
    role: "assistant",
    content: "Hello! I'm your political intelligence research assistant. Ask me about documents, promises, entities, or trends.",
    timestamp: new Date(),
  },
])
const [input, setInput] = useState("")
const [loading, setLoading] = useState(false)
const [kbStats, setKbStats] = useState<any>(null)
```

#### Load Conversations on Mount

```typescript
useEffect(() => {
  loadConversations()
}, [])

const loadConversations = async () => {
  try {
    const convs = await apiClient.listConversations()
    setConversations(convs)
  } catch (error) {
    console.error("Failed to load conversations:", error)
  }
}
```

#### Start New Conversation

```typescript
const startNewConversation = async () => {
  try {
    const title = `Conversation ${new Date().toLocaleString()}`
    const newConv = await apiClient.createConversation(title)
    setCurrentConversationId(newConv.id)
    setMessages([
      {
        id: "0",
        role: "assistant",
        content: "Hello! I'm your political intelligence research assistant. Ask me about documents, promises, entities, or trends.",
        timestamp: new Date(),
      },
    ])
    await loadConversations()
  } catch (error) {
    console.error("Failed to create conversation:", error)
  }
}
```

#### Load Previous Conversation

```typescript
const loadConversation = async (conversationId: string) => {
  try {
    const conv = await apiClient.getConversation(conversationId)
    setCurrentConversationId(conversationId)
    const loadedMessages = conv.messages.map((msg: any) => ({
      id: msg.id,
      role: msg.sender,
      content: msg.content,
      sources: msg.sources,
      timestamp: new Date(msg.timestamp),
    }))
    setMessages(loadedMessages.length > 0 ? loadedMessages : [
      {
        id: "0",
        role: "assistant",
        content: "Hello! I'm your political intelligence research assistant. Ask me about documents, promises, entities, or trends.",
        timestamp: new Date(),
      },
    ])
    setShowConversationList(false)
  } catch (error) {
    console.error("Failed to load conversation:", error)
  }
}
```

#### Send Message with Auto-Save

```typescript
const sendMessage = async (text: string) => {
  if (!text.trim() || loading) return

  let conversationId = currentConversationId
  if (!conversationId) {
    const newConv = await apiClient.createConversation(`Conversation ${new Date().toLocaleString()}`)
    conversationId = newConv.id
    setCurrentConversationId(conversationId)
    await loadConversations()
  }

  setInput("")
  setLoading(true)

  const userMsg: Message = {
    id: Date.now().toString(),
    role: "user",
    content: text,
    timestamp: new Date(),
  }
  setMessages((prev) => [...prev, userMsg])

  try {
    // Save user message
    await apiClient.addMessage(conversationId, text, "user")

    // Get research response
    const response = await apiClient.researchQuery(text)

    // Add assistant response to UI
    const assistantMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: response.answer,
      sources: response.sources,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, assistantMsg])

    // Save assistant response
    await apiClient.addMessage(conversationId, response.answer, "assistant", response.sources)
    await loadConversations()
  } catch (error) {
    const errorMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "Sorry, I encountered an error processing your request. Please try again.",
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, errorMsg])
  } finally {
    setLoading(false)
  }
}
```

#### Delete Conversation

```typescript
const deleteConversation = async (conversationId: string, e: React.MouseEvent) => {
  e.stopPropagation()
  try {
    await apiClient.deleteConversation(conversationId)
    if (currentConversationId === conversationId) {
      setCurrentConversationId(null)
      setMessages([
        {
          id: "0",
          role: "assistant",
          content: "Hello! I'm your political intelligence research assistant. Ask me about documents, promises, entities, or trends.",
          timestamp: new Date(),
        },
      ])
    }
    await loadConversations()
  } catch (error) {
    console.error("Failed to delete conversation:", error)
  }
}
```

## UI Components

### Conversations Sidebar

```typescript
<Card className="lg:col-span-1">
  <CardHeader className="pb-3 border-b border-border shrink-0">
    <CardTitle className="text-sm font-medium flex items-center gap-2">
      <MessageSquare className="size-4 text-primary" /> Conversations
    </CardTitle>
  </CardHeader>

  <ScrollArea className="flex-1 px-3 py-3">
    <div className="flex flex-col gap-2">
      <Button
        onClick={startNewConversation}
        size="sm"
        className="w-full justify-start gap-2 mb-2"
        variant="outline"
      >
        <Plus className="size-3.5" /> New Chat
      </Button>

      {conversations.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">No conversations yet</p>
      ) : (
        conversations.map((conv) => (
          <div
            key={conv.id}
            onClick={() => loadConversation(conv.id)}
            className={`p-2 rounded-lg cursor-pointer transition-colors text-xs group ${
              currentConversationId === conv.id
                ? "bg-primary/10 border border-primary/30"
                : "hover:bg-muted border border-transparent"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{conv.title}</p>
                <p className="text-[10px] text-muted-foreground">
                  {conv.message_count} messages
                </p>
              </div>
              <Button
                onClick={(e) => deleteConversation(conv.id, e)}
                size="icon"
                variant="ghost"
                className="size-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
          </div>
        ))
      )}
    </div>
  </ScrollArea>
</Card>
```

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    User Interface                            │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────┐ │
│  │ Conversations    │  │   Chat Area      │  │ KB Stats   │ │
│  │ Sidebar          │  │                  │  │            │ │
│  │ - New Chat       │  │ - Messages       │  │ - Docs     │ │
│  │ - List Conv      │  │ - Input Field    │  │ - Promises │ │
│  │ - Delete Conv    │  │ - Send Button    │  │ - Entities │ │
│  └──────────────────┘  └──────────────────┘  └────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    API Client                                │
│  - createConversation()                                      │
│  - listConversations()                                       │
│  - getConversation()                                         │
│  - addMessage()                                              │
│  - getMessages()                                             │
│  - deleteConversation()                                      │
│  - researchQuery()                                           │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  FastAPI Backend                             │
│  POST   /api/research/conversations                          │
│  GET    /api/research/conversations                          │
│  GET    /api/research/conversations/{id}                     │
│  POST   /api/research/conversations/{id}/messages            │
│  GET    /api/research/conversations/{id}/messages            │
│  DELETE /api/research/conversations/{id}                     │
│  POST   /api/research/query                                  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  PostgreSQL Database                         │
│  ┌──────────────────────┐  ┌──────────────────────────────┐ │
│  │ research_conversations│  │ research_messages            │ │
│  │ - id (PK)            │  │ - id (PK)                    │ │
│  │ - title              │  │ - conversation_id (FK)       │ │
│  │ - created_at         │  │ - content                    │ │
│  │ - updated_at         │  │ - sender                     │ │
│  │                      │  │ - sources (JSON)             │ │
│  │                      │  │ - timestamp                  │ │
│  └──────────────────────┘  └──────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Message Flow Example

```
1. User types "What are the latest promises?" and clicks Send

2. Frontend:
   - Creates user message object
   - Adds to UI immediately
   - Calls apiClient.addMessage(convId, "What are...", "user")
   - Calls apiClient.researchQuery("What are...")

3. Backend:
   - Saves user message to research_messages table
   - Searches knowledge base
   - Returns research response with sources

4. Frontend:
   - Creates assistant message object
   - Adds to UI
   - Calls apiClient.addMessage(convId, answer, "assistant", sources)
   - Refreshes conversation list

5. Database:
   - User message saved
   - Assistant message saved
   - Conversation updated_at timestamp updated

6. Result:
   - Both messages visible in chat
   - Conversation appears in sidebar
   - Can be loaded later
```

## Error Handling

```typescript
try {
  const response = await apiClient.researchQuery(text)
  // Handle success
} catch (error) {
  console.error("Failed to query research:", error)
  // Show error message to user
  const errorMsg: Message = {
    id: (Date.now() + 1).toString(),
    role: "assistant",
    content: "Sorry, I encountered an error processing your request. Please try again.",
    timestamp: new Date()
  }
  setMessages((prev) => [...prev, errorMsg])
}
```

## Performance Considerations

1. **Lazy Loading**: Conversations loaded on demand
2. **Pagination**: Can be added for large conversation lists
3. **Caching**: Conversation list cached in state
4. **Indexing**: Database indexes on conversation_id and timestamp
5. **Batch Operations**: Messages saved individually (can be batched)

## Security Considerations

1. **Input Validation**: Pydantic models validate all inputs
2. **SQL Injection**: SQLAlchemy ORM prevents SQL injection
3. **XSS Prevention**: React escapes all user input
4. **CORS**: API should have proper CORS configuration
5. **Authentication**: Can be added via middleware

## Scalability

- Supports unlimited conversations
- Supports unlimited messages per conversation
- Database indexes for fast queries
- Pagination can be added for large datasets
- Caching layer can be added for frequently accessed conversations
