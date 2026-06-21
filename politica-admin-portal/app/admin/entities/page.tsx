"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Search, CheckCircle2 } from "lucide-react"
import { entities } from "@/lib/mock-data"
import { StatCard } from "@/components/admin/stat-card"
import { Users, Building2, MapPin, BookOpen } from "lucide-react"

const TYPE_STYLE: Record<string, string> = {
  PERSON: "bg-[var(--chart-1)]/10 text-[var(--chart-1)]",
  ORGANIZATION: "bg-[var(--chart-5)]/10 text-[var(--chart-5)]",
  LOCATION: "bg-[var(--chart-3)]/10 text-[var(--chart-3)]",
  POLICY: "bg-[var(--chart-4)]/10 text-[var(--chart-4)]",
}

export default function EntitiesPage() {
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState("all")

  const filtered = entities.filter((e) => {
    const matchSearch = e.name.toLowerCase().includes(search.toLowerCase()) || (e.party ?? "").toLowerCase().includes(search.toLowerCase())
    const matchType = filterType === "all" || e.type === filterType
    return matchSearch && matchType
  })

  const persons = entities.filter((e) => e.type === "PERSON").length
  const orgs = entities.filter((e) => e.type === "ORGANIZATION").length
  const locs = entities.filter((e) => e.type === "LOCATION").length
  const policies = entities.filter((e) => e.type === "POLICY").length

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Persons" value={persons} sub="Politicians & leaders" icon={Users} color="blue" />
        <StatCard title="Organizations" value={orgs} sub="Parties & bodies" icon={Building2} color="purple" />
        <StatCard title="Locations" value={locs} sub="States, cities" icon={MapPin} color="green" />
        <StatCard title="Policies" value={policies} sub="Programs & schemes" icon={BookOpen} color="orange" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search entities or parties…" className="pl-8 h-9 bg-input border-border text-sm" />
        </div>
        {["all", "PERSON", "ORGANIZATION", "LOCATION", "POLICY"].map((t) => (
          <Button key={t} size="sm" variant={filterType === t ? "default" : "outline"} className="h-8 text-xs" onClick={() => setFilterType(t)}>
            {t === "all" ? "All" : t}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((entity) => {
          const maxMentions = Math.max(...entities.map((e) => e.mentions))
          return (
            <Card key={entity.id} className="bg-card border-border hover:border-primary/30 transition-colors">
              <CardContent className="p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="size-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                      {entity.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold text-foreground">{entity.name}</p>
                        {entity.verified && <CheckCircle2 className="size-3.5 text-[var(--chart-1)]" />}
                      </div>
                      <p className="text-[10px] text-muted-foreground">{entity.role}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${TYPE_STYLE[entity.type]}`}>
                    {entity.type}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="text-center bg-muted/50 rounded-lg p-2">
                    <p className="text-lg font-bold text-foreground tabular-nums">{entity.mentions.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">Mentions</p>
                  </div>
                  <div className="text-center bg-muted/50 rounded-lg p-2">
                    <p className="text-lg font-bold text-foreground tabular-nums">{entity.documents}</p>
                    <p className="text-[10px] text-muted-foreground">Docs</p>
                  </div>
                  <div className="text-center bg-muted/50 rounded-lg p-2">
                    <p className={`text-lg font-bold tabular-nums ${entity.sentiment > 0.4 ? "text-[var(--chart-3)]" : entity.sentiment > 0.2 ? "text-[var(--chart-4)]" : "text-destructive"}`}>
                      {entity.sentiment.toFixed(2)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Sentiment</p>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground uppercase tracking-wider">Mention share</span>
                    <span className="text-muted-foreground">{Math.round((entity.mentions / maxMentions) * 100)}%</span>
                  </div>
                  <Progress value={(entity.mentions / maxMentions) * 100} className="h-1.5 bg-muted" />
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  {entity.party && (
                    <Badge variant="secondary" className="text-[10px]">{entity.party}</Badge>
                  )}
                  <span className="text-muted-foreground text-[10px]">{entity.state}</span>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
