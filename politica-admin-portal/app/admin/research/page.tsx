"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  AlertCircle,
  BarChart3,
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

interface FeedbackState {
  messageId: string | null
  type: "helpful" | "incorrect" | "incomplete" | "irrelevant" | null
  rating: number | null
  comment: string
  suggestion: string
}

export default function ResearchPage() {
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [feedbackStats, setFeedbackStats] = useState<any>(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackState>({
    messageId: null,
    type: null,
    rating: null,
    comment: "",
    suggestion: "",
  })
  const scrollRef = useRef<HTMLDivElement>(null)

  // Initialize conversation
  useEffect(() => {
    initializeConversation()
    fetchFeedbackStats()
  }, [])

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages])

  async function initializeConversation() {
    try {
      const conv = await apiClient.createConversation("Research Session")
      setConversationId(conv.id)
    } catch (error) {
      console.error("Failed to create conversation:", error)
    }
  }

  async function fetchFeedbackStats() {
    try {
      const stats = await apiClient.getFeedbackStats()
      setFeedbackStats(stats)
    } catch (error) {
      console.error("Failed to fetch feedback stats:", error)
    }
  }

  async function handleSubmitQuery() {
    if (!query.trim() || !conversationId || loading) return

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
      // Add user message to conversation
      await apiClient.addMessage(conversationId, {
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

      // Add assistant message to conversation
      await apiClient.addMessage(conversationId, {
        content: response.answer,
        sender: "assistant",
        sources: response.sources,
      })

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      console.error("Failed to get response:", error)
      const errorMessage: Message = {
        id: `msg_${Date.now()}_error`,
        content: "Sorry, I encountered an error processing your query. Please try again.",
        sender: "assistant",
        timestamp: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmitFeedback() {
    if (!feedback.messageId || !feedback.type) return

    try {
      await apiClient.submitFeedback({
        message_id: feedback.messageId,
        rating: feedback.rating,
        feedback_type: feedback.type,
        comment: feedback.comment || undefined,
        suggested_improvement: feedback.suggestion || undefined,
      })

      // Reset feedback form
      setFeedback({
        messageId: null,
        type: null,
        rating: null,
        comment: "",
        suggestion: "",
      })
      setShowFeedback(false)

      // Refresh stats
      await fetchFeedbackStats()

      // Show success message
      const successMsg: Message = {
        id: `msg_${Date.now()}_success`,
        content: "✅ Thank you for your feedback! It helps me improve.",
        sender: "assistant",
        timestamp: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, successMsg])
    } catch (error) {
      console.error("Failed to submit feedback:", error)
    }
  }

  function startFeedback(messageId: string) {
    setFeedback({ ...feedback, messageId })
    setShowFeedback(true)
  }

  return (
    <div className="flex flex-col gap-6 h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Research Assistant</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Ask questions about your data and get AI-powered insights</p>
        </div>
        {feedbackStats && (
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium">{feedbackStats.total_feedback} feedback</p>
              <p className="text-xs text-muted-foreground">⭐ {feedbackStats.average_rating?.toFixed(1)}/5</p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0">
        {/* Chat Area */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          <Card className="bg-card border-border flex-1 flex flex-col min-h-0">
            <CardContent className="flex-1 overflow-hidden flex flex-col p-4">
              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-4">
                  {messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-center py-12">
                      <div>
                        <MessageSquare className="size-12 mx-auto mb-3 text-muted-foreground opacity-30" />
                        <p className="text-sm text-muted-foreground">
                          Start by asking a question about your data
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
                          className={`max-w-md lg:max-w-lg px-4 py-3 rounded-lg ${
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

                          {/* Feedback Buttons for Assistant Messages */}
                          {msg.sender === "assistant" && !msg.content.includes("✅") && (
                            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-current border-opacity-20">
                              <button
                                onClick={() => startFeedback(msg.id)}
                                className="flex items-center gap-1 text-xs opacity-70 hover:opacity-100 transition-opacity"
                              >
                                <ThumbsUp className="size-3" />
                                Helpful
                              </button>
                              <button
                                onClick={() => {
                                  setFeedback({
                                    messageId: msg.id,
                                    type: "incorrect",
                                    rating: null,
                                    comment: "",
                                    suggestion: "",
                                  })
                                  setShowFeedback(true)
                                }}
                                className="flex items-center gap-1 text-xs opacity-70 hover:opacity-100 transition-opacity"
                              >
                                <ThumbsDown className="size-3" />
                                Improve
                              </button>
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
                  placeholder="Ask a question about your data..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSubmitQuery()}
                  disabled={loading}
                  className="flex-1"
                />
                <Button
                  onClick={handleSubmitQuery}
                  disabled={loading || !query.trim()}
                  size="sm"
                >
                  {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          {/* Feedback Form */}
          {showFeedback && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Share Feedback</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Feedback Type */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">
                    What's your feedback?
                  </label>
                  <div className="space-y-2">
                    {(["helpful", "incorrect", "incomplete", "irrelevant"] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => setFeedback({ ...feedback, type })}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                          feedback.type === type
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted hover:bg-muted/80"
                        }`}
                      >
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Rating */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">
                    Rate this response
                  </label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setFeedback({ ...feedback, rating: star })}
                        className="transition-colors"
                      >
                        <Star
                          className={`size-5 ${
                            feedback.rating && feedback.rating >= star
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-muted-foreground"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Comment */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Comment (optional)
                  </label>
                  <textarea
                    value={feedback.comment}
                    onChange={(e) => setFeedback({ ...feedback, comment: e.target.value })}
                    placeholder="What could be improved?"
                    className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-sm resize-none"
                    rows={3}
                  />
                </div>

                {/* Suggestion */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Suggestion (optional)
                  </label>
                  <textarea
                    value={feedback.suggestion}
                    onChange={(e) => setFeedback({ ...feedback, suggestion: e.target.value })}
                    placeholder="How should I improve?"
                    className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-sm resize-none"
                    rows={2}
                  />
                </div>

                {/* Submit Button */}
                <div className="flex gap-2">
                  <Button
                    onClick={handleSubmitFeedback}
                    disabled={!feedback.type}
                    size="sm"
                    className="flex-1"
                  >
                    Submit
                  </Button>
                  <Button
                    onClick={() => setShowFeedback(false)}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Feedback Stats */}
          {feedbackStats && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="size-4" />
                  Feedback Stats
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Average Rating</p>
                  <p className="text-lg font-semibold">
                    {feedbackStats.average_rating?.toFixed(1)}/5 ⭐
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-2">Feedback Breakdown</p>
                  <div className="space-y-1">
                    {Object.entries(feedbackStats.feedback_by_type || {}).map(([type, count]: any) => (
                      <div key={type} className="flex items-center justify-between text-xs">
                        <span className="capitalize text-muted-foreground">{type}</span>
                        <span className="font-medium">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    Total: {feedbackStats.total_feedback} responses
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tips */}
          <Card className="bg-blue-500/5 border-blue-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertCircle className="size-4 text-blue-500" />
                Tips
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-2">
              <p>• Be specific in your questions</p>
              <p>• Provide feedback to help improve</p>
              <p>• Use suggestions to guide improvements</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
