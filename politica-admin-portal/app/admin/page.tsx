"use client"

import { StatCard } from "@/components/admin/stat-card"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts"
import {
  FileText, BookMarked, Users, Tag, TrendingUp, Activity, Clock, CheckCircle2, AlertCircle, Loader2,
} from "lucide-react"
import {
  systemStats, weeklyEngagement, topicTrends, documents, promises, auditLogs,
} from "@/lib/mock-data"

const STATUS_CONFIG = {
  processed: { label: "Processed", icon: CheckCircle2, color: "text-[var(--chart-3)]" },
  processing: { label: "Processing", icon: Loader2, color: "text-[var(--chart-4)]" },
  failed: { label: "Failed", icon: AlertCircle, color: "text-destructive" },
  pending: { label: "Pending", icon: Clock, color: "text-muted-foreground" },
  in_progress: { label: "In Progress", icon: Loader2, color: "text-[var(--chart-1)]" },
}

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Documents" value={systemStats.totalDocuments.toLocaleString()} sub={`+${systemStats.processedToday} today`} icon={FileText} trend="+148 today" trendUp color="blue" />
        <StatCard title="Promises Tracked" value={systemStats.totalPromises.toLocaleString()} sub="Across all parties" icon={BookMarked} trend="+12 this week" trendUp color="green" />
        <StatCard title="Entities" value={systemStats.totalEntities.toLocaleString()} sub="People, orgs, places" icon={Users} trend="+34 this week" trendUp color="orange" />
        <StatCard title="Topics Active" value={systemStats.totalTopics} sub="Across 12 languages" icon={Tag} trend="Stable" trendUp color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Weekly engagement chart */}
        <Card className="lg:col-span-2 bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Weekly Collection Volume</CardTitle>
            <CardDescription className="text-xs">Documents & entities collected per week</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={weeklyEngagement}>
                <defs>
                  <linearGradient id="docGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="oklch(0.58 0.2 264)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="oklch(0.58 0.2 264)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.01 264)" />
                <XAxis dataKey="week" tick={{ fill: "oklch(0.52 0.012 264)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "oklch(0.52 0.012 264)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "oklch(0.13 0.008 264)", border: "1px solid oklch(0.22 0.01 264)", borderRadius: "8px", color: "oklch(0.93 0.005 264)", fontSize: 12 }} />
                <Area type="monotone" dataKey="documents" stroke="oklch(0.58 0.2 264)" fill="url(#docGrad)" strokeWidth={2} name="Documents" />
                <Area type="monotone" dataKey="promises" stroke="oklch(0.65 0.18 145)" fill="transparent" strokeWidth={2} strokeDasharray="4 2" name="Promises" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* System status */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground">System Status</CardTitle>
            <CardDescription className="text-xs">Pipeline health overview</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {[
              { label: "Collection Service", status: "online" },
              { label: "OCR Engine", status: "online" },
              { label: "NLP Processor", status: "online" },
              { label: "LLM Agents", status: "online" },
              { label: "Elasticsearch", status: "degraded" },
              { label: "Vector Store", status: "online" },
            ].map((s) => (
              <div key={s.label} className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{s.label}</span>
                <div className="flex items-center gap-1.5">
                  <span className={`size-2 rounded-full ${s.status === "online" ? "bg-[var(--chart-3)]" : "bg-[var(--chart-4)]"}`} />
                  <span className={`text-xs font-medium ${s.status === "online" ? "text-[var(--chart-3)]" : "text-[var(--chart-4)]"}`}>
                    {s.status}
                  </span>
                </div>
              </div>
            ))}
            <div className="mt-2 pt-3 border-t border-border flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Uptime</span>
              <span className="text-xs font-semibold text-foreground">{systemStats.uptime}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Storage used</span>
              <span className="text-xs font-semibold text-foreground">{systemStats.storageUsed}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Queue pending</span>
              <Badge variant="secondary" className="text-xs h-5">{systemStats.pendingQueue}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Topic trends */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-foreground">Topic Trends — 2026</CardTitle>
          <CardDescription className="text-xs">Monthly document volume by topic</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topicTrends}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.01 264)" />
              <XAxis dataKey="month" tick={{ fill: "oklch(0.52 0.012 264)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "oklch(0.52 0.012 264)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "oklch(0.13 0.008 264)", border: "1px solid oklch(0.22 0.01 264)", borderRadius: "8px", color: "oklch(0.93 0.005 264)", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11, color: "oklch(0.52 0.012 264)" }} />
              <Bar dataKey="Infrastructure" fill="oklch(0.72 0.18 80)" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Education" fill="oklch(0.58 0.2 264)" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Healthcare" fill="oklch(0.65 0.18 145)" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Employment" fill="oklch(0.6 0.22 320)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent documents */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Recent Documents</CardTitle>
            <CardDescription className="text-xs">Latest collected content</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-64">
              <div className="px-4 pb-4 flex flex-col gap-2">
                {documents.slice(0, 6).map((doc) => {
                  const cfg = STATUS_CONFIG[doc.status as keyof typeof STATUS_CONFIG]
                  const Icon = cfg.icon
                  return (
                    <div key={doc.id} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
                      <Icon className={`size-4 mt-0.5 shrink-0 ${cfg.color}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{doc.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-muted-foreground">{doc.platform.toUpperCase()}</span>
                          <span className="text-[10px] text-muted-foreground">·</span>
                          <span className="text-[10px] text-muted-foreground">{doc.language}</span>
                          <span className="text-[10px] text-muted-foreground">·</span>
                          <span className="text-[10px] text-muted-foreground">{doc.topics[0]}</span>
                        </div>
                      </div>
                      <span className={`text-[10px] font-medium ${doc.sentiment > 0.5 ? "text-[var(--chart-3)]" : doc.sentiment > 0 ? "text-[var(--chart-4)]" : "text-destructive"}`}>
                        {doc.sentiment > 0 ? "+" : ""}{doc.sentiment.toFixed(2)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Recent audit log */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Activity Log</CardTitle>
            <CardDescription className="text-xs">Recent pipeline events</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-64">
              <div className="px-4 pb-4 flex flex-col gap-2">
                {auditLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-accent/50 transition-colors">
                    <Activity className={`size-3.5 mt-0.5 shrink-0 ${log.status === "success" ? "text-[var(--chart-3)]" : "text-destructive"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground">{log.action}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{log.details}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Recent promises */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-foreground">Recent Promises Extracted</CardTitle>
          <CardDescription className="text-xs">AI-extracted political commitments</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-muted-foreground font-medium px-4 py-2.5 uppercase tracking-wider">Promise</th>
                  <th className="text-left text-muted-foreground font-medium px-4 py-2.5 uppercase tracking-wider hidden md:table-cell">Entity</th>
                  <th className="text-left text-muted-foreground font-medium px-4 py-2.5 uppercase tracking-wider hidden md:table-cell">Topic</th>
                  <th className="text-left text-muted-foreground font-medium px-4 py-2.5 uppercase tracking-wider hidden lg:table-cell">Region</th>
                  <th className="text-left text-muted-foreground font-medium px-4 py-2.5 uppercase tracking-wider">Status</th>
                  <th className="text-left text-muted-foreground font-medium px-4 py-2.5 uppercase tracking-wider">Conf.</th>
                </tr>
              </thead>
              <tbody>
                {promises.slice(0, 5).map((p) => (
                  <tr key={p.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                    <td className="px-4 py-3 max-w-[280px]">
                      <p className="truncate text-foreground">{p.text}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{p.entity}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <Badge variant="secondary" className="text-[10px] h-4">{p.topic}</Badge>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">{p.region}</td>
                    <td className="px-4 py-3">
                      <span className={`font-medium capitalize ${p.status === "in_progress" ? "text-[var(--chart-1)]" : "text-muted-foreground"}`}>
                        {p.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--chart-3)] font-medium">{(p.confidence * 100).toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
