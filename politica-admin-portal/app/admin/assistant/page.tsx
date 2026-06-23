"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  AlertCircle,
  Loader2,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Users,
  FileText,
  MessageCircle,
  Target,
  Brain,
  Flame,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  Minus,
  MapPin,
  Building2,
  User,
  Calendar,
  BarChart3,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { apiClient } from "@/lib/api-client"

interface TopicData {
  name: string
  document_count: number
  sentiment_avg?: number
}

interface EntityData {
  name: string
  type: string
  mention_count: number
}

interface PromiseData {
  id: string
  text: string
  topic?: string
  entity?: string
  status: string
  created_at: string
}

interface TrendData {
  date?: string
  period?: string
  positive?: number
  neutral?: number
  negative?: number
  total?: number
  count?: number
  sentiment_avg?: number
}

export default function AssistantPage() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  
  // Data states
  const [topics, setTopics] = useState<TopicData[]>([])
  const [entities, setEntities] = useState<EntityData[]>([])
  const [promises, setPromises] = useState<PromiseData[]>([])
  const [trends, setTrends] = useState<TrendData[]>([])
  const [stats, setStats] = useState<any>(null)
  const [negativeDocs, setNegativeDocs] = useState<any[]>([])
  const [criticalIndex, setCriticalIndex] = useState(0)

  async function fetchAllData() {
    try {
      setRefreshing(true)
      
      // Fetch all data including ingestion stats for total counts
      const [topicsData, entitiesData, promisesData, trendsData, engagementData, ingestionData, docsData] = await Promise.all([
        apiClient.getTopics({ limit: 50 }).catch(() => []),
        apiClient.getEntities({ limit: 50 }).catch(() => []),
        apiClient.getPromises({ limit: 20 }).catch(() => []),
        apiClient.getTrends().catch(() => ({ topics: [], sentiment_overview: null, daily_sentiment: [] })),
        apiClient.getEngagementStats().catch(() => ({})),
        apiClient.getIngestionStats().catch(() => ({ total_documents: 0, total_comments: 0 })),
        apiClient.getDocuments({ limit: 100 }).catch(() => []), // Get more docs to filter negative ones
      ])
      
      setTopics(topicsData)
      setEntities(entitiesData)
      setPromises(promisesData)
      setTrends(trendsData.daily_sentiment || [])
      
      // Filter negative sentiment documents (sentiment < -0.1)
      const negatives = (docsData || [])
        .filter((d: any) => d.sentiment !== null && d.sentiment < -0.1)
        .sort((a: any, b: any) => (a.sentiment || 0) - (b.sentiment || 0))
        .slice(0, 5)
      setNegativeDocs(negatives)
      
      setStats({
        ...engagementData,
        total_posts: ingestionData.total_documents || 0,
        total_comments: ingestionData.total_comments || 0,
        sentiment_percentages: trendsData.sentiment_overview?.distribution
      })
    } catch (error) {
      console.error("Failed to fetch data:", error)
    } finally {
      setRefreshing(false)
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAllData()
  }, [])

  // Calculate insights from data
  const totalDocs = stats?.total_posts || 0
  const totalComments = stats?.total_comments || 0
  
  // Sentiment distribution - use raw counts from engagement stats
  const sentimentData = stats?.sentiment_distribution || {}
  const totalProcessed = sentimentData.total_processed || 0
  const positiveCount = sentimentData.positive || 0
  const neutralCount = sentimentData.neutral || 0
  const negativeCount = sentimentData.negative || 0
  
  // Calculate percentages from raw counts
  const finalPositivePercent = totalProcessed > 0 ? Math.round((positiveCount / totalProcessed) * 100) : (stats?.sentiment_percentages?.positive ?? 0)
  const finalNegativePercent = totalProcessed > 0 ? Math.round((negativeCount / totalProcessed) * 100) : (stats?.sentiment_percentages?.negative ?? 0)
  const finalNeutralPercent = totalProcessed > 0 ? Math.round((neutralCount / totalProcessed) * 100) : (stats?.sentiment_percentages?.neutral ?? 0)

  // Top entities by type
  const politicians = entities.filter(e => e.type === "PERSON").slice(0, 5)
  const organizations = entities.filter(e => e.type === "ORGANIZATION").slice(0, 5)
  const locations = entities.filter(e => e.type === "LOCATION").slice(0, 5)

  // Hot topics (most discussed)
  const hotTopics = [...topics].sort((a, b) => b.document_count - a.document_count).slice(0, 5)
  
  // Critical topics (negative sentiment) - lower threshold since most content is neutral
  const criticalTopics = topics
    .filter(t => (t.sentiment_avg ?? 0) < -0.05)
    .sort((a, b) => (a.sentiment_avg ?? 0) - (b.sentiment_avg ?? 0))
    .slice(0, 5)

  // Recent promises
  const recentPromises = promises.slice(0, 5)

  // Trend analysis
  const recentTrend = trends.slice(-7)
  const avgSentiment = recentTrend.length > 0 
    ? recentTrend.reduce((sum, t) => sum + ((t.positive || 0) - (t.negative || 0)) / Math.max(t.total || 1, 1), 0) / recentTrend.length
    : 0
  const trendDirection = avgSentiment > 0.1 ? "positive" : avgSentiment < -0.1 ? "negative" : "stable"

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Brain className="size-5 text-primary" />
            Intelligence Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Critical insights and decision-making data from your collected content
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={fetchAllData}
          disabled={refreshing}
          className="h-8 text-xs gap-1.5"
        >
          {refreshing ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          Refresh
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-10 rounded-lg bg-primary/10">
                <FileText className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{totalDocs}</p>
                <p className="text-xs text-muted-foreground">Total Posts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-10 rounded-lg bg-blue-500/10">
                <MessageCircle className="size-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{totalComments}</p>
                <p className="text-xs text-muted-foreground">Comments</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-10 rounded-lg bg-green-500/10">
                <ThumbsUp className="size-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{finalPositivePercent}%</p>
                <p className="text-xs text-muted-foreground">Positive</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-10 rounded-lg bg-red-500/10">
                <ThumbsDown className="size-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{finalNegativePercent}%</p>
                <p className="text-xs text-muted-foreground">Negative</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`flex items-center justify-center size-10 rounded-lg ${
                trendDirection === "positive" ? "bg-green-500/10" : 
                trendDirection === "negative" ? "bg-red-500/10" : "bg-gray-500/10"
              }`}>
                {trendDirection === "positive" ? <TrendingUp className="size-5 text-green-500" /> :
                 trendDirection === "negative" ? <TrendingDown className="size-5 text-red-500" /> :
                 <Minus className="size-5 text-gray-500" />}
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground capitalize">{trendDirection}</p>
                <p className="text-xs text-muted-foreground">7-Day Trend</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Hot Topics */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Flame className="size-4 text-orange-500" />
              Hot Topics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {hotTopics.length > 0 ? hotTopics.map((topic, i) => (
              <div key={topic.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}</span>
                  <span className="text-sm font-medium capitalize">{topic.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">{topic.document_count} posts</Badge>
                </div>
              </div>
            )) : (
              <p className="text-xs text-muted-foreground text-center py-4">No topics found</p>
            )}
          </CardContent>
        </Card>

        {/* Critical Issues - Swipeable Cards */}
        <Card className="bg-card border-border border-l-4 border-l-red-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-red-500" />
                Critical Issues (Negative Sentiment)
              </div>
              {negativeDocs.length > 0 && (
                <span className="text-xs text-muted-foreground font-normal">
                  {criticalIndex + 1} / {negativeDocs.length}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {negativeDocs.length > 0 ? (
              <div className="relative">
                {/* Current Card */}
                <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-lg min-h-[140px]">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-xs text-muted-foreground capitalize">{negativeDocs[criticalIndex]?.platform}</span>
                    <Badge variant="outline" className="text-xs border-red-300 text-red-600 shrink-0">
                      {((negativeDocs[criticalIndex]?.sentiment || 0) * 100).toFixed(0)}% negative
                    </Badge>
                  </div>
                  <p className="text-sm text-foreground line-clamp-3">
                    {negativeDocs[criticalIndex]?.title || negativeDocs[criticalIndex]?.content?.slice(0, 200) || "No content"}
                  </p>
                  {negativeDocs[criticalIndex]?.author && (
                    <p className="text-xs text-muted-foreground mt-2">
                      By: {negativeDocs[criticalIndex]?.author} {negativeDocs[criticalIndex]?.author_handle ? `(@${negativeDocs[criticalIndex]?.author_handle})` : ""}
                    </p>
                  )}
                  {negativeDocs[criticalIndex]?.topics && negativeDocs[criticalIndex]?.topics.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {negativeDocs[criticalIndex]?.topics.slice(0, 3).map((topic: string, i: number) => (
                        <Badge key={i} variant="secondary" className="text-xs">{topic}</Badge>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Navigation */}
                {negativeDocs.length > 1 && (
                  <div className="flex items-center justify-center gap-4 mt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCriticalIndex(prev => prev > 0 ? prev - 1 : negativeDocs.length - 1)}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    
                    {/* Dots indicator */}
                    <div className="flex gap-1.5">
                      {negativeDocs.slice(0, 5).map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setCriticalIndex(i)}
                          className={`w-2 h-2 rounded-full transition-colors ${
                            i === criticalIndex ? "bg-red-500" : "bg-muted-foreground/30"
                          }`}
                        />
                      ))}
                      {negativeDocs.length > 5 && (
                        <span className="text-xs text-muted-foreground">+{negativeDocs.length - 5}</span>
                      )}
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCriticalIndex(prev => prev < negativeDocs.length - 1 ? prev + 1 : 0)}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-4">No critical issues detected</p>
            )}
          </CardContent>
        </Card>

        {/* Controversial Topics - Topics with mixed reactions */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="size-4 text-amber-500" />
              Controversial Topics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(() => {
              // Find topics that appear in both positive and negative docs
              const topicSentiments: Record<string, { positive: number; negative: number; neutral: number }> = {}
              
              // This would ideally come from API, but we can derive from topics with sentiment_avg near 0
              const controversialTopics = topics
                .filter(t => {
                  const sentiment = t.sentiment_avg ?? 0
                  return Math.abs(sentiment) < 0.3 && t.document_count > 1
                })
                .sort((a, b) => b.document_count - a.document_count)
                .slice(0, 5)
              
              return controversialTopics.length > 0 ? controversialTopics.map((topic) => (
                <div key={topic.name} className="p-2 rounded-lg bg-amber-500/5 border border-amber-500/20">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium capitalize">{topic.name}</span>
                    <Badge variant="outline" className="text-xs border-amber-300 text-amber-600">
                      Mixed reactions
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{topic.document_count} posts</span>
                    <span>•</span>
                    <span>Avg sentiment: {((topic.sentiment_avg ?? 0) * 100).toFixed(0)}%</span>
                  </div>
                </div>
              )) : (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No controversial topics detected
                </p>
              )
            })()}
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Topics with mixed positive/negative reactions
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Entities Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Politicians */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <User className="size-4 text-blue-500" />
              Key Politicians
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {politicians.length > 0 ? politicians.map((entity) => (
              <div key={entity.name} className="flex items-center justify-between py-1">
                <span className="text-sm">{entity.name}</span>
                <Badge variant="secondary" className="text-xs">{entity.mention_count} mentions</Badge>
              </div>
            )) : (
              <p className="text-xs text-muted-foreground text-center py-4">No politicians identified</p>
            )}
          </CardContent>
        </Card>

        {/* Organizations */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Building2 className="size-4 text-purple-500" />
              Organizations & Parties
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {organizations.length > 0 ? organizations.map((entity) => (
              <div key={entity.name} className="flex items-center justify-between py-1">
                <span className="text-sm">{entity.name}</span>
                <Badge variant="secondary" className="text-xs">{entity.mention_count} mentions</Badge>
              </div>
            )) : (
              <p className="text-xs text-muted-foreground text-center py-4">No organizations identified</p>
            )}
          </CardContent>
        </Card>

        {/* Locations */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MapPin className="size-4 text-green-500" />
              Key Locations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {locations.length > 0 ? locations.map((entity) => (
              <div key={entity.name} className="flex items-center justify-between py-1">
                <span className="text-sm">{entity.name}</span>
                <Badge variant="secondary" className="text-xs">{entity.mention_count} mentions</Badge>
              </div>
            )) : (
              <p className="text-xs text-muted-foreground text-center py-4">No locations identified</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Promises Section */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Target className="size-4 text-amber-500" />
            Recent Political Promises
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentPromises.length > 0 ? (
            <div className="space-y-3">
              {recentPromises.map((promise) => (
                <div key={promise.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="flex-1">
                    <p className="text-sm">{promise.text}</p>
                    <div className="flex items-center gap-2 mt-2">
                      {promise.entity && (
                        <Badge variant="outline" className="text-xs">
                          <User className="size-2.5 mr-1" />
                          {promise.entity}
                        </Badge>
                      )}
                      {promise.topic && (
                        <Badge variant="secondary" className="text-xs">{promise.topic}</Badge>
                      )}
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="size-2.5" />
                        {new Date(promise.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                      </span>
                    </div>
                  </div>
                  <Badge 
                    variant="outline" 
                    className={`text-xs shrink-0 ${
                      promise.status === "fulfilled" ? "border-green-200 text-green-600" :
                      promise.status === "broken" ? "border-red-200 text-red-600" :
                      "border-amber-200 text-amber-600"
                    }`}
                  >
                    {promise.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-8">
              No promises extracted yet. Process more documents to identify political promises.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="bg-card border-border border-dashed">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="size-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Need more insights?</p>
                <p className="text-xs text-muted-foreground">Use the Research Assistant to ask specific questions about your data</p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => window.location.href = "/admin/research"}>
              Open Research Assistant
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
