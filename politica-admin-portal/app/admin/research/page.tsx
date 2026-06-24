"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
  Brain,
  Search,
  Sparkles,
  X,
  Check,
  ChevronRight,
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
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<Record<string, "helpful" | "improve">>({})
  const [feedbackOpen, setFeedbackOpen] = useState<string | null>(null)
  const [feedbackComment, setFeedbackComment] = useState("")
  const [feedbackRating, setFeedbackRating] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadConversations()
  }, [])

  useEffect(() => {
    if (currentConversation) {
      loadMessages(currentConversation.id)
    }
  }, [currentConversation])

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function loadConversations() {
    try {
      setLoadingConvs(true)
      const convs = await apiClient.listConversations()
      setConversations(convs || [])
      if (convs?.length > 0 && !currentConversation) {
        setCurrentConversation(convs[0])
      }
    } catch (error) {
      setConversations([])
    } finally {
      setLoadingConvs(false)
    }
  }

  async function loadMessages(conversationId: string) {
    try {
      const msgs = await apiClient.getMessages(conversationId)
      setMessages(msgs || [])
    } catch (error) {
      setMessages([])
    }
  }

  async function createNewConversation() {
    try {
      const title = `Session ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`
      const conv = await apiClient.createConversation(title)
      setConversations([conv, ...conversations])
      setCurrentConversation(conv)
      setMessages([])
      inputRef.current?.focus()
    } catch (error) {
      console.error("Failed to create conversation:", error)
    }
  }

  async function deleteConversation(id: string) {
    try {
      await apiClient.deleteConversation(id)
      const updated = conversations.filter(c => c.id !== id)
      setConversations(updated)
      if (currentConversation?.id === id) {
        setCurrentConversation(updated[0] || null)
        setMessages([])
      }
    } catch (error) {
      console.error("Failed to delete:", error)
    }
  }

  const [loadingStage, setLoadingStage] = useState<string>("")

  async function handleSubmitQuery() {
    if (!query.trim() || loading) return

    // Auto-create conversation if none exists
    let convId = currentConversation?.id
    if (!convId) {
      try {
        const title = `Session ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`
        const conv = await apiClient.createConversation(title)
        setConversations([conv, ...conversations])
        setCurrentConversation(conv)
        convId = conv.id
      } catch {
        return
      }
    }

    if (!convId) return

    const userMessage: Message = {
      id: `temp_${Date.now()}`,
      content: query,
      sender: "user",
      timestamp: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])
    const currentQuery = query
    setQuery("")
    setLoading(true)
    setLoadingStage("Thinking...")

    try {
      // Stage 1: Save user message
      const userMsgResponse = await apiClient.addMessage(convId, {
        content: currentQuery,
        sender: "user",
      })

      setMessages((prev) =>
        prev.map((msg) => msg.id === userMessage.id ? { ...msg, id: userMsgResponse.id } : msg)
      )

      // Stage 2: Searching
      setLoadingStage("Searching local data...")
      await new Promise(r => setTimeout(r, 400))
      
      setLoadingStage("Searching internet if needed...")
      const response = await apiClient.searchResearch({ 
        query: currentQuery, 
        max_results: 5,
        conversation_id: convId,
      })

      // Stage 3: Analyzing
      setLoadingStage("Analyzing sources...")
      await new Promise(r => setTimeout(r, 300))

      // Stage 4: Generating
      setLoadingStage("Generating response...")
      
      const assistantMsgResponse = await apiClient.addMessage(convId, {
        content: response.answer,
        sender: "assistant",
        sources: response.sources,
      })

      const assistantMessage: Message = {
        id: assistantMsgResponse.id,
        content: response.answer,
        sender: "assistant",
        sources: response.sources,
        timestamp: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: `error_${Date.now()}`,
          content: "I couldn't process that request. Please try again.",
          sender: "assistant",
          timestamp: new Date().toISOString(),
        },
      ])
    } finally {
      setLoading(false)
      setLoadingStage("")
      inputRef.current?.focus()
    }
  }

  async function handleFeedback(messageId: string, type: "helpful" | "improve") {
    if (feedbackSubmitted[messageId]) return

    if (type === "helpful") {
      try {
        await apiClient.submitFeedback({
          message_id: messageId,
          rating: 5,
          feedback_type: "helpful",
        })
        setFeedbackSubmitted({ ...feedbackSubmitted, [messageId]: "helpful" })
      } catch {}
    } else {
      setFeedbackOpen(messageId)
      setFeedbackRating(2)
    }
  }

  async function submitDetailedFeedback() {
    if (!feedbackOpen) return
    try {
      await apiClient.submitFeedback({
        message_id: feedbackOpen,
        rating: feedbackRating,
        feedback_type: feedbackRating <= 2 ? "incorrect" : "incomplete",
        comment: feedbackComment || undefined,
      })
      setFeedbackSubmitted({ ...feedbackSubmitted, [feedbackOpen]: "improve" })
      setFeedbackOpen(null)
      setFeedbackComment("")
      setFeedbackRating(0)
    } catch {}
  }

  function formatTime(timestamp: string) {
    return new Date(timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
  }

  const suggestedQuestions = [
    "What are the top trending topics?",
    "Show negative sentiment posts",
    "Who are the most active commenters?",
    "What promises were made recently?",
  ]

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-0 -m-6">
      {/* Sidebar */}
      <aside className="w-72 bg-muted/30 border-r border-border flex flex-col">
        <div className="px-4 pt-4 pb-3 border-b border-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">History</p>
          <Button onClick={createNewConversation} className="w-full" size="sm" variant="outline">
            <Plus className="size-4 mr-2" />
            New Session
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingConvs ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-8 px-4">
              <MessageSquare className="size-8 mx-auto mb-2 text-muted-foreground opacity-40" />
              <p className="text-xs text-muted-foreground">No sessions yet</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => setCurrentConversation(conv)}
                  className={`group flex items-center gap-2 px-3 py-2.5 rounded-md cursor-pointer transition-all ${
                    currentConversation?.id === conv.id
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted text-foreground"
                  }`}
                >
                  <MessageSquare className="size-3.5 shrink-0 opacity-60" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate font-medium">{conv.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {new Date(conv.updated_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteConversation(conv.id)
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="px-6 py-4 border-b border-border bg-background/80 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Brain className="size-4 text-primary" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-foreground">Research Assistant</h1>
              <p className="text-xs text-muted-foreground">
                {currentConversation ? currentConversation.title : "Ask questions about your collected data"}
              </p>
            </div>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center max-w-lg mx-auto">
              <div className="size-16 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-center mb-4">
                <Sparkles className="size-7 text-primary/60" />
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-1">How can I help?</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Ask me anything about your collected social media data, sentiment trends, or political insights.
              </p>
              <div className="grid grid-cols-2 gap-2 w-full">
                {suggestedQuestions.map((q) => (
                  <button
                    key={q}
                    onClick={() => {
                      setQuery(q)
                      inputRef.current?.focus()
                    }}
                    className="text-left text-sm px-3 py-2.5 rounded-lg border border-border hover:bg-muted/50 hover:border-primary/20 transition-all text-muted-foreground hover:text-foreground"
                  >
                    <ChevronRight className="size-3 inline mr-1.5 opacity-50" />
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6 max-w-3xl mx-auto">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-3 ${msg.sender === "user" ? "justify-end" : ""}`}>
                  {msg.sender === "assistant" && (
                    <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Brain className="size-3.5 text-primary" />
                    </div>
                  )}

                  <div className={`flex-1 max-w-xl ${msg.sender === "user" ? "flex flex-col items-end" : ""}`}>
                    <div
                      className={`px-4 py-3 rounded-xl ${
                        msg.sender === "user"
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-muted/60 border border-border rounded-bl-sm"
                      }`}
                    >
                      <div className="text-sm leading-relaxed">
                        {msg.sender === "assistant" ? (
                          <ReactMarkdown
                            components={{
                              p: (props) => <p className="mb-2 last:mb-0" {...props} />,
                              ul: (props) => <ul className="list-disc list-inside mb-2 last:mb-0 space-y-1" {...props} />,
                              ol: (props) => <ol className="list-decimal list-inside mb-2 last:mb-0 space-y-1" {...props} />,
                              li: (props) => <li className="leading-relaxed" {...props} />,
                              code: (props) => <code className="bg-background/50 px-1.5 py-0.5 rounded text-xs font-mono" {...props} />,
                              pre: (props) => <pre className="bg-background/50 p-3 rounded-lg text-xs font-mono overflow-x-auto mb-2" {...props} />,
                              blockquote: (props) => <blockquote className="border-l-2 border-primary/30 pl-3 italic text-muted-foreground" {...props} />,
                              a: (props) => <a className="text-primary hover:underline" {...props} />,
                              strong: (props) => <strong className="font-semibold" {...props} />,
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        ) : (
                          msg.content
                        )}
                      </div>
                    </div>

                    {/* Timestamp */}
                    <span className="text-[10px] text-muted-foreground mt-1 px-1">
                      {formatTime(msg.timestamp)}
                    </span>

                    {/* Feedback */}
                    {msg.sender === "assistant" && !msg.id.startsWith("error_") && (
                      <div className="mt-1.5 px-1">
                        {feedbackSubmitted[msg.id] ? (
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Check className="size-3 text-green-500" />
                            Feedback recorded
                          </span>
                        ) : feedbackOpen === msg.id ? (
                          <div className="bg-muted/40 border border-border rounded-lg p-3 mt-1 space-y-2.5">
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                  key={star}
                                  onClick={() => setFeedbackRating(star)}
                                >
                                  <Star
                                    className={`size-4 transition-colors ${
                                      feedbackRating >= star
                                        ? "fill-amber-400 text-amber-400"
                                        : "text-muted-foreground/40 hover:text-amber-300"
                                    }`}
                                  />
                                </button>
                              ))}
                              <span className="text-[11px] text-muted-foreground ml-2">
                                {feedbackRating > 0 && `${feedbackRating}/5`}
                              </span>
                            </div>
                            <textarea
                              value={feedbackComment}
                              onChange={(e) => setFeedbackComment(e.target.value)}
                              placeholder="What could be improved? (optional)"
                              className="w-full px-2.5 py-1.5 rounded-md text-xs bg-background border border-border resize-none focus:outline-none focus:ring-1 focus:ring-primary/30"
                              rows={2}
                            />
                            <div className="flex items-center gap-2">
                              <Button size="sm" onClick={submitDetailedFeedback} className="h-7 text-xs px-3">
                                Submit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setFeedbackOpen(null)
                                  setFeedbackComment("")
                                }}
                                className="h-7 text-xs px-3"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleFeedback(msg.id, "helpful")}
                              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted transition-all"
                            >
                              <ThumbsUp className="size-3" />
                            </button>
                            <button
                              onClick={() => handleFeedback(msg.id, "improve")}
                              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted transition-all"
                            >
                              <ThumbsDown className="size-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {msg.sender === "user" && (
                    <div className="size-7 rounded-full bg-foreground/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-xs font-medium">You</span>
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex gap-3">
                  <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Brain className="size-3.5 text-primary animate-pulse" />
                  </div>
                  <div className="bg-muted/60 border border-border rounded-xl rounded-bl-sm px-4 py-3">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <Loader2 className="size-3.5 animate-spin text-primary" />
                        <span className="text-sm font-medium text-foreground">{loadingStage}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        {["Thinking", "Searching", "Analyzing", "Generating"].map((stage, idx) => {
                          const currentIdx = loadingStage.includes("Think") ? 0 
                            : loadingStage.includes("Search") ? 1 
                            : loadingStage.includes("Analyz") ? 2 
                            : loadingStage.includes("Generat") ? 3 : 0
                          return (
                            <div key={stage} className="flex items-center gap-1.5">
                              <div className={`size-1.5 rounded-full transition-all duration-300 ${
                                idx <= currentIdx ? "bg-primary scale-110" : "bg-muted-foreground/30"
                              }`} />
                              {idx < 3 && <div className={`w-4 h-px transition-all duration-300 ${
                                idx < currentIdx ? "bg-primary" : "bg-muted-foreground/20"
                              }`} />}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={scrollRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="px-6 py-4 border-t border-border bg-background shrink-0">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-2 bg-muted/30 border border-border rounded-xl px-4 py-2 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/30 transition-all">
              <Search className="size-4 text-muted-foreground shrink-0" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Ask about your data..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSubmitQuery()}
                disabled={loading}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
              />
              <Button
                onClick={handleSubmitQuery}
                disabled={loading || !query.trim()}
                size="sm"
                className="h-7 px-3 rounded-lg"
              >
                {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground/60 mt-1.5 text-center">
              Press Enter to send. Results based on your collected data.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
