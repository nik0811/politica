"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Search, BookMarked, MapPin, Calendar, Percent } from "lucide-react"
import { promises } from "@/lib/mock-data"
import { StatCard } from "@/components/admin/stat-card"

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  in_progress: "bg-[var(--chart-1)]/10 text-[var(--chart-1)]",
  fulfilled: "bg-[var(--chart-3)]/10 text-[var(--chart-3)]",
  broken: "bg-destructive/10 text-destructive",
}

export default function PromisesPage() {
  const [search, setSearch] = useState("")
  const [filterTopic, setFilterTopic] = useState("all")
  const [filterParty, setFilterParty] = useState("all")

  const topics = Array.from(new Set(promises.map((p) => p.topic)))
  const parties = Array.from(new Set(promises.map((p) => p.party)))

  const filtered = promises.filter((p) => {
    const matchSearch =
      p.text.toLowerCase().includes(search.toLowerCase()) ||
      p.entity.toLowerCase().includes(search.toLowerCase())
    const matchTopic = filterTopic === "all" || p.topic === filterTopic
    const matchParty = filterParty === "all" || p.party === filterParty
    return matchSearch && matchTopic && matchParty
  })

  const total = promises.length
  const inProgress = promises.filter((p) => p.status === "in_progress").length
  const highConf = promises.filter((p) => p.confidence >= 0.9).length

  return (
    <div className="flex flex-col gap-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Promises" value={total} sub="All parties combined" icon={BookMarked} color="blue" />
        <StatCard title="In Progress" value={inProgress} sub="Being tracked" icon={Calendar} trend="+3 this week" trendUp color="cyan" />
        <StatCard title="High Confidence" value={highConf} sub="≥90% confidence" icon={Percent} color="green" />
        <StatCard title="Regions" value={Array.from(new Set(promises.map((p) => p.region))).length} sub="States + National" icon={MapPin} color="orange" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search promises or entities…" className="pl-8 h-9 bg-input border-border text-sm" />
        </div>
        <select
          value={filterTopic}
          onChange={(e) => setFilterTopic(e.target.value)}
          className="h-9 rounded-md bg-input border border-border text-xs text-foreground px-2.5 outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="all">All Topics</option>
          {topics.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={filterParty}
          onChange={(e) => setFilterParty(e.target.value)}
          className="h-9 rounded-md bg-input border border-border text-xs text-foreground px-2.5 outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="all">All Parties</option>
          {parties.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* Promise cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.map((p) => (
          <Card key={p.id} className="bg-card border-border hover:border-primary/30 transition-colors">
            <CardContent className="p-4 flex flex-col gap-3">
              {/* Header row */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="text-[10px]">{p.topic}</Badge>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_STYLE[p.status]}`}>
                    {p.status.replace("_", " ")}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{p.id}</span>
              </div>

              {/* Promise text */}
              <p className="text-sm text-foreground leading-relaxed">{p.text}</p>

              {/* Meta grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground uppercase tracking-wider text-[10px]">Entity</p>
                  <p className="text-foreground font-medium mt-0.5">{p.entity}</p>
                </div>
                <div>
                  <p className="text-muted-foreground uppercase tracking-wider text-[10px]">Party</p>
                  <p className="text-foreground font-medium mt-0.5">{p.party}</p>
                </div>
                <div>
                  <p className="text-muted-foreground uppercase tracking-wider text-[10px]">Region</p>
                  <p className="text-foreground font-medium mt-0.5">{p.region}</p>
                </div>
                <div>
                  <p className="text-muted-foreground uppercase tracking-wider text-[10px]">Timeline</p>
                  <p className="text-foreground font-medium mt-0.5">{p.timeline}</p>
                </div>
                {p.quantity && (
                  <div>
                    <p className="text-muted-foreground uppercase tracking-wider text-[10px]">Quantity</p>
                    <p className="text-foreground font-medium mt-0.5">{p.quantity.toLocaleString()} {p.unit}</p>
                  </div>
                )}
              </div>

              {/* Confidence */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground uppercase tracking-wider">AI Confidence</span>
                  <span className={`font-medium ${p.confidence >= 0.9 ? "text-[var(--chart-3)]" : p.confidence >= 0.8 ? "text-[var(--chart-4)]" : "text-destructive"}`}>
                    {(p.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <Progress value={p.confidence * 100} className="h-1.5 bg-muted" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <BookMarked className="size-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No promises found matching your filters.</p>
        </div>
      )}
    </div>
  )
}
