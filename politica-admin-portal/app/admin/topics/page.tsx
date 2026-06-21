"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from "recharts"
import { TrendingUp, TrendingDown, FileText } from "lucide-react"
import { topics } from "@/lib/mock-data"

const COLOR_MAP: Record<string, string> = {
  blue: "bg-[var(--chart-1)]/10 text-[var(--chart-1)] border-[var(--chart-1)]/20",
  green: "bg-[var(--chart-3)]/10 text-[var(--chart-3)] border-[var(--chart-3)]/20",
  orange: "bg-[var(--chart-4)]/10 text-[var(--chart-4)] border-[var(--chart-4)]/20",
  red: "bg-destructive/10 text-destructive border-destructive/20",
  yellow: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  purple: "bg-[var(--chart-5)]/10 text-[var(--chart-5)] border-[var(--chart-5)]/20",
  pink: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  cyan: "bg-[var(--chart-2)]/10 text-[var(--chart-2)] border-[var(--chart-2)]/20",
}

const radarData = topics.map((t) => ({ topic: t.name, Documents: t.documents, Sentiment: Math.round(t.sentiment * 1000) }))

export default function TopicsPage() {
  const maxDocs = Math.max(...topics.map((t) => t.documents))

  return (
    <div className="flex flex-col gap-6">
      {/* Topic cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {topics.map((topic) => {
          const isUp = topic.trend.startsWith("+")
          return (
            <Card key={topic.id} className="bg-card border-border hover:border-primary/30 transition-colors cursor-pointer">
              <CardContent className="p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{topic.name}</p>
                    {topic.parent && <p className="text-[10px] text-muted-foreground">sub: {topic.parent}</p>}
                  </div>
                  <span className={`text-xs font-medium flex items-center gap-0.5 ${isUp ? "text-[var(--chart-3)]" : "text-destructive"}`}>
                    {isUp ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                    {topic.trend}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <FileText className="size-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xl font-bold text-foreground tabular-nums">{topic.documents.toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground">docs</span>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">Doc volume</span>
                    <span className="text-muted-foreground">{Math.round((topic.documents / maxDocs) * 100)}%</span>
                  </div>
                  <Progress value={(topic.documents / maxDocs) * 100} className="h-1.5 bg-muted" />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">Avg sentiment</span>
                    <span className={`font-medium ${topic.sentiment > 0.5 ? "text-[var(--chart-3)]" : topic.sentiment > 0.3 ? "text-[var(--chart-4)]" : "text-destructive"}`}>
                      {topic.sentiment.toFixed(2)}
                    </span>
                  </div>
                  <Progress value={topic.sentiment * 100} className="h-1.5 bg-muted" />
                </div>

                <div>
                  <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">Top Entities</p>
                  <div className="flex flex-wrap gap-1">
                    {topic.topEntities.slice(0, 2).map((e) => (
                      <Badge key={e} variant="secondary" className="text-[10px] h-4 px-1.5 truncate max-w-full">{e}</Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Radar chart */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Topic Coverage Radar</CardTitle>
            <CardDescription className="text-xs">Document volume across all topics</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                <PolarGrid stroke="oklch(0.22 0.01 264)" />
                <PolarAngleAxis dataKey="topic" tick={{ fill: "oklch(0.52 0.012 264)", fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "oklch(0.13 0.008 264)", border: "1px solid oklch(0.22 0.01 264)", borderRadius: "8px", color: "oklch(0.93 0.005 264)", fontSize: 12 }} />
                <Radar name="Documents" dataKey="Documents" stroke="oklch(0.58 0.2 264)" fill="oklch(0.58 0.2 264)" fillOpacity={0.2} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Topic table */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Topic Summary</CardTitle>
            <CardDescription className="text-xs">All topics ranked by activity</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  {["Topic", "Docs", "Sentiment", "Trend"].map((h) => (
                    <th key={h} className="text-left text-muted-foreground font-medium px-4 py-2.5 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...topics].sort((a, b) => b.documents - a.documents).map((t) => {
                  const isUp = t.trend.startsWith("+")
                  return (
                    <tr key={t.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`size-2 rounded-full bg-current ${COLOR_MAP[t.color]?.split(" ")[1]}`} />
                          <span className="font-medium text-foreground">{t.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-foreground font-medium">{t.documents.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`font-medium ${t.sentiment > 0.5 ? "text-[var(--chart-3)]" : t.sentiment > 0.3 ? "text-[var(--chart-4)]" : "text-destructive"}`}>
                          {t.sentiment.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`flex items-center gap-0.5 font-medium ${isUp ? "text-[var(--chart-3)]" : "text-destructive"}`}>
                          {isUp ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                          {t.trend}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
