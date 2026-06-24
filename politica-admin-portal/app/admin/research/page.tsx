"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Send,
  Loader2,
  ThumbsUp,
  ThumbsDown,
  Star,
  MessageSquare,
  Plus,
  Trash2,
  Clock,
} from "lucide-react"
import { apiClient } from "@/lib/api-client"
import ReactMarkdown from "react-markdown"

interface Message {
  id: string
  content: string
  sender: "user" | "assistant"
  sources?: any[]
  timestamp: string
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
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState<string | null>(null)
  const [feedbackData, setFeedbackData] = useState<any>({})
  const scrollRef = useRef<HTMLDivElement>(null)

  // Load conversations on mount
  useEffect(() => {
    loadConversations()
  }, [])

  // Load messages when conversation changes
  useEffect(() => {
    if (currentConversation) {
      loadMessages(currentConversation.id)
    }
  }, [currentConversation])

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages])

  async function loadConversations() {
    try {
      const convs = await apiClient.listConversations()
      setConversations(convs)
      if (convs.length > 0 && !currentConversation) {
        setCurrentConversation(convs[0])
      }
    } catch (error) {
      console.error("Failed to load conversations:", error)
    }
  }

  async function loadMessages(conversationId: string) {
    try {
      const msgs = await apiClient.getMessages(conversationId)
      setMessages(msgs)
    } catch (error) {
      console.error("Failed to load messages:", error)
    }
  }

  async function createNewConversation() {
    try {
      const conv = await apiClient.createConversation(`Research - ${new Date().toLocaleDateString()}`)
      setConversations([conv, ...conversations])
      setCurrentConversation(conv)
      setMessages([])
    } catch (error) {
      console.error("Failed to create conversation:", error)
    }
  }

  async function deleteConversation(id: string) {
    try {
      await apiClient.deleteConversation(id)
      setConversations(conversations.filter(c => c.id !== id))
      if (currentConversation?.id === id) {
        setCurrentConversation(conversations[0] || null)
        setMessages([])
      }
    } catch (error) {
      console.error("Failed to delete conversation:", error)
    }
  }

  async function handleSubmitQuery() {
    if (!query.trim() || !currentConversation || loading) return

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      content: query,
      sender: "user",
      timestamp: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])
    setQuery("")
    setLoading(true)

    try {
      // Add user message
      await apiClient.addMessage(currentConversation.id, {
        content: query,
        sender: "user",
      })

      // Get assistant response
      const response = await apiClient.searchResearch({
        query,
        max_results: 5,
      })

      const assistantMessage: Message = {
        id: `msg_${Date.now()}_assistant`,
        content: response.answer,
        sender: "assistant",
        sources: response.sources,
        timestamp: new Date().toISOString(),
      }

      // Add assistant message
      await apiClient.addMessage(currentConversation.id, {
        content: response.answer,
        sender: "assistant",
        sources: response.sources,
      })

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      console.error("Failed to get response:", error)
      const errorMessage: Message = {
        id: `msg_${Date.now()}_error`,
        content: "Sorry, I encountered an error. Please try again.",
        sender: "assistant",
        timestamp: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  async function submitFeedback(messageId: string) {
    try {
      await apiClient.submitFeedback({
        message_id: messageId,
        rating: feedbackData[messageId]?.rating,
        feedback_type: feedbackData[messageId]?.type,
        comment: feedbackData[messageId]?.comment,
        suggested_improvement: feedbackData[messageId]?.suggestion,
      })

      setFeedbackOpen(null)
      setFeedbackData({})
    } catch (error) {
      console.error("Failed to submit feedback:", error)
    }
  }

  return (
    <div className="flex gap-6 h-screen">
      {/* Sidebar - Conversation History */}
      <div className="w-64 flex flex-col gap-4 border-r border-border">
        <div className="p-4 border-b border-border">
          <Button onClick={createNewConversation} className="w-full" size="sm">
            <Plus className="size-4 mr-2" />
            New Conversation
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-2 px-4">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => setCurrentConversation(conv)}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  currentConversation?.id === conv.id
                    ? "bg-primary/10 border border-primary/20"
                    : "hover:bg-muted/50"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{conv.title}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <Clock className="size-3" />
                      {new Date(conv.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteConversation(conv.id)
                    }}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Research Assistant</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {currentConversation?.title || "Select a conversation"}
            </p>
          </div>
        </div>

        <Card className="bg-card border-border flex-1 flex flex-col min-h-0">
          <CardContent className="flex-1 overflow-hidden flex flex-col p-4">
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-4">
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-center py-12">
                    <div>
                      <MessageSquare className="size-12 mx-auto mb-3 text-muted-foreground opacity-30" />
                      <p className="text-sm text-muted-foreground">
                        Start a conversation by asking a question
                      </p>
                    </div>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-3 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-2xl px-4 py-3 rounded-lg ${
                          msg.sender === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground border border-border"
                        }`}
                      >
                        <div className="text-sm">
                          {msg.sender === "assistant" ? (
                            <ReactMarkdown className="prose prose-sm dark:prose-invert max-w-none">
                              {msg.content}
                            </ReactMarkdown>
                          ) : (
                            msg.content
                          )}
                        </div>

                        {/* Feedback Buttons */}
                        {msg.sender === "assistant" && !msg.content.includes("error") && (
                          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-current border-opacity-20">
                            <button
                              onClick={() => {
                                setFeedbackOpen(msg.id)
                                setFeedbackData({
                                  ...feedbackData,
                                  [msg.id]: { type: "helpful", rating: 5 },
                                })
                              }}
                              className="flex items-center gap-1 text-xs opacity-70 hover:opacity-100 transition-opacity"
                            >
                              <ThumbsUp className="size-3" />
                              Helpful
                            </button>
                            <button
                              onClick={() => {
                                setFeedbackOpen(msg.id)
                                setFeedbackData({
                                  ...feedbackData,
                                  [msg.id]: { type: "incorrect", rating: 2 },
                                })
                              }}
                              className="flex items-center gap-1 text-xs opacity-70 hover:opacity-100 transition-opacity"
                            >
                              <ThumbsDown className="size-3" />
                              Improve
                            </button>
                          </div>
                        )}

                        {/* Feedback Form */}
                        {feedbackOpen === msg.id && (
                          <div className="mt-3 pt-3 border-t border-current border-opacity-20 space-y-2">
                            <div className="flex gap-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                  key={star}
                                  onClick={() =>
                                    setFeedbackData({
                                      ...feedbackData,
                                      [msg.id]: { ...feedbackData[msg.id], rating: star },
                                    })
                                  }
                                  className="transition-colors"
                                >
                                  <Star
                                    className={`size-4 ${
                                      feedbackData[msg.id]?.rating >= star
                                        ? "fill-yellow-400 text-yellow-400"
                                        : "text-muted-foreground"
                                    }`}
                                  />
                                </button>
                              ))}
                            </div>
                            <textarea
                              value={feedbackData[msg.id]?.comment || ""}
                              onChange={(e) =>
                                setFeedbackData({
                                  ...feedbackData,
                                  [msg.id]: { ...feedbackData[msg.id], comment: e.target.value },
                                })
                              }
                              placeholder="Your feedback..."
                              className="w-full px-2 py-1 rounded text-xs bg-background/50 border border-current border-opacity-20 resize-none"
                              rows={2}
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => submitFeedback(msg.id)}
                                className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90"
                              >
                                Submit
                              </button>
                              <button
                                onClick={() => setFeedbackOpen(null)}
                                className="text-xs px-2 py-1 rounded bg-muted hover:bg-muted/80"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
                <div ref={scrollRef} />
              </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="flex gap-2 mt-4 pt-4 border-t border-border">
              <Input
                placeholder="Ask a question..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSubmitQuery()}
                disabled={loading || !currentConversation}
                className="flex-1"
              />
              <Button
                onClick={handleSubmitQuery}
                disabled={loading || !query.trim() || !currentConversation}
                size="sm"
              >
                {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
