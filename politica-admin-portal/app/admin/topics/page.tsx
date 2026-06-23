"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  ArrowLeft,
  Search,
  Heart,
  MessageCircle,
  Share2,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
} from "lucide-react"
import { apiClient, type Document } from "@/lib/api-client"

function sentimentColor(score: number): string {
  if (score >= 0.6) return "text-emerald-400"
  if (score >= 0.4) return "text-amber-400"
  return "text-rose-400"
}

function sentimentLabel(score: number): string {
  if (score >= 0.6) return "Positive"
  if (score >= 0.4) return "Neutral"
  return "Negative"
}

function sentimentBg(score: number): string {
  if (score >= 0.6) return "bg-emerald-500/10 border-emerald-500/20"
  if (score >= 0.4) return "bg-amber-500/10 border-amber-500/20"
  return "bg-rose-500/10 border-rose-500/20"
}

export default function TopicsPage() {
  const searchParams = useSearchParams()
  const topicParam = searchParams.get("topic")
  
  const [documents, setDocuments] = useState<Document[]>([])
  const [filteredDocuments, setFilteredDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedTopic, setSelectedTopic] = useState<string | null>(topicParam)

  useEffect(() => {
    const loadDocuments = async () => {
      setLoading(true)
      try {
        const docs = await apiClient.getDocuments({ limit: 1000 })
        setDocuments(docs)
      } catch (error) {
        console.error("Failed to load documents:", error)
        setDocuments([])
      } finally {
        setLoading(false)
      }
    }

    loadDocuments()
  }, [])

  useEffect(() => {
    let filtered = documents

    // Filter by topic if selected
    if (selectedTopic) {
      filtered = filtered.filter((doc) => {
        const topics = Array.isArray(doc.topics) ? doc.topics : []
        return topics.some((t) =>
          typeof t === "string"
            ? t.toLowerCase().includes(selectedTopic.toLowerCase())
            : false
        )
      })
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (doc) =>
          doc.title.toLowerCase().includes(query) ||
          doc.content.toLowerCase().includes(query) ||
          (doc.author && doc.author.toLowerCase().includes(query))
      )
    }

    setFilteredDocuments(filtered)
  }, [documents, selectedTopic, searchQuery])

  const avgSentiment =
    filteredDocuments.length > 0
      ? filteredDocuments.reduce((sum, doc) => sum + (doc.sentiment || 0), 0) /
        filteredDocuments.length
      : 0

  const positiveCount = filteredDocuments.filter(
    (doc) => (doc.sentiment || 0) > 0.2
  ).length
  const negativeCount = filteredDocuments.filter(
    (doc) => (doc.sentiment || 0) < -0.2
  ).length
  const neutralCount =
    filteredDocuments.length - positiveCount - negativeCount

  return (
    <div className="flex flex-col gap-6 pb-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="size-4" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {selectedTopic ? `Topic: ${selectedTopic}` : "All Topics"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {filteredDocuments.length} document{filteredDocuments.length !== 1 ? "s" : ""} found
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      {filteredDocuments.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">Avg Sentiment</p>
                <p className={`text-2xl font-bold ${sentimentColor(avgSentiment)}`}>
                  {(avgSentiment * 100).toFixed(0)}%
                </p>
                <p className="text-xs text-muted-foreground">
                  {sentimentLabel(avgSentiment)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-emerald-500/5 border-emerald-500/20">
            <CardContent className="pt-6">
              <div className="flex flex-col gap-2">
                <p className="text-sm text-emerald-400">Positive</p>
                <p className="text-2xl font-bold text-emerald-400">
                  {positiveCount}
                </p>
                <p className="text-xs text-muted-foreground">
                  {filteredDocuments.length > 0
                    ? Math.round((positiveCount / filteredDocuments.length) * 100)
                    : 0}
                  %
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-amber-500/5 border-amber-500/20">
            <CardContent className="pt-6">
              <div className="flex flex-col gap-2">
                <p className="text-sm text-amber-400">Neutral</p>
                <p className="text-2xl font-bold text-amber-400">
                  {neutralCount}
                </p>
                <p className="text-xs text-muted-foreground">
                  {filteredDocuments.length > 0
                    ? Math.round((neutralCount / filteredDocuments.length) * 100)
                    : 0}
                  %
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-rose-500/5 border-rose-500/20">
            <CardContent className="pt-6">
              <div className="flex flex-col gap-2">
                <p className="text-sm text-rose-400">Negative</p>
                <p className="text-2xl font-bold text-rose-400">
                  {negativeCount}
                </p>
                <p className="text-xs text-muted-foreground">
                  {filteredDocuments.length > 0
                    ? Math.round((negativeCount / filteredDocuments.length) * 100)
                    : 0}
                  %
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search documents..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Documents List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredDocuments.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">
              {documents.length === 0
                ? "No documents found"
                : "No documents match your search"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredDocuments.map((doc) => (
            <Card
              key={doc.id}
              className={`border ${sentimentBg(doc.sentiment || 0)} hover:bg-accent/30 transition-colors`}
            >
              <CardContent className="pt-6">
                <div className="flex flex-col gap-4">
                  {/* Title and Sentiment */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground line-clamp-2">
                        {doc.title}
                      </h3>
                      {doc.author && (
                        <p className="text-sm text-muted-foreground mt-1">
                          by {doc.author}
                          {doc.author_handle && ` (@${doc.author_handle})`}
                        </p>
                      )}
                    </div>
                    <Badge
                      variant="secondary"
                      className={`shrink-0 ${sentimentColor(doc.sentiment || 0)}`}
                    >
                      {sentimentLabel(doc.sentiment || 0)}
                    </Badge>
                  </div>

                  {/* Content Preview */}
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {doc.content}
                  </p>

                  {/* Metadata */}
                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Heart className="size-3" />
                      <span>{doc.likes_count || 0}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageCircle className="size-3" />
                      <span>{doc.comments_count || 0}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Share2 className="size-3" />
                      <span>{doc.shares_count || 0}</span>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {doc.platform}
                    </Badge>
                    {doc.collected_at && (
                      <span>
                        {new Date(doc.collected_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {/* Topics */}
                  {Array.isArray(doc.topics) && doc.topics.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {doc.topics.map((topic, idx) => (
                        <Badge
                          key={idx}
                          variant="secondary"
                          className="text-[10px]"
                        >
                          {typeof topic === "string" ? topic : "topic"}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
