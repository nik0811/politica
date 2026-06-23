"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { apiClient } from "@/lib/api-client"
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts"
import { TrendingUp, Heart, MessageCircle, Share2, Users, BarChart3, Loader2, RefreshCw } from "lucide-react"

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "#e1306c",
  twitter: "#1da1f2",
  facebook: "#1877f2",
}

const SENTIMENT_COLORS = ["#22c55e", "#eab308", "#ef4444"]

export default function AnalyticsPage() {
  const [weeklyData, setWeeklyData] = useState<any[]>([])
  const [trends, setTrends] = useState<any>(null)
  const [engagement, setEngagement] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [processResult, setProcessResult] = useState<string | null>(null)

  async function fetchAll() {
    try {
      setLoading(true)
      const [trendsData, engagementData] = await Promise.all([
        apiClient.getTrends().catch(() => ({ topics: [], sentiment_overview: {} })),
        apiClient.getEngagementStats().catch(() => null),
      ])
      setWeeklyData([])
      setTrends(trendsData)
      setEngagement(engagementData)
    } catch (error) {
      console.error("Failed to fetch analytics:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  async function handleProcessPending() {
    try {
      setProcessing(true)
      setProcessResult(null)
      const result = await apiClient.processDocumentBatch({ document_ids: "pending" })
      setProcessResult(result.message)
      setTimeout(fetchAll, 3000)
    } catch (e: any) {
      setProcessResult(`Error: ${e.message}`)
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const sentimentPieData = engagement?.sentiment_distribution
    ? [
        { name: "Positive", value: engagement.sentiment_distribution.positive },
        { name: "Neutral", value: engagement.sentiment_distribution.neutral },
        { name: "Negative", value: engagement.sentiment_distribution.negative },
      ].filter((d) => d.value > 0)
    : []

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Analytics Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Document trends, engagement analytics, and topic insights
          </p>
        </div>
        <div className="flex items-center gap-2">
          {processResult && (
            <span className="text-xs text-muted-foreground">{processResult}</span>
          )}
          <Button size="sm" variant="outline" onClick={handleProcessPending} disabled={processing} className="h-8 text-xs gap-1.5">
            {processing ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            Process pending
          </Button>
        </div>
      </div>

      {/* Engagement averages */}
      {engagement && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <Heart className="size-8 text-pink-400 shrink-0" />
              <div>
                <p className="text-2xl font-bold text-foreground tabular-nums">
                  {(engagement.averages?.likes_per_post || 0).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Avg likes/post</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <MessageCircle className="size-8 text-blue-400 shrink-0" />
              <div>
                <p className="text-2xl font-bold text-foreground tabular-nums">
                  {(engagement.averages?.comments_per_post || 0).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Avg comments/post</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <Users className="size-8 text-violet-400 shrink-0" />
              <div>
                <p className="text-2xl font-bold text-foreground tabular-nums">
                  {engagement.top_commenters?.length || 0}
                </p>
                <p className="text-xs text-muted-foreground">Unique commenters</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <BarChart3 className="size-8 text-green-400 shrink-0" />
              <div>
                <p className="text-2xl font-bold text-foreground tabular-nums">
                  {engagement.sentiment_distribution?.total_processed || 0}
                </p>
                <p className="text-xs text-muted-foreground">Posts analyzed</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Posting frequency */}
        <Card className="lg:col-span-2 border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Posting Frequency (Last 14 Days)</CardTitle>
            <CardDescription className="text-xs">Number of posts collected per day</CardDescription>
          </CardHeader>
          <CardContent>
            {(engagement?.posting_frequency?.length ?? 0) === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                <p className="text-sm">No data yet.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={engagement.posting_frequency} margin={{ left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.01 264)" />
                  <XAxis dataKey="date" tick={{ fill: "oklch(0.52 0.012 264)", fontSize: 10 }} tickFormatter={(v) => v.slice(5)} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "oklch(0.52 0.012 264)", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "oklch(0.13 0.008 264)", border: "1px solid oklch(0.22 0.01 264)", borderRadius: "8px", color: "oklch(0.93 0.005 264)", fontSize: 12 }} />
                  <Bar dataKey="count" fill="oklch(0.58 0.2 264)" radius={[3, 3, 0, 0]} name="Posts" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Platform breakdown */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Platform Breakdown</CardTitle>
            <CardDescription className="text-xs">Posts per platform</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {(engagement?.platform_breakdown?.length ?? 0) === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">No platform data yet.</div>
            ) : (
              engagement.platform_breakdown.map((p: any) => (
                <div key={p.platform} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-foreground font-medium capitalize">{p.platform}</span>
                    <span className="text-muted-foreground">{p.count} ({p.percentage}%)</span>
                  </div>
                  <Progress
                    value={p.percentage}
                    className="h-1.5 bg-muted"
                    style={{ "--progress-color": PLATFORM_COLORS[p.platform] || "#888" } as any}
                  />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top posts by engagement */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Top Posts by Engagement</CardTitle>
            <CardDescription className="text-xs">Highest likes + comments + shares</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {(engagement?.top_posts?.length ?? 0) === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">No post data yet.</div>
            ) : (
              <div className="divide-y divide-border">
                {engagement.top_posts.slice(0, 8).map((post: any, i: number) => (
                  <div key={post.id} className="flex items-start gap-3 px-4 py-2.5 hover:bg-accent/30 transition-colors">
                    <span className="text-[10px] text-muted-foreground w-4 shrink-0 mt-0.5">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{post.title}</p>
                      <p className="text-[10px] text-muted-foreground capitalize">{post.platform} · {post.author || "unknown"}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-0.5"><Heart className="size-2.5" />{post.likes?.toLocaleString()}</span>
                      <span className="flex items-center gap-0.5"><MessageCircle className="size-2.5" />{post.comments?.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top commenters */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Top Commenters</CardTitle>
            <CardDescription className="text-xs">Most active comment authors</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {(engagement?.top_commenters?.length ?? 0) === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">No commenter data yet.</div>
            ) : (
              <div className="divide-y divide-border">
                {engagement.top_commenters.slice(0, 8).map((c: any, i: number) => (
                  <div key={c.handle} className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/30 transition-colors">
                    <span className="text-[10px] text-muted-foreground w-4 shrink-0">{i + 1}</span>
                    <div className="size-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                      {(c.handle || "?")[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">@{c.handle}</p>
                      {c.name && <p className="text-[10px] text-muted-foreground truncate">{c.name}</p>}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-semibold text-foreground tabular-nums">{c.comment_count}</p>
                      <p className="text-[10px] text-muted-foreground">comments</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Weekly trends chart */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Weekly Collection Trends</CardTitle>
          </CardHeader>
          <CardContent>
            {weeklyData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                <p className="text-sm">No weekly data yet. Process documents to see trends.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={weeklyData}>
                  <defs>
                    <linearGradient id="colorDocs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorPromises" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#82ca9d" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.01 264)" />
                  <XAxis dataKey="week" tick={{ fill: "oklch(0.52 0.012 264)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "oklch(0.52 0.012 264)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "oklch(0.13 0.008 264)", border: "1px solid oklch(0.22 0.01 264)", borderRadius: "8px", color: "oklch(0.93 0.005 264)", fontSize: 12 }} />
                  <Area type="monotone" dataKey="documents" stroke="#8884d8" fillOpacity={1} fill="url(#colorDocs)" name="Documents" />
                  <Area type="monotone" dataKey="promises" stroke="#82ca9d" fillOpacity={1} fill="url(#colorPromises)" name="Promises" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Sentiment distribution pie */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Sentiment Distribution</CardTitle>
            <CardDescription className="text-xs">Across all AI-processed documents</CardDescription>
          </CardHeader>
          <CardContent>
            {sentimentPieData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                <p className="text-sm">No sentiment data yet. Process documents to analyze sentiment.</p>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="60%" height={180}>
                  <PieChart>
                    <Pie data={sentimentPieData} cx="50%" cy="50%" outerRadius={72} dataKey="value" stroke="none">
                      {sentimentPieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={SENTIMENT_COLORS[index]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "oklch(0.13 0.008 264)", border: "1px solid oklch(0.22 0.01 264)", borderRadius: "8px", color: "oklch(0.93 0.005 264)", fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-3">
                  {sentimentPieData.map((entry, i) => (
                    <div key={entry.name} className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full shrink-0" style={{ background: SENTIMENT_COLORS[i] }} />
                      <div>
                        <p className="text-xs font-medium text-foreground">{entry.name}</p>
                        <p className="text-[10px] text-muted-foreground">{entry.value} posts</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Trending topics */}
      {trends?.topics?.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Trending Topics</CardTitle>
            <CardDescription className="text-xs">Extracted from AI-processed posts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {trends.topics.slice(0, 6).map((topic: any, idx: number) => (
                <div key={idx} className="p-3 rounded-lg bg-muted/30 border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground capitalize">{topic.name}</span>
                    <Badge variant="secondary" className="text-[10px]">{topic.engagement} docs</Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">Sentiment:</span>
                    </div>
                    <span className={`font-medium ${topic.sentiment > 0.6 ? "text-green-500" : topic.sentiment > 0.4 ? "text-yellow-500" : "text-red-500"}`}>
                      {topic.sentiment.toFixed(2)}
                    </span>
                  </div>
                  <Progress value={topic.sentiment * 100} className="h-1 mt-2 bg-muted" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
