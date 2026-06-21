"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Zap, FileText, Users, BookMarked } from "lucide-react"
import { documents, entities, promises } from "@/lib/mock-data"

type ResultType = "document" | "entity" | "promise"

interface Result {
  id: string
  type: ResultType
  title: string
  sub: string
  tags: string[]
  score: number
}

const QUERY_SUGGESTIONS = [
  "Healthcare promises by AAP",
  "Infrastructure sentiment in Gujarat",
  "Narendra Modi education policy",
  "Farmer MSP Bihar",
  "Women safety West Bengal",
]

function doSearch(query: string): Result[] {
  if (!query.trim()) return []
  const q = query.toLowerCase()
  const results: Result[] = []

  documents.forEach((d) => {
    const score = [d.title, ...d.entities, ...d.topics].filter((t) => t.toLowerCase().includes(q)).length
    if (score > 0) {
      results.push({ id: d.id, type: "document", title: d.title, sub: `${d.platform.toUpperCase()} · ${d.language} · ${new Date(d.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`, tags: d.topics, score })
    }
  })

  entities.forEach((e) => {
    const score = [e.name, e.role, e.party ?? "", e.state].filter((t) => t.toLowerCase().includes(q)).length
    if (score > 0) {
      results.push({ id: e.id, type: "entity", title: e.name, sub: `${e.type} · ${e.role} · ${e.mentions.toLocaleString()} mentions`, tags: [e.party ?? e.state].filter(Boolean), score })
    }
  })

  promises.forEach((p) => {
    const score = [p.text, p.entity, p.topic, p.party, p.region].filter((t) => t?.toLowerCase().includes(q)).length
    if (score > 0) {
      results.push({ id: p.id, type: "promise", title: p.text.slice(0, 80) + "…", sub: `${p.entity} · ${p.party} · ${p.region}`, tags: [p.topic], score })
    }
  })

  return results.sort((a, b) => b.score - a.score)
}

const TYPE_ICON = { document: FileText, entity: Users, promise: BookMarked }
const TYPE_COLOR: Record<ResultType, string> = {
  document: "bg-[var(--chart-1)]/10 text-[var(--chart-1)]",
  entity: "bg-[var(--chart-5)]/10 text-[var(--chart-5)]",
  promise: "bg-[var(--chart-3)]/10 text-[var(--chart-3)]",
}

export default function SearchPage() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Result[]>([])
  const [searched, setSearched] = useState(false)

  const handleSearch = (q: string) => {
    setQuery(q)
    setResults(doSearch(q))
    setSearched(true)
  }

  const docs = results.filter((r) => r.type === "document")
  const ents = results.filter((r) => r.type === "entity")
  const proms = results.filter((r) => r.type === "promise")

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      {/* Search bar */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => { setQuery(e.target.value); if (!e.target.value) setSearched(false) }}
            onKeyDown={(e) => e.key === "Enter" && handleSearch(query)}
            placeholder="Search across documents, entities, and promises…"
            className="pl-11 h-12 bg-input border-border text-sm rounded-xl"
          />
          {query && (
            <Button onClick={() => handleSearch(query)} className="absolute right-2 top-1/2 -translate-y-1/2 h-8 text-xs px-3">
              <Zap className="size-3 mr-1" /> Search
            </Button>
          )}
        </div>

        {!searched && (
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-muted-foreground">Try:</span>
            {QUERY_SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => handleSearch(s)} className="text-xs text-primary/80 hover:text-primary border border-primary/20 hover:border-primary/40 px-2.5 py-1 rounded-full transition-colors">
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {searched && (
        <div className="text-xs text-muted-foreground">
          Found <span className="text-foreground font-medium">{results.length}</span> results for{" "}
          <span className="text-primary">"{query}"</span> — {docs.length} documents, {ents.length} entities, {proms.length} promises
        </div>
      )}

      {results.length > 0 && (
        <div className="flex flex-col gap-3">
          {results.map((r) => {
            const Icon = TYPE_ICON[r.type]
            return (
              <Card key={r.id} className="bg-card border-border hover:border-primary/30 transition-colors cursor-pointer">
                <CardContent className="p-4 flex items-start gap-3">
                  <div className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${TYPE_COLOR[r.type]}`}>
                    <Icon className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-sm font-medium text-foreground">{r.title}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{r.sub}</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded capitalize ${TYPE_COLOR[r.type]}`}>{r.type}</span>
                      {r.tags.map((t) => <Badge key={t} variant="secondary" className="text-[10px] h-4">{t}</Badge>)}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-muted-foreground">Relevance</p>
                    <p className="text-sm font-bold text-foreground">{r.score * 34}%</p>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {searched && results.length === 0 && (
        <div className="text-center py-20 flex flex-col items-center gap-3 text-muted-foreground">
          <Search className="size-10 opacity-20" />
          <p className="text-sm">No results found for "{query}"</p>
          <p className="text-xs">Try different keywords or remove filters</p>
        </div>
      )}
    </div>
  )
}
