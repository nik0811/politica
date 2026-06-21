"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollText, Calendar, FileText, ChevronDown, ChevronUp } from "lucide-react"
import { summaries } from "@/lib/mock-data"

const TYPE_STYLE: Record<string, string> = {
  daily: "bg-[var(--chart-1)]/10 text-[var(--chart-1)]",
  weekly: "bg-[var(--chart-5)]/10 text-[var(--chart-5)]",
  topic: "bg-[var(--chart-3)]/10 text-[var(--chart-3)]",
}

export default function SummariesPage() {
  const [expanded, setExpanded] = useState<string | null>(summaries[0].id)
  const [filter, setFilter] = useState("all")

  const filtered = filter === "all" ? summaries : summaries.filter((s) => s.type === filter)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        {["all", "daily", "weekly", "topic"].map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} className="h-8 text-xs capitalize" onClick={() => setFilter(f)}>
            {f}
          </Button>
        ))}
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} summaries</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Summary list */}
        <div className="flex flex-col gap-3 lg:col-span-1">
          {filtered.map((s) => (
            <Card
              key={s.id}
              className={`bg-card border-border cursor-pointer transition-colors ${expanded === s.id ? "border-primary/40" : "hover:border-border"}`}
              onClick={() => setExpanded(expanded === s.id ? null : s.id)}
            >
              <CardContent className="p-4 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${TYPE_STYLE[s.type]}`}>{s.type}</span>
                  <span className="text-[10px] text-muted-foreground">{new Date(s.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
                </div>
                <p className="text-sm font-medium text-foreground leading-snug">{s.title}</p>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><FileText className="size-3" />{s.wordCount} words</span>
                  <span className="flex items-center gap-1"><Badge className="size-1.5 rounded-full p-0 bg-[var(--chart-3)]" />{s.status}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Detail view */}
        <div className="lg:col-span-2">
          {expanded ? (() => {
            const s = summaries.find((x) => x.id === expanded)
            if (!s) return null
            return (
              <Card className="bg-card border-border h-full">
                <CardHeader className="border-b border-border pb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${TYPE_STYLE[s.type]}`}>{s.type}</span>
                    <Badge variant="secondary" className="text-[10px]">{s.status}</Badge>
                  </div>
                  <CardTitle className="text-base font-semibold">{s.title}</CardTitle>
                  <CardDescription className="text-xs">
                    {new Date(s.date).toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} · {s.wordCount} words
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5 flex flex-col gap-5">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium mb-3">Topics Covered</p>
                    <div className="flex flex-wrap gap-1.5">
                      {s.topics.map((t) => (
                        <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium mb-3">Key Insights</p>
                    <div className="flex flex-col gap-2">
                      {s.keyInsights.map((insight, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 bg-muted/40 rounded-lg">
                          <span className="size-5 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center text-[10px] font-bold text-primary shrink-0 mt-0.5">
                            {i + 1}
                          </span>
                          <p className="text-sm text-foreground leading-relaxed">{insight}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button size="sm" className="h-8 text-xs">Download PDF</Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs">Copy Markdown</Button>
                  </div>
                </CardContent>
              </Card>
            )
          })() : (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
              <ScrollText className="size-10 opacity-20" />
              <p className="text-sm">Select a summary to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
