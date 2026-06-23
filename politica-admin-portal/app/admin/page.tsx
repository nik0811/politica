"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  MessageSquare,
  Flame,
  AlertTriangle,
  Smile,
  Meh,
  Frown,
  ExternalLink,
  Loader2,
} from "lucide-react"
import { apiClient } from "@/lib/api-client"

// ─── Types ───────────────────────────────────────────────────────────────────

interface SentimentOverview {
  overall: number
  distribution: { positive: number; neutral: number; negative: number }
  counts: { positive: number; neutral: number; negative: number; total: number }
  trend: "up" | "down" | "stable"
}

interface TopCommenter {
  handle: string
  name: string | null
  comment_count: number
  total_likes: number
  platform?: string
}

interface TopicEngagement {
  topic: string
  doc_count: number
  total_engagement: number
  avg_sentiment: number
  sentiment_label: "positive" | "neutral" | "negative"
  top_post_title: string | null
  top_post_snippet: string | null
  top_post_platform: string | null
  top_post_engagement: number
}

interface WeeklyTrend {
  week: string
  week_start: string
  documents: number
  avg_sentiment: number
  sentiment_label: "positive" | "neutral" | "negative"
}

interface SentimentSegmentation {
  pro_government: { count: number; percentage: number }
  against_government: { count: number; percentage: number }
  neutral: { count: number; percentage: number }
  total_comments: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sentimentColor(score: number): string {
  if (score >= 0.6) return "text-emerald-400"
  if (score >= 0.4) return "text-amber-400"
  return "text-rose-400"
}

function sentimentBg(score: number): string {
  if (score >= 0.6) return "bg-emerald-500/10 border-emerald-500/20"
  if (score >= 0.4) return "bg-amber-500/10 border-amber-500/20"
  return "bg-rose-500/10 border-rose-500/20"
}

function sentimentLabel(score: number): string {
  if (score >= 0.6) return "Positive"
  if (score >= 0.4) return "Neutral"
  return "Negative"
}

function SentimentIcon({ score, className }: { score: number; className?: string }) {
  if (score >= 0.6) return <Smile className={className} />
  if (score >= 0.4) return <Meh className={className} />
  return <Frown className={className} />
}

function engagementLabel(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

// ─── Sentiment Gauge ─────────────────────────────────────────────────────────

function SentimentGauge({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const color = score >= 0.6 ? "#34d399" : score >= 0.4 ? "#fbbf24" : "#f87171"
  const r = 56
  const circ = 2 * Math.PI * r
  const arc = circ * 0.75 // 270° arc
  const filled = arc * score
  const rotation = -225 // start at bottom-left

  return (
    <div className="flex flex-col items-center justify-center gap-1">
      <div className="relative size-36">
        <svg className="size-full -rotate-90" viewBox="0 0 140 140">
          {/* Track */}
          <circle
            cx="70" cy="70" r={r}
            fill="none"
            stroke="oklch(0.22 0.01 264)"
            strokeWidth="12"
            strokeDasharray={`${arc} ${circ}`}
            strokeDashoffset={0}
            strokeLinecap="round"
            style={{ transform: `rotate(${rotation}deg)`, transformOrigin: "70px 70px" }}
          />
          {/* Fill */}
          <circle
            cx="70" cy="70" r={r}
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeDasharray={`${filled} ${circ}`}
            strokeDashoffset={0}
            strokeLinecap="round"
            style={{ transform: `rotate(${rotation}deg)`, transformOrigin: "70px 70px" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold tabular-nums" style={{ color }}>{pct}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest">/ 100</span>
        </div>
      </div>
      <span className={`text-sm font-semibold ${sentimentColor(score)}`}>{sentimentLabel(score)} Sentiment</span>
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [sentiment, setSentiment] = useState<SentimentOverview | null>(null)
  const [commenters, setCommenters] = useState<TopCommenter[]>([])
  const [topics, setTopics] = useState<TopicEngagement[]>([])
  const [weeklyTrends, setWeeklyTrends] = useState<WeeklyTrend[]>([])
  const [segmentation, setSegmentation] = useState<SentimentSegmentation | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  
  // Date range filter
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const dateParams = {
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      }
      
      const [engagementData, topicsData, weeklyData, segmentationData] = await Promise.all([
        apiClient.getEngagementStats(dateParams).catch(() => null),
        apiClient.getTopicsEngagement().catch(() => ({ topics: [] })),
        apiClient.getWeeklyTrends().catch(() => ({ weekly_trends: [] })),
        apiClient.getSentimentSegmentation().catch(() => null),
      ])

      if (engagementData) {
        const { sentiment_distribution: sd, top_commenters } = engagementData
        const total = sd.total_processed || 1
        
        // Calculate sentiment score based on distribution percentages
        // Positive = 100, Neutral = 50, Negative = 0
        // Score = weighted average based on actual percentages
        const positivePct = sd.positive / total
        const neutralPct = sd.neutral / total
        const negativePct = sd.negative / total
        
        const overall = sd.total_processed > 0
          ? (positivePct * 1.0) + (neutralPct * 0.5) + (negativePct * 0.0)
          : 0.5

        setSentiment({
          overall: Math.round(overall * 100) / 100,
          distribution: {
            positive: Math.round(positivePct * 100),
            neutral: Math.round(neutralPct * 100),
            negative: Math.round(negativePct * 100),
          },
          counts: {
            positive: sd.positive,
            neutral: sd.neutral,
            negative: sd.negative,
            total: sd.total_processed,
          },
          trend: overall >= 0.55 ? "up" : overall <= 0.45 ? "down" : "stable",
        })
        setCommenters(top_commenters.slice(0, 8))
      }

      setTopics(topicsData.topics || [])
      setWeeklyTrends(weeklyData.weekly_trends || [])
      setSegmentation(segmentationData)
      setLastUpdated(new Date())
    } catch {
      // silently fail — already handled per-call above
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [startDate, endDate])

  useEffect(() => { load() }, [load])

  // Topics needing attention: high engagement + negative sentiment
  const actionableTopics = topics
    .filter((t) => t.avg_sentiment < 0.4 && t.total_engagement > 0)
    .sort((a, b) => b.total_engagement - a.total_engagement)

  // Topics sorted by engagement for the "care about" section
  const topTopics = [...topics].sort((a, b) => b.total_engagement - a.total_engagement).slice(0, 8)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8 pb-10">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Intelligence Briefing</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Public sentiment, top voices, and the issues that matter most
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {/* Date Range Filter */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-7 text-xs px-2 rounded border border-border bg-input text-foreground"
              placeholder="Start date"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-7 text-xs px-2 rounded border border-border bg-input text-foreground"
              placeholder="End date"
            />
            {(startDate || endDate) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs px-2"
                onClick={() => { setStartDate(""); setEndDate(""); }}
              >
                Clear
              </Button>
            )}
          </div>
          {lastUpdated && (
            <span className="text-[10px] text-muted-foreground hidden sm:block">
              Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => load(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`size-3 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Section 1: Public Sentiment Overview ─────────────────────────────── */}
      <section>
        <SectionLabel icon={<Smile className="size-3.5" />} title="Public Sentiment Overview" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
          {/* Gauge */}
          <Card className="bg-card border-border flex items-center justify-center py-6">
            <CardContent className="p-0">
              {sentiment ? (
                <SentimentGauge score={sentiment.overall} />
              ) : (
                <EmptyState message="No sentiment data yet" />
              )}
            </CardContent>
          </Card>

          {/* Distribution breakdown */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Sentiment Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 flex flex-col gap-3">
              {sentiment ? (
                <>
                  <SentimentBar
                    label="Positive"
                    pct={sentiment.distribution.positive}
                    count={sentiment.counts.positive}
                    color="bg-emerald-500"
                    textColor="text-emerald-400"
                  />
                  <SentimentBar
                    label="Neutral"
                    pct={sentiment.distribution.neutral}
                    count={sentiment.counts.neutral}
                    color="bg-amber-500"
                    textColor="text-amber-400"
                  />
                  <SentimentBar
                    label="Negative"
                    pct={sentiment.distribution.negative}
                    count={sentiment.counts.negative}
                    color="bg-rose-500"
                    textColor="text-rose-400"
                  />
                  <p className="text-[10px] text-muted-foreground pt-1 border-t border-border">
                    {(sentiment.counts.total || 0).toLocaleString()} documents analysed
                  </p>
                </>
              ) : (
                <EmptyState message="No data" />
              )}
            </CardContent>
          </Card>

          {/* Trend card */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Trend Signal
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 flex flex-col items-center justify-center gap-3 h-[calc(100%-56px)]">
              {sentiment ? (
                <>
                  {sentiment.trend === "up" && <TrendingUp className="size-10 text-emerald-400" />}
                  {sentiment.trend === "down" && <TrendingDown className="size-10 text-rose-400" />}
                  {sentiment.trend === "stable" && <Minus className="size-10 text-amber-400" />}
                  <div className="text-center">
                    <p className={`text-base font-semibold capitalize ${
                      sentiment.trend === "up" ? "text-emerald-400" :
                      sentiment.trend === "down" ? "text-rose-400" : "text-amber-400"
                    }`}>
                      {sentiment.trend === "up" ? "Improving" : sentiment.trend === "down" ? "Declining" : "Stable"}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Overall public mood is {sentiment.trend === "stable" ? "holding steady" : `trending ${sentiment.trend === "up" ? "more positive" : "more negative"}`}
                    </p>
                  </div>
                </>
              ) : (
                <EmptyState message="No trend data" />
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ── Section 1b: Pro/Anti-Government Segmentation ────────────────────────── */}
      {segmentation && (
        <section>
          <SectionLabel icon={<Flame className="size-3.5" />} title="Government Sentiment Segmentation" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
            <Card className="bg-emerald-500/5 border-emerald-500/20">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-xs font-medium text-emerald-400 uppercase tracking-wider">
                  Pro-Government
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 flex flex-col gap-2">
                <p className="text-2xl font-bold text-emerald-400">{segmentation.pro_government.percentage}%</p>
                <p className="text-xs text-muted-foreground">{segmentation.pro_government.count.toLocaleString()} comments</p>
              </CardContent>
            </Card>

            <Card className="bg-rose-500/5 border-rose-500/20">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-xs font-medium text-rose-400 uppercase tracking-wider">
                  Against Government
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 flex flex-col gap-2">
                <p className="text-2xl font-bold text-rose-400">{segmentation.against_government.percentage}%</p>
                <p className="text-xs text-muted-foreground">{segmentation.against_government.count.toLocaleString()} comments</p>
              </CardContent>
            </Card>

            <Card className="bg-amber-500/5 border-amber-500/20">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-xs font-medium text-amber-400 uppercase tracking-wider">
                  Neutral
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 flex flex-col gap-2">
                <p className="text-2xl font-bold text-amber-400">{segmentation.neutral.percentage}%</p>
                <p className="text-xs text-muted-foreground">{segmentation.neutral.count.toLocaleString()} comments</p>
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      {/* ── Section 2: Top Commenters ─────────────────────────────────────────── */}
      <section>
        <SectionLabel icon={<MessageSquare className="size-3.5" />} title="Most Vocal Citizens" />
        <Card className="bg-card border-border mt-3">
          <CardContent className="p-0">
            {commenters.length === 0 ? (
              <div className="py-10 text-center">
                <EmptyState message="No comment data yet. Collect posts with comments to see top voices." />
              </div>
            ) : (
              <div className="divide-y divide-border">
                {commenters.map((c, i) => (
                  <div
                    key={c.handle}
                    className="flex items-center gap-4 px-5 py-3 hover:bg-accent/30 transition-colors"
                  >
                    <span className="text-[11px] font-mono text-muted-foreground w-5 text-right shrink-0">
                      {i + 1}
                    </span>
                    <div className="size-8 rounded-full bg-accent flex items-center justify-center shrink-0">
                      <span className="text-xs font-semibold text-foreground uppercase">
                        {(c.handle || c.name || "?")[0]}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        @{c.handle || c.name || "unknown"}
                      </p>
                      {c.name && c.name !== c.handle && (
                        <p className="text-[11px] text-muted-foreground truncate">{c.name}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right hidden sm:block">
                        <p className="text-sm font-semibold text-foreground tabular-nums">
                          {c.comment_count.toLocaleString()}
                        </p>
                        <p className="text-[10px] text-muted-foreground">comments</p>
                      </div>
                      {c.total_likes > 0 && (
                        <div className="text-right hidden md:block">
                          <p className="text-sm font-semibold text-foreground tabular-nums">
                            {engagementLabel(c.total_likes)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">likes earned</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ── Section 3: Topics People Care About ───────────────────────────────── */}
      <section>
        <SectionLabel icon={<Flame className="size-3.5" />} title="Topics People Care About Most" />
        {topTopics.length === 0 ? (
          <Card className="bg-card border-border mt-3">
            <CardContent className="py-10 text-center">
              <EmptyState message="No topic engagement data yet. Process documents to see trending topics." />
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
            {topTopics.map((t) => (
              <Card key={t.topic} className={`border ${sentimentBg(t.avg_sentiment)} hover:bg-accent/30 transition-colors`}>
                <CardHeader className="pb-1 pt-4 px-4">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm font-semibold text-foreground leading-tight">
                      {t.topic}
                    </CardTitle>
                    <SentimentIcon
                      score={t.avg_sentiment}
                      className={`size-4 shrink-0 mt-0.5 ${sentimentColor(t.avg_sentiment)}`}
                    />
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <Stat label="posts" value={t.doc_count.toLocaleString()} />
                    <Stat label="engagement" value={engagementLabel(t.total_engagement)} highlight />
                  </div>
                  {t.top_post_snippet && (
                    <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2 mt-1">
                      "{t.top_post_snippet}"
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-1">
                    {t.top_post_platform && (
                      <Badge variant="secondary" className="text-[10px] h-4 capitalize">
                        {t.top_post_platform}
                      </Badge>
                    )}
                    <span className={`text-[10px] font-medium ml-auto ${sentimentColor(t.avg_sentiment)}`}>
                      {sentimentLabel(t.avg_sentiment)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ── Section 4: Raise Your Voice — Actionable Topics ───────────────────── */}
      <section>
        <SectionLabel
          icon={<AlertTriangle className="size-3.5 text-rose-400" />}
          title="Raise Your Voice — Areas Needing Attention"
          subtitle="High engagement + negative public sentiment"
        />
        {actionableTopics.length === 0 ? (
          <Card className="bg-card border-border mt-3">
            <CardContent className="py-10 text-center">
              <EmptyState message="No high-concern areas detected. Either sentiment is positive or data is still loading." />
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-3 mt-3">
            {actionableTopics.map((t) => (
              <Card
                key={t.topic}
                className="border border-rose-500/25 bg-rose-500/5 hover:bg-rose-500/10 transition-colors"
              >
                <CardContent className="px-5 py-4">
                  <div className="flex items-start gap-4 flex-wrap sm:flex-nowrap">
                    <AlertTriangle className="size-5 text-rose-400 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-foreground">{t.topic}</h3>
                        <Badge variant="destructive" className="text-[10px] h-4">
                          Avg. sentiment {Math.round(t.avg_sentiment * 100)}
                        </Badge>
                      </div>
                      {t.top_post_title && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          Strongest post: <span className="text-foreground/80">{t.top_post_title}</span>
                        </p>
                      )}
                      {t.top_post_snippet && (
                        <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                          "{t.top_post_snippet}"
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-4 shrink-0 ml-auto">
                      <div className="text-right hidden sm:block">
                        <p className="text-sm font-bold text-foreground tabular-nums">
                          {engagementLabel(t.total_engagement)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">total engagement</p>
                      </div>
                      <Link href={`/admin/topics?topic=${encodeURIComponent(t.topic)}`}>
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 border-rose-500/30 text-rose-400 hover:bg-rose-500/10">
                          View evidence
                          <ExternalLink className="size-3" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ── Section 5: Weekly Collection Trends ────────────────────────────────── */}
      <section>
        <SectionLabel icon={<TrendingUp className="size-3.5" />} title="Weekly Collection Trends" />
        {weeklyTrends.length === 0 ? (
          <Card className="bg-card border-border mt-3">
            <CardContent className="py-10 text-center">
              <EmptyState message="No weekly trend data yet. Collect documents to see trends." />
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-card border-border mt-3">
            <CardContent className="p-5">
              <div className="space-y-3">
                {weeklyTrends.map((week, idx) => (
                  <div key={idx} className="flex items-center gap-4 pb-3 border-b border-border last:border-0 last:pb-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{week.week}</p>
                      <p className="text-xs text-muted-foreground">{week.documents} documents collected</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className={`text-sm font-semibold ${sentimentColor(week.avg_sentiment)}`}>
                          {sentimentLabel(week.avg_sentiment)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{week.avg_sentiment.toFixed(2)}</p>
                      </div>
                      <SentimentIcon
                        score={week.avg_sentiment}
                        className={`size-5 ${sentimentColor(week.avg_sentiment)}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode
  title: string
  subtitle?: string
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-sm font-semibold text-foreground">{title}</span>
      {subtitle && (
        <span className="text-[11px] text-muted-foreground hidden sm:block">— {subtitle}</span>
      )}
    </div>
  )
}

function SentimentBar({
  label,
  pct,
  count,
  color,
  textColor,
}: {
  label: string
  pct: number
  count: number
  color: string
  textColor: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className={`font-medium ${textColor}`}>{label}</span>
        <span className="text-muted-foreground tabular-nums">{pct}% · {count.toLocaleString()}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-accent overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className={`text-sm font-bold tabular-nums ${highlight ? "text-foreground" : "text-muted-foreground"}`}>
        {value}
      </p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="text-xs text-muted-foreground text-center px-4">{message}</p>
  )
}
