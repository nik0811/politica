"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { apiClient } from "@/lib/api-client"
import { Send, Bot, User, Loader2, FileText, BookMarked, Users, Plus, Trash2, MessageSquare } from "lucide-react"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  sources?: any[]
  timestamp: Date
}

interface Conversation {
  id: string
  title: string
  created_at: string
  updated_at: string
  message_count: number
}

export default function ResearchPage() {
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
  const [showConversationList, setShowConversationList] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    async function fetchStats() {
      try {
        const stats = await apiClient.getKnowledgeBaseStats()
        setKbStats(stats)
      } catch (error) {
        console.error("Failed to fetch KB stats:", error)
      }
    }
    fetchStats()
  }, [])

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
      await apiClient.addMessage(conversationId, text, "user")

      const response = await apiClient.researchQuery(text)

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response.answer,
        sources: response.sources,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, assistantMsg])

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

  const currentConversation = conversations.find((c) => c.id === currentConversationId)

  return (
    <div className="flex flex-col gap-4 max-w-6xl mx-auto h-full">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Conversations Sidebar */}
        <div className="lg:col-span-1">
          <Card className="bg-card border-border h-full flex flex-col" style={{ height: "calc(100vh - 12rem)" }}>
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
        </div>

        {/* Chat Area */}
        <Card className="lg:col-span-2 bg-card border-border flex flex-col" style={{ height: "calc(100vh - 12rem)" }}>
          <CardHeader className="pb-3 border-b border-border shrink-0">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Bot className="size-4 text-primary" /> Research Assistant
              <Badge variant="secondary" className="text-[10px] ml-auto">
                {currentConversation ? "Active" : "New Chat"}
              </Badge>
            </CardTitle>
            {currentConversation && (
              <p className="text-xs text-muted-foreground mt-1">{currentConversation.title}</p>
            )}
          </CardHeader>

          <ScrollArea className="flex-1 px-4 py-3">
            <div className="flex flex-col gap-4">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div
                    className={`size-7 rounded-full flex items-center justify-center shrink-0 ${
                      msg.role === "user" ? "bg-primary/20" : "bg-muted"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <User className="size-3.5 text-primary" />
                    ) : (
                      <Bot className="size-3.5 text-muted-foreground" />
                    )}
                  </div>
                  <div className={`flex flex-col gap-2 max-w-[85%] ${msg.role === "user" ? "items-end" : ""}`}>
                    <div
                      className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground"
                      }`}
                    >
                      {msg.content}
                    </div>
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {msg.sources.map((s: any, i: number) => (
                          <span
                            key={i}
                            className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 border border-border px-2 py-0.5 rounded-full"
                          >
                            {s.type === "document" ? (
                              <FileText className="size-2.5" />
                            ) : s.type === "promise" ? (
                              <BookMarked className="size-2.5" />
                            ) : (
                              <Users className="size-2.5" />
                            )}
                            {s.title?.slice(0, 30) || s.entity || "Source"}
                          </span>
                        ))}
                      </div>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex gap-3">
                  <div className="size-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <Bot className="size-3.5 text-muted-foreground" />
                  </div>
                  <div className="bg-muted rounded-xl px-4 py-3 flex items-center gap-1.5">
                    <Loader2 className="size-4 animate-spin" />
                    <span className="text-sm">Searching...</span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          <div className="p-4 border-t border-border shrink-0">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
                placeholder="Ask about documents, promises, entities..."
                className="bg-input border-border text-sm h-10"
                disabled={loading}
              />
              <Button
                onClick={() => sendMessage(input)}
                disabled={loading || !input.trim()}
                size="icon"
                className="size-10 shrink-0"
              >
                <Send className="size-4" />
              </Button>
            </div>
          </div>
        </Card>

        {/* Knowledge Base Stats */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Knowledge Base
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1.5 pt-0 text-xs">
            {kbStats ? (
              <>
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Documents</span>
                  <span className="font-medium text-foreground">{kbStats.documents?.toLocaleString() || 0}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Promises</span>
                  <span className="font-medium text-foreground">{kbStats.promises?.toLocaleString() || 0}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Entities</span>
                  <span className="font-medium text-foreground">{kbStats.entities?.toLocaleString() || 0}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Topics</span>
                  <span className="font-medium text-foreground">{kbStats.topics?.toLocaleString() || 0}</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-muted-foreground">Languages</span>
                  <span className="font-medium text-foreground">{kbStats.languages?.toLocaleString() || 0}</span>
                </div>
              </>
            ) : (
              <Loader2 className="size-4 animate-spin mx-auto my-4" />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
