"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  AlertCircle,
  Loader2,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Zap,
  CheckCircle2,
  XCircle,
  Eye,
  MessageCircle,
  Share2,
  Heart,
  Lightbulb,
  Target,
  Brain,
} from "lucide-react"
import { apiClient } from "@/lib/api-client"

interface SentimentBreakdown {
  positive: number
  neutral: number
  negative: number
}

interface EngagementMetrics {
  total_posts: number
  total_comments: number
  total_shares: number
  total_views: number
  average_engagement_rate: number
}

interface Recommendation {
  id: string
  topic_name: string
  importance_score: number
  suggested_action: string
  reasoning: string
  sentiment_breakdown: SentimentBreakdown
  engagement_metrics: EngagementMetrics
  key_entities: string[]
  related_promises: string[]
  created_at: string
  user_feedback?: string
}

interface TopicAnalysis {
  topic_name: string
  document_count: number
  average_sentiment: number
  sentiment_breakdown: SentimentBreakdown
  engagement_metrics: EngagementMetrics
  trend: string
  momentum: string
}

interface AnalysisResponse {
  timestamp: string
  total_documents: number
  topics_analyzed: number
  sentiment_overview: {
    overall: number
    distribution: {
      positive: number
      neutral: number
      negative: number
    }
  }
  top_topics: TopicAnalysis[]
  recommendations: Recommendation[]
}

interface LearningInsight {
  insight_type: string
  description: string
  confidence: number
  created_at: string
}

const ACTION_COLORS: Record<string, string> = {
  "Raise Your Voice": "bg-red-500/10 text-red-700 border-red-200",
  "Monitor": "bg-yellow-500/10 text-yellow-700 border-yellow-200",
  "Investigate": "bg-blue-500/10 text-blue-700 border-blue-200",
}

const ACTION_ICONS: Record<string, React.ElementType> = {
  "Raise Your Voice": Zap,
  "Monitor": Eye,
  "Investigate": AlertCircle,
}

function SentimentBadge({ sentiment }: { sentiment: number }) {
  if (sentiment > 0.2) {
    return <Badge className="bg-green-500/10 text-green-700 border-green-200">Positive</Badge>
  }
  if (sentiment < -0.2) {
    return <Badge className="bg-red-500/10 text-red-700 border-red-200">Negative</Badge>
  }
  return <Badge className="bg-gray-500/10 text-gray-700 border-gray-200">Neutral</Badge>
}

function TrendBadge({ trend }: { trend: string }) {
  const isRising = trend === "rising"
  const Icon = isRising ? TrendingUp : trend === "declining" ? TrendingDown : Eye
  const color = isRising ? "text-green-600" : trend === "declining" ? "text-red-600" : "text-gray-600"
  
  return (
    <div className={`flex items-center gap-1 text-xs font-medium ${color}`}>
      <Icon className="size-3" />
      {trend.charAt(0).toUpperCase() + trend.slice(1)}
    </div>
  )
}

