"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, ImageIcon, FileText, Calendar, HardDrive, X } from "lucide-react"
import { mediaItems } from "@/lib/mock-data"

const PLATFORM_COLOR: Record<string, string> = {
  x: "bg-foreground/10 text-foreground",
  instagram: "bg-[var(--chart-5)]/10 text-[var(--chart-5)]",
  telegram: "bg-[var(--chart-1)]/10 text-[var(--chart-1)]",
  news: "bg-[var(--chart-4)]/10 text-[var(--chart-4)]",
}

const TYPE_COLORS: Record<string, string> = {
  banner: "bg-[var(--chart-1)]/10 text-[var(--chart-1)]",
  poster: "bg-[var(--chart-5)]/10 text-[var(--chart-5)]",
  event: "bg-[var(--chart-3)]/10 text-[var(--chart-3)]",
  rally: "bg-[var(--chart-4)]/10 text-[var(--chart-4)]",
}

// Simple placeholder image colors per item
const PLACEHOLDER_COLORS = [
  "from-[oklch(0.2_0.05_264)] to-[oklch(0.15_0.02_264)]",
  "from-[oklch(0.2_0.05_320)] to-[oklch(0.15_0.02_320)]",
  "from-[oklch(0.2_0.05_145)] to-[oklch(0.15_0.02_145)]",
  "from-[oklch(0.2_0.05_80)] to-[oklch(0.15_0.02_80)]",
  "from-[oklch(0.2_0.05_264)] to-[oklch(0.15_0.02_180)]",
  "from-[oklch(0.2_0.05_320)] to-[oklch(0.15_0.02_264)]",
]

export default function MediaPage() {
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [selected, setSelected] = useState<typeof mediaItems[0] | null>(null)

  const filtered = mediaItems.filter((m) => {
    const matchSearch = m.filename.toLowerCase().includes(search.toLowerCase()) || m.ocrText.toLowerCase().includes(search.toLowerCase()) || m.entities.some((e) => e.toLowerCase().includes(search.toLowerCase()))
    const matchType = filterType === "all" || m.type === filterType
    return matchSearch && matchType
  })

  return (
    <div className="flex flex-col gap-5">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by filename, OCR text, entity…" className="pl-8 h-9 bg-input border-border text-sm" />
        </div>
        {["all", "banner", "poster", "event", "rally"].map((t) => (
          <Button key={t} size="sm" variant={filterType === t ? "default" : "outline"} className="h-8 text-xs capitalize" onClick={() => setFilterType(t)}>
            {t}
          </Button>
        ))}
        <span className="text-xs text-muted-foreground">{filtered.length} items</span>
      </div>

      <div className="flex gap-4">
        {/* Grid */}
        <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-4">
          {filtered.map((item, idx) => (
            <Card
              key={item.id}
              className={`bg-card border-border cursor-pointer overflow-hidden transition-all hover:scale-[1.01] ${selected?.id === item.id ? "ring-2 ring-primary" : ""}`}
              onClick={() => setSelected(selected?.id === item.id ? null : item)}
            >
              {/* Placeholder image */}
              <div className={`h-36 bg-gradient-to-br ${PLACEHOLDER_COLORS[idx % PLACEHOLDER_COLORS.length]} flex flex-col items-center justify-center gap-2 relative`}>
                <ImageIcon className="size-8 text-foreground/20" />
                <span className="text-[10px] text-foreground/30 font-mono">{item.filename}</span>
                <span className={`absolute top-2 right-2 text-[10px] font-medium px-2 py-0.5 rounded capitalize ${TYPE_COLORS[item.type]}`}>{item.type}</span>
                <span className={`absolute top-2 left-2 text-[10px] font-medium px-2 py-0.5 rounded uppercase ${PLATFORM_COLOR[item.platform]}`}>{item.platform}</span>
              </div>
              <CardContent className="p-3 flex flex-col gap-2">
                <p className="text-xs font-medium text-foreground truncate">{item.filename}</p>
                <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">{item.ocrText}</p>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{item.size}</span>
                  <span>{new Date(item.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Detail panel */}
        {selected && (
          <Card className="w-72 shrink-0 bg-card border-border">
            <CardContent className="p-0 flex flex-col">
              {/* Preview */}
              <div className={`h-48 bg-gradient-to-br ${PLACEHOLDER_COLORS[mediaItems.indexOf(selected) % PLACEHOLDER_COLORS.length]} flex flex-col items-center justify-center gap-2 rounded-t-lg`}>
                <ImageIcon className="size-10 text-foreground/20" />
                <span className="text-xs text-foreground/30 font-mono px-2 text-center">{selected.filename}</span>
              </div>
              <div className="p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">Details</span>
                  <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
                </div>
                <div className="flex flex-col gap-2 text-xs">
                  {[
                    { icon: FileText, label: "File", value: selected.filename },
                    { icon: Calendar, label: "Date", value: new Date(selected.date).toLocaleDateString("en-IN") },
                    { icon: HardDrive, label: "Size", value: selected.size },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-start gap-2">
                      <Icon className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
                        <p className="text-foreground font-medium">{value}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">OCR Text</p>
                  <p className="text-xs text-foreground bg-muted/40 rounded-lg p-2.5 leading-relaxed">{selected.ocrText}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Entities</p>
                  <div className="flex flex-wrap gap-1">
                    {selected.entities.map((e) => <Badge key={e} variant="outline" className="text-[10px] border-border">{e}</Badge>)}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Topics</p>
                  <div className="flex flex-wrap gap-1">
                    {selected.topics.map((t) => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}
                  </div>
                </div>
                <Button size="sm" className="h-8 text-xs mt-1">Download Original</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
