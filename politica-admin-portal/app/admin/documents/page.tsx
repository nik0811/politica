"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search, CheckCircle2, AlertCircle, Loader2, Clock, ExternalLink, Filter } from "lucide-react"
import { documents } from "@/lib/mock-data"

const PLATFORM_COLOR: Record<string, string> = {
  x: "bg-foreground/10 text-foreground",
  instagram: "bg-[var(--chart-5)]/10 text-[var(--chart-5)]",
  telegram: "bg-[var(--chart-1)]/10 text-[var(--chart-1)]",
  news: "bg-[var(--chart-4)]/10 text-[var(--chart-4)]",
}

const STATUS_CONFIG = {
  processed: { icon: CheckCircle2, color: "text-[var(--chart-3)]", badge: "bg-[var(--chart-3)]/10 text-[var(--chart-3)]" },
  processing: { icon: Loader2, color: "text-[var(--chart-4)]", badge: "bg-[var(--chart-4)]/10 text-[var(--chart-4)]" },
  failed: { icon: AlertCircle, color: "text-destructive", badge: "bg-destructive/10 text-destructive" },
  pending: { icon: Clock, color: "text-muted-foreground", badge: "bg-muted text-muted-foreground" },
  in_progress: { icon: Loader2, color: "text-[var(--chart-1)]", badge: "bg-[var(--chart-1)]/10 text-[var(--chart-1)]" },
}

export default function DocumentsPage() {
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterPlatform, setFilterPlatform] = useState<string>("all")
  const [selected, setSelected] = useState<typeof documents[0] | null>(null)

  const filtered = documents.filter((d) => {
    const matchSearch = d.title.toLowerCase().includes(search.toLowerCase()) || d.entities.some(e => e.toLowerCase().includes(search.toLowerCase()))
    const matchStatus = filterStatus === "all" || d.status === filterStatus
    const matchPlatform = filterPlatform === "all" || d.platform === filterPlatform
    return matchSearch && matchStatus && matchPlatform
  })

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search documents, entities…" className="pl-8 h-9 bg-input border-border text-sm" />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {["all", "processed", "processing", "failed"].map((s) => (
            <Button key={s} size="sm" variant={filterStatus === s ? "default" : "outline"} className="h-8 text-xs capitalize" onClick={() => setFilterStatus(s)}>
              {s}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          {["all", "x", "instagram", "telegram", "news"].map((p) => (
            <Button key={p} size="sm" variant={filterPlatform === p ? "default" : "outline"} className="h-8 text-xs capitalize" onClick={() => setFilterPlatform(p)}>
              {p}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex gap-4">
        {/* Table */}
        <Card className="flex-1 bg-card border-border min-w-0">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-medium">Documents</CardTitle>
                <CardDescription className="text-xs">{filtered.length} of {documents.length} records</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    {["Title", "Platform", "Language", "Topics", "Sentiment", "Status", "Date"].map((h) => (
                      <th key={h} className="text-left text-muted-foreground font-medium px-4 py-2.5 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((doc) => {
                    const cfg = STATUS_CONFIG[doc.status as keyof typeof STATUS_CONFIG]
                    const Icon = cfg.icon
                    const isSelected = selected?.id === doc.id
                    return (
                      <tr
                        key={doc.id}
                        className={`border-b border-border/50 cursor-pointer transition-colors ${isSelected ? "bg-primary/5" : "hover:bg-accent/30"}`}
                        onClick={() => setSelected(isSelected ? null : doc)}
                      >
                        <td className="px-4 py-3 max-w-[240px]">
                          <p className="truncate font-medium text-foreground">{doc.title}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase ${PLATFORM_COLOR[doc.platform] ?? "bg-muted text-muted-foreground"}`}>
                            {doc.platform}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{doc.language}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 flex-wrap">
                            {doc.topics.slice(0, 2).map((t) => (
                              <Badge key={t} variant="secondary" className="text-[10px] h-4 px-1.5">{t}</Badge>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`font-medium ${doc.sentiment > 0.5 ? "text-[var(--chart-3)]" : doc.sentiment > 0 ? "text-[var(--chart-4)]" : "text-destructive"}`}>
                            {doc.sentiment > 0 ? "+" : ""}{doc.sentiment.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full w-fit ${cfg.badge}`}>
                            <Icon className="size-2.5" />
                            {doc.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {new Date(doc.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Detail panel */}
        {selected && (
          <Card className="w-80 shrink-0 bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                Document Detail
                <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-xs">
              <p className="text-foreground font-medium leading-relaxed">{selected.title}</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "ID", value: selected.id },
                  { label: "Platform", value: selected.platform.toUpperCase() },
                  { label: "Language", value: selected.language },
                  { label: "Words", value: selected.wordCount.toLocaleString() },
                  { label: "Confidence", value: `${(selected.confidence * 100).toFixed(0)}%` },
                  { label: "Sentiment", value: selected.sentiment.toFixed(2) },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-muted-foreground uppercase tracking-wider text-[10px]">{label}</p>
                    <p className="text-foreground font-medium mt-0.5">{value}</p>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-muted-foreground uppercase tracking-wider text-[10px] mb-1.5">Topics</p>
                <div className="flex gap-1 flex-wrap">
                  {selected.topics.map((t) => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}
                </div>
              </div>
              <div>
                <p className="text-muted-foreground uppercase tracking-wider text-[10px] mb-1.5">Entities</p>
                <div className="flex gap-1 flex-wrap">
                  {selected.entities.map((e) => <Badge key={e} variant="outline" className="text-[10px] border-border">{e}</Badge>)}
                </div>
              </div>
              <div>
                <p className="text-muted-foreground uppercase tracking-wider text-[10px] mb-1">Date</p>
                <p className="text-foreground">{new Date(selected.date).toLocaleString("en-IN")}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
