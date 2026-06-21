"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { MapPin, TrendingUp, FileText } from "lucide-react"
import { geographicData } from "@/lib/mock-data"

const ACTIVITY_COLOR: Record<string, string> = {
  very_high: "text-[var(--chart-1)] bg-[var(--chart-1)]/10",
  high: "text-[var(--chart-3)] bg-[var(--chart-3)]/10",
  medium: "text-[var(--chart-4)] bg-[var(--chart-4)]/10",
  low: "text-muted-foreground bg-muted",
}

const BAR_COLORS = [
  "oklch(0.58 0.2 264)", "oklch(0.65 0.18 145)", "oklch(0.72 0.18 80)",
  "oklch(0.62 0.22 320)", "oklch(0.65 0.18 180)", "oklch(0.6 0.2 264)",
  "oklch(0.68 0.18 145)", "oklch(0.7 0.18 80)", "oklch(0.64 0.22 320)", "oklch(0.67 0.18 180)",
]

export default function GeographicPage() {
  const [selected, setSelected] = useState<typeof geographicData[0] | null>(null)
  const maxDocs = Math.max(...geographicData.map((g) => g.documents))

  const sorted = [...geographicData].sort((a, b) => b.documents - a.documents)

  return (
    <div className="flex flex-col gap-6">
      {/* Bar chart */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Document Volume by State</CardTitle>
          <CardDescription className="text-xs">Click a bar to view state details</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={sorted} onClick={(d) => d?.activePayload && setSelected(geographicData.find((g) => g.state === d.activePayload?.[0]?.payload?.state) ?? null)}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.01 264)" />
              <XAxis dataKey="state" tick={{ fill: "oklch(0.52 0.012 264)", fontSize: 10 }} axisLine={false} tickLine={false} angle={-30} textAnchor="end" height={50} />
              <YAxis tick={{ fill: "oklch(0.52 0.012 264)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "oklch(0.13 0.008 264)", border: "1px solid oklch(0.22 0.01 264)", borderRadius: "8px", color: "oklch(0.93 0.005 264)", fontSize: 12 }}
                formatter={(v: number) => [v.toLocaleString(), "Documents"]}
              />
              <Bar dataKey="documents" radius={[3, 3, 0, 0]} cursor="pointer">
                {sorted.map((entry, i) => (
                  <Cell key={entry.state} fill={selected?.state === entry.state ? "oklch(0.78 0.2 264)" : BAR_COLORS[i % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* State cards */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sorted.map((g) => (
            <Card
              key={g.state}
              className={`bg-card border-border cursor-pointer transition-colors ${selected?.state === g.state ? "border-primary/40" : "hover:border-border/80"}`}
              onClick={() => setSelected(selected?.state === g.state ? null : g)}
            >
              <CardContent className="p-4 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="size-3.5 text-muted-foreground" />
                    <span className="text-sm font-semibold text-foreground">{g.state}</span>
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${ACTIVITY_COLOR[g.activity]}`}>
                    {g.activity.replace("_", " ")}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-xs">
                  <div>
                    <p className="text-muted-foreground text-[10px] uppercase tracking-wider">Documents</p>
                    <p className="text-foreground font-bold text-base">{g.documents.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-[10px] uppercase tracking-wider">Sentiment</p>
                    <p className={`font-bold text-base ${g.sentiment > 0.5 ? "text-[var(--chart-3)]" : g.sentiment > 0.35 ? "text-[var(--chart-4)]" : "text-destructive"}`}>
                      {g.sentiment.toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">Volume</span>
                    <span className="text-muted-foreground">{Math.round((g.documents / maxDocs) * 100)}%</span>
                  </div>
                  <Progress value={(g.documents / maxDocs) * 100} className="h-1.5 bg-muted" />
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground">Top topic:</span>
                  <Badge variant="secondary" className="text-[10px] h-4">{g.topTopic}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Detail panel */}
        <div>
          {selected ? (
            <Card className="bg-card border-border sticky top-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <MapPin className="size-4 text-primary" />
                  {selected.state}
                </CardTitle>
                <CardDescription className="text-xs">Detailed regional intelligence</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  {[
                    { label: "Documents", value: selected.documents.toLocaleString() },
                    { label: "Avg Sentiment", value: selected.sentiment.toFixed(3) },
                    { label: "Top Topic", value: selected.topTopic },
                    { label: "Activity Level", value: selected.activity.replace("_", " ") },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                      <span className="text-xs text-muted-foreground">{label}</span>
                      <span className="text-xs font-medium text-foreground capitalize">{value}</span>
                    </div>
                  ))}
                </div>
                <div className="bg-muted/40 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {selected.state} shows <strong className="text-foreground">{selected.activity.replace("_", " ")}</strong> political activity with a focus on <strong className="text-foreground">{selected.topTopic}</strong>. Sentiment is {selected.sentiment > 0.5 ? "positive" : selected.sentiment > 0.35 ? "mixed" : "negative"} at {selected.sentiment.toFixed(2)}.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-muted-foreground gap-3">
              <MapPin className="size-10 opacity-20" />
              <p className="text-sm text-center">Click a state card or bar to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