function RecommendationCard({ rec, onFeedback }: { rec: Recommendation; onFeedback: (id: string, feedback: string) => void }) {
  const ActionIcon = ACTION_ICONS[rec.suggested_action] || Eye
  const total_sentiment = rec.sentiment_breakdown.positive + rec.sentiment_breakdown.neutral + rec.sentiment_breakdown.negative
  const negative_ratio = total_sentiment > 0 ? (rec.sentiment_breakdown.negative / total_sentiment) * 100 : 0

  return (
    <Card className="border-border bg-card hover:bg-card/80 transition-colors">
      <CardContent className="p-4 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">{rec.topic_name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{rec.reasoning}</p>
          </div>
          <div className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border shrink-0 ${ACTION_COLORS[rec.suggested_action]}`}>
            <ActionIcon className="size-3.5" />
            <span className="text-xs font-medium">{rec.suggested_action}</span>
          </div>
        </div>

        {/* Importance Score */}
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-foreground">Importance</span>
              <span className="text-xs font-semibold text-foreground">{rec.importance_score.toFixed(0)}/100</span>
            </div>
            <Progress value={rec.importance_score} className="h-1.5" />
          </div>
        </div>

        {/* Sentiment Breakdown */}
        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col items-center gap-1 rounded-lg bg-muted/50 p-2">
            <span className="text-xs font-semibold text-green-600">{rec.sentiment_breakdown.positive}</span>
            <span className="text-[10px] text-muted-foreground">Positive</span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-lg bg-muted/50 p-2">
            <span className="text-xs font-semibold text-gray-600">{rec.sentiment_breakdown.neutral}</span>
            <span className="text-[10px] text-muted-foreground">Neutral</span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-lg bg-muted/50 p-2">
            <span className="text-xs font-semibold text-red-600">{rec.sentiment_breakdown.negative}</span>
            <span className="text-[10px] text-muted-foreground">Negative</span>
          </div>
        </div>

        {/* Engagement Metrics */}
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="flex flex-col items-center gap-1">
            <Heart className="size-3.5 text-pink-500" />
            <span className="text-xs font-semibold">{rec.engagement_metrics.total_posts}</span>
            <span className="text-[9px] text-muted-foreground">Posts</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <MessageCircle className="size-3.5 text-blue-500" />
            <span className="text-xs font-semibold">{rec.engagement_metrics.total_comments}</span>
            <span className="text-[9px] text-muted-foreground">Comments</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Share2 className="size-3.5 text-purple-500" />
            <span className="text-xs font-semibold">{rec.engagement_metrics.total_shares}</span>
            <span className="text-[9px] text-muted-foreground">Shares</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Eye className="size-3.5 text-orange-500" />
            <span className="text-xs font-semibold">{(rec.engagement_metrics.average_engagement_rate * 100).toFixed(1)}%</span>
            <span className="text-[9px] text-muted-foreground">Engagement</span>
          </div>
        </div>

        {/* Key Entities */}
        {rec.key_entities.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground">Key Entities</span>
            <div className="flex flex-wrap gap-1.5">
              {rec.key_entities.map((entity) => (
                <Badge key={entity} variant="secondary" className="text-xs">
                  {entity}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Related Promises */}
        {rec.related_promises.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground">Related Promises</span>
            <div className="flex flex-col gap-1">
              {rec.related_promises.slice(0, 2).map((promise, idx) => (
                <p key={idx} className="text-xs text-muted-foreground line-clamp-1">
                  • {promise}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Feedback Buttons */}
        <div className="flex gap-2 pt-2 border-t border-border">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-7 text-xs gap-1.5"
            onClick={() => onFeedback(rec.id, "accepted")}
            disabled={rec.user_feedback === "accepted"}
          >
            <CheckCircle2 className="size-3" />
            Accept
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-7 text-xs gap-1.5"
            onClick={() => onFeedback(rec.id, "rejected")}
            disabled={rec.user_feedback === "rejected"}
          >
            <XCircle className="size-3" />
            Reject
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function AssistantPage() {
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null)
  const [insights, setInsights] = useState<LearningInsight[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [feedback, setFeedback] = useState<Record<string, string>>({})

  async function fetchAnalysis() {
    try {
      setRefreshing(true)
      const data = await apiClient.analyzeData()
      setAnalysis(data)
    } catch (error) {
      console.error("Failed to fetch analysis:", error)
    } finally {
      setRefreshing(false)
    }
  }

  async function fetchInsights() {
    try {
      const data = await apiClient.getLearningInsights()
      setInsights(data)
    } catch (error) {
      console.error("Failed to fetch insights:", error)
    }
  }

  async function handleFeedback(recommendationId: string, feedbackType: string) {
    try {
      await apiClient.submitRecommendationFeedback({
        recommendation_id: recommendationId,
        feedback: feedbackType,
      })
      
      setFeedback((prev) => ({
        ...prev,
        [recommendationId]: feedbackType,
      }))
    } catch (error) {
      console.error("Failed to submit feedback:", error)
    }
  }

  useEffect(() => {
    async function init() {
      try {
        setLoading(true)
        await Promise.all([fetchAnalysis(), fetchInsights()])
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

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
            AI Assistant
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Intelligent analysis and recommendations based on your data
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={fetchAnalysis}
          disabled={refreshing}
          className="h-8 text-xs gap-1.5"
        >
          {refreshing ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          Refresh Analysis
        </Button>
      </div>

      {/* Overview Stats */}
      {analysis && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex items-center justify-center size-10 rounded-lg bg-primary/10">
                <FileText className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{analysis.total_documents}</p>
                <p className="text-xs text-muted-foreground">Documents Analyzed</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex items-center justify-center size-10 rounded-lg bg-blue-500/10">
                <Target className="size-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{analysis.topics_analyzed}</p>
                <p className="text-xs text-muted-foreground">Topics Analyzed</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex items-center justify-center size-10 rounded-lg bg-green-500/10">
                <TrendingUp className="size-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{analysis.sentiment_overview?.distribution?.positive ?? 0}%</p>
                <p className="text-xs text-muted-foreground">Positive Sentiment</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex items-center justify-center size-10 rounded-lg bg-red-500/10">
                <AlertCircle className="size-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{analysis.sentiment_overview?.distribution?.negative ?? 0}%</p>
                <p className="text-xs text-muted-foreground">Negative Sentiment</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="recommendations" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="topics">Topics Analysis</TabsTrigger>
          <TabsTrigger value="insights">Learning Insights</TabsTrigger>
        </TabsList>

        {/* Recommendations Tab */}
        <TabsContent value="recommendations" className="space-y-4">
          {analysis && analysis.recommendations.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {analysis.recommendations.map((rec) => (
                <RecommendationCard
                  key={rec.id}
                  rec={{ ...rec, user_feedback: feedback[rec.id] }}
                  onFeedback={handleFeedback}
                />
              ))}
            </div>
          ) : (
            <Card className="bg-card border-border">
              <CardContent className="p-8 text-center">
                <AlertCircle className="size-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No recommendations available yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Process more documents to generate recommendations.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Topics Analysis Tab */}
        <TabsContent value="topics" className="space-y-4">
          {analysis && analysis.top_topics.length > 0 ? (
            <div className="space-y-3">
              {analysis.top_topics.map((topic) => (
                <Card key={topic.topic_name} className="bg-card border-border">
                  <CardContent className="p-4 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate">{topic.topic_name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <SentimentBadge sentiment={topic.average_sentiment} />
                          <TrendBadge trend={topic.trend} />
                          <span className="text-xs text-muted-foreground">
                            {topic.document_count} posts
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="flex flex-col items-center gap-1 rounded-lg bg-muted/50 p-2">
                        <span className="text-xs font-semibold text-green-600">{topic.sentiment_breakdown.positive}</span>
                        <span className="text-[10px] text-muted-foreground">Positive</span>
                      </div>
                      <div className="flex flex-col items-center gap-1 rounded-lg bg-muted/50 p-2">
                        <span className="text-xs font-semibold text-gray-600">{topic.sentiment_breakdown.neutral}</span>
                        <span className="text-[10px] text-muted-foreground">Neutral</span>
                      </div>
                      <div className="flex flex-col items-center gap-1 rounded-lg bg-muted/50 p-2">
                        <span className="text-xs font-semibold text-red-600">{topic.sentiment_breakdown.negative}</span>
                        <span className="text-[10px] text-muted-foreground">Negative</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-center text-xs">
                      <div>
                        <p className="font-semibold">{topic.engagement_metrics.total_posts}</p>
                        <p className="text-muted-foreground">Posts</p>
                      </div>
                      <div>
                        <p className="font-semibold">{topic.engagement_metrics.total_comments}</p>
                        <p className="text-muted-foreground">Comments</p>
                      </div>
                      <div>
                        <p className="font-semibold">{topic.engagement_metrics.total_shares}</p>
                        <p className="text-muted-foreground">Shares</p>
                      </div>
                      <div>
                        <p className="font-semibold">{(topic.engagement_metrics.average_engagement_rate * 100).toFixed(1)}%</p>
                        <p className="text-muted-foreground">Engagement</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="bg-card border-border">
              <CardContent className="p-8 text-center">
                <AlertCircle className="size-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No topics analyzed yet.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Learning Insights Tab */}
        <TabsContent value="insights" className="space-y-4">
          {insights.length > 0 ? (
            <div className="space-y-3">
              {insights.map((insight, idx) => (
                <Card key={idx} className="bg-card border-border">
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className="flex items-center justify-center size-8 rounded-lg bg-primary/10 shrink-0 mt-0.5">
                      <Lightbulb className="size-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-foreground text-sm">{insight.insight_type}</p>
                        <Badge variant="secondary" className="text-xs">
                          {(insight.confidence * 100).toFixed(0)}% confidence
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{insight.description}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="bg-card border-border">
              <CardContent className="p-8 text-center">
                <Lightbulb className="size-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No insights available yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Insights will appear as the assistant learns from your data.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Import missing icon
import { FileText } from "lucide-react"
