"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell,
  ReferenceLine,
} from "recharts"
import {
  TrendingUp, TrendingDown, ThumbsUp, ThumbsDown, Minus,
  MapPin, BarChart3, ArrowUpRight, ArrowDownRight,
} from "lucide-react"
import {
  partySentimentSnapshot,
  partySentimentTrend,
  topicPartyBreakdown,
  platformPartyFavor,
  statePartyLeader,
  PARTY_COLORS,
} from "@/lib/mock-data"

// ─── Tooltip ─────────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-popover p-3 shadow-xl text-xs min-w-[140px]">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2 rounded-full" style={{ background: entry.color }} />
            {entry.name}
          </span>
          <span className="font-medium text-foreground">{entry.value}%</span>
        </div>
      ))}
    </div>
  )
}

// ─── Party Favor/Against bar row ─────────────────────────────────────────────
function PartyFavorBar({ party, inFavor, against, neutral, net, favorPct, againstPct, neutralPct, trend, trendUp }: typeof partySentimentSnapshot[0]) {
  const color = PARTY_COLORS[party]?.badge ?? "#6366f1"
  return (
    <div className="flex flex-col gap-2 p-4 rounded-lg border border-border bg-card hover:bg-accent/30 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full shrink-0" style={{ background: color }} />
          <span className="font-semibold text-sm text-foreground">{party}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-0.5 text-xs font-medium ${trendUp ? "text-emerald-500" : "text-destructive"}`}>
            {trendUp ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {trend}
          </span>
          <Badge
            variant="outline"
            className={`text-[10px] font-semibold ${net >= 0 ? "border-emerald-500/40 text-emerald-500" : "border-destructive/40 text-destructive"}`}
          >
            Net {net >= 0 ? "+" : ""}{net.toLocaleString()}
          </Badge>
        </div>
      </div>

      {/* Stacked bar */}
      <div className="h-2.5 rounded-full overflow-hidden flex gap-px bg-muted">
        <div
          className="h-full rounded-l-full transition-all"
          style={{ width: `${favorPct}%`, background: color, opacity: 0.9 }}
        />
        <div className="h-full" style={{ width: `${neutralPct}%`, background: "oklch(0.5 0 0 / 0.25)" }} />
        <div
          className="h-full rounded-r-full transition-all"
          style={{ width: `${againstPct}%`, background: "#ef4444", opacity: 0.75 }}
        />
      </div>

      <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <ThumbsUp className="size-3 text-emerald-500" />
          <span className="text-foreground font-medium">{favorPct}%</span> in favor
          <span className="text-muted-foreground/60">({inFavor.toLocaleString()})</span>
        </span>
        <span className="flex items-center gap-1">
          <Minus className="size-3 text-muted-foreground" />
          <span className="text-foreground font-medium">{neutralPct}%</span> neutral
        </span>
        <span className="flex items-center gap-1">
          <ThumbsDown className="size-3 text-destructive" />
          <span className="text-foreground font-medium">{againstPct}%</span> against
          <span className="text-muted-foreground/60">({against.toLocaleString()})</span>
        </span>
      </div>
    </div>
  )
}

// ─── Stat summary cards ───────────────────────────────────────────────────────
function SummaryCard({ label, value, sub, icon: Icon, color }: { label: string; value: string; sub: string; icon: any; color: string }) {
  return (
    <div className="flex flex-col gap-1.5 p-4 rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2">
        <div className={`flex items-center justify-center size-7 rounded-md bg-${color}-500/10`}>
          <Icon className={`size-3.5 text-${color}-500`} />
        </div>
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold text-foreground tracking-tight">{value}</p>
      <p className="text-[11px] text-muted-foreground">{sub}</p>
    </div>
  )
}

export default function AnalyticsPage() {
  const [activeParties, setActiveParties] = useState<string[]>(["BJP", "Congress", "AAP", "SP"])

  const topParty = partySentimentSnapshot[0]
  const mostOpposed = [...partySentimentSnapshot].sort((a, b) => b.againstPct - a.againstPct)[0]
  const totalFavor = partySentimentSnapshot.reduce((s, p) => s + p.inFavor, 0)
  const totalAgainst = partySentimentSnapshot.reduce((s, p) => s + p.against, 0)

  // Net sentiment bar data
  const netData = partySentimentSnapshot.map((p) => ({
    party: p.party,
    net: p.net,
    fill: p.net >= 0 ? (PARTY_COLORS[p.party]?.badge ?? "#6366f1") : "#ef4444",
  }))

  return (
    <div className="flex flex-col gap-6">

      {/* Page header */}
      <div>
        <h1 className="text-lg font-semibold text-foreground">Party Sentiment Analytics</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Documents analyzed for positive (in favor) and negative (against) sentiment toward each political party — June 2026
        </p>
      </div>

      {/* Summary stat row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard label="Most Favored" value={topParty.party} sub={`${topParty.favorPct}% in favor across all platforms`} icon={TrendingUp} color="emerald" />
        <SummaryCard label="Most Opposed" value={mostOpposed.party} sub={`${mostOpposed.againstPct}% against sentiment`} icon={TrendingDown} color="red" />
        <SummaryCard label="Total Pro-mentions" value={totalFavor.toLocaleString()} sub="Across all 8 parties this week" icon={ThumbsUp} color="blue" />
        <SummaryCard label="Total Anti-mentions" value={totalAgainst.toLocaleString()} sub="Across all 8 parties this week" icon={ThumbsDown} color="orange" />
      </div>

      {/* Party favor/against rows */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">In Favor vs Against — All Parties</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Mention-level sentiment breakdown by party, W24 2026</p>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-emerald-500" /> In favor</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-muted-foreground/30" /> Neutral</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-destructive" /> Against</span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {partySentimentSnapshot.map((p) => (
            <PartyFavorBar key={p.party} {...p} />
          ))}
        </div>
      </div>

      {/* Tabs: Trend, Topic breakdown, Platform, States */}
      <Tabs defaultValue="trend">
        <TabsList className="h-8 text-xs">
          <TabsTrigger value="trend" className="text-xs">Weekly Trend</TabsTrigger>
          <TabsTrigger value="net" className="text-xs">Net Score</TabsTrigger>
          <TabsTrigger value="topic" className="text-xs">By Topic</TabsTrigger>
          <TabsTrigger value="platform" className="text-xs">By Platform</TabsTrigger>
          <TabsTrigger value="states" className="text-xs">By State</TabsTrigger>
        </TabsList>

        {/* Weekly favor % trend */}
        <TabsContent value="trend" className="mt-4">
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">In-Favor % Over Time</CardTitle>
              <CardDescription className="text-xs">Weekly percentage of mentions that are pro-party (top 4 parties)</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Party toggles */}
              <div className="flex flex-wrap gap-2 mb-4">
                {["BJP", "Congress", "AAP", "SP"].map((p) => {
                  const active = activeParties.includes(p)
                  const c = PARTY_COLORS[p]?.badge ?? "#6366f1"
                  return (
                    <button
                      key={p}
                      onClick={() => setActiveParties((prev) => active ? prev.filter((x) => x !== p) : [...prev, p])}
                      className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all ${active ? "border-transparent text-white" : "border-border text-muted-foreground bg-transparent"}`}
                      style={active ? { background: c } : {}}
                    >
                      <span className="size-1.5 rounded-full" style={{ background: active ? "white" : c }} />
                      {p}
                    </button>
                  )
                })}
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={partySentimentTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} />
                  <XAxis dataKey="week" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[30, 70]} unit="%" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <ReferenceLine y={50} stroke="var(--border)" strokeDasharray="4 4" label={{ value: "50%", position: "insideRight", fill: "var(--muted-foreground)", fontSize: 10 }} />
                  <Tooltip content={<ChartTooltip />} />
                  {["BJP", "Congress", "AAP", "SP"].map((p) =>
                    activeParties.includes(p) ? (
                      <Line
                        key={p}
                        type="monotone"
                        dataKey={p}
                        stroke={PARTY_COLORS[p]?.badge ?? "#6366f1"}
                        strokeWidth={2.5}
                        dot={{ fill: PARTY_COLORS[p]?.badge ?? "#6366f1", r: 3.5, strokeWidth: 0 }}
                        activeDot={{ r: 5 }}
                        name={p}
                      />
                    ) : null
                  )}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Net score bar chart */}
        <TabsContent value="net" className="mt-4">
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Net Sentiment Score</CardTitle>
              <CardDescription className="text-xs">In-favor mentions minus against mentions — positive means net popular</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={netData} layout="vertical" margin={{ left: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} horizontal={false} />
                  <XAxis type="number" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="party" tick={{ fill: "var(--foreground)", fontSize: 12, fontWeight: 500 }} axisLine={false} tickLine={false} width={60} />
                  <ReferenceLine x={0} stroke="var(--border)" />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const val = payload[0].value as number
                      return (
                        <div className="rounded-lg border border-border bg-popover p-3 shadow-xl text-xs">
                          <p className="font-semibold text-foreground mb-1">{payload[0].payload.party}</p>
                          <p className={val >= 0 ? "text-emerald-500" : "text-destructive"}>
                            Net: {val >= 0 ? "+" : ""}{(val as number).toLocaleString()} mentions
                          </p>
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey="net" radius={[0, 4, 4, 0]} maxBarSize={28}>
                    {netData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Topic breakdown */}
        <TabsContent value="topic" className="mt-4">
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">In-Favor % by Topic — BJP vs Congress</CardTitle>
              <CardDescription className="text-xs">Which party benefits most from each political topic in media coverage</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={topicPartyBreakdown} layout="vertical" margin={{ left: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} horizontal={false} />
                  <XAxis type="number" unit="%" domain={[0, 100]} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="topic" tick={{ fill: "var(--foreground)", fontSize: 11 }} axisLine={false} tickLine={false} width={88} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="BJPfavor" name="BJP — In Favor" fill={PARTY_COLORS.BJP.badge} radius={[0, 4, 4, 0]} maxBarSize={14} />
                  <Bar dataKey="CONGfavor" name="Congress — In Favor" fill={PARTY_COLORS.Congress.badge} radius={[0, 4, 4, 0]} maxBarSize={14} />
                </BarChart>
              </ResponsiveContainer>

              {/* Against mini-table */}
              <div className="mt-4 border border-border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="text-left px-3 py-2 text-muted-foreground font-medium">Topic</th>
                      <th className="text-center px-3 py-2 text-[#f97316] font-medium">BJP Against</th>
                      <th className="text-center px-3 py-2 text-[#22c55e] font-medium">Congress Against</th>
                      <th className="text-center px-3 py-2 text-muted-foreground font-medium">BJP leads?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topicPartyBreakdown.map((row) => (
                      <tr key={row.topic} className="border-b border-border/50 hover:bg-accent/20 transition-colors">
                        <td className="px-3 py-2.5 font-medium text-foreground">{row.topic}</td>
                        <td className="px-3 py-2.5 text-center text-destructive font-medium">{row.BJPageainst}%</td>
                        <td className="px-3 py-2.5 text-center text-destructive font-medium">{row.CONGagainst}%</td>
                        <td className="px-3 py-2.5 text-center">
                          {row.BJPfavor > row.CONGfavor
                            ? <Badge variant="outline" className="text-[10px] border-[#f97316]/40 text-[#f97316]">BJP</Badge>
                            : <Badge variant="outline" className="text-[10px] border-[#22c55e]/40 text-[#22c55e]">Congress</Badge>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Platform breakdown */}
        <TabsContent value="platform" className="mt-4">
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">In-Favor % by Platform</CardTitle>
              <CardDescription className="text-xs">Party favorability across X, Instagram, Telegram, and News media</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={platformPartyFavor}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} />
                  <XAxis dataKey="platform" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis unit="%" domain={[25, 70]} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <ReferenceLine y={50} stroke="var(--border)" strokeDasharray="4 4" />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {["BJP", "Congress", "AAP", "SP"].map((p) => (
                    <Bar key={p} dataKey={p} fill={PARTY_COLORS[p]?.badge ?? "#6366f1"} radius={[4, 4, 0, 0]} maxBarSize={22} name={p} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* State breakdown */}
        <TabsContent value="states" className="mt-4">
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">State-Level Party Favorability</CardTitle>
              <CardDescription className="text-xs">Leading party, challenger, and against-sentiment by state</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      {["State", "Leading Party", "Favor %", "Top Challenger", "Challenger Favor %", "Against %", "Swing"].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5 text-muted-foreground font-medium uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {statePartyLeader.map((row) => {
                      const lc = PARTY_COLORS[row.leader]?.badge ?? "#6366f1"
                      const oc = PARTY_COLORS[row.topOpponent]?.badge ?? "#6366f1"
                      return (
                        <tr key={row.state} className="border-b border-border/40 hover:bg-accent/25 transition-colors">
                          <td className="px-4 py-3 font-medium text-foreground flex items-center gap-1.5">
                            <MapPin className="size-3 text-muted-foreground shrink-0" />
                            {row.state}
                          </td>
                          <td className="px-4 py-3">
                            <span className="flex items-center gap-1.5 text-foreground font-semibold">
                              <span className="size-2 rounded-full" style={{ background: lc }} />
                              {row.leader}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${row.leaderFavor}%`, background: lc }} />
                              </div>
                              <span className="font-semibold text-foreground">{row.leaderFavor}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <span className="size-2 rounded-full" style={{ background: oc }} />
                              {row.topOpponent}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{row.opponentFavor}%</td>
                          <td className="px-4 py-3 text-destructive font-medium">{row.against}%</td>
                          <td className="px-4 py-3">
                            <span className={`flex items-center gap-0.5 font-semibold ${row.swing.startsWith("+") ? "text-emerald-500" : "text-destructive"}`}>
                              {row.swing.startsWith("+") ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                              {row.swing}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
