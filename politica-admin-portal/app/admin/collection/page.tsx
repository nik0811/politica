"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { apiClient } from "@/lib/api-client"
import {
  RefreshCw, Loader2, CheckCircle2, AlertCircle,
  Activity, Puzzle,
} from "lucide-react"

// ── Constants ─────────────────────────────────────────────────────────────────

const PLATFORMS = [
  { value: "twitter",   label: "Twitter / X",  placeholder: "@narendramodi or q:BJP healthcare" },
  { value: "instagram", label: "Instagram",     placeholder: "narendramodi or bjp4india" },
  { value: "facebook",  label: "Facebook",      placeholder: "facebook.com/BJP4India" },
  { value: "youtube",   label: "YouTube",       placeholder: "UCxxxxx or q:Modi speech" },
  { value: "news",      label: "News",          placeholder: "BJP election or AAP Delhi" },
  { value: "reddit",    label: "Reddit",        placeholder: "r/india or q:Modi" },
]

const PLATFORM_COLORS: Record<string, string> = {
  twitter:   "bg-sky-500/15 text-sky-400",
  instagram: "bg-pink-500/15 text-pink-400",
  facebook:  "bg-blue-500/15 text-blue-400",
  youtube:   "bg-red-500/15 text-red-400",
  news:      "bg-amber-500/15 text-amber-400",
  reddit:    "bg-orange-500/15 text-orange-400",
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtRelative(dt?: string | null) {
  if (!dt) return "—"
  const diff = Date.now() - new Date(dt).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function PlatformBadge({ platform }: { platform: string }) {
  const cls = PLATFORM_COLORS[platform] ?? "bg-muted text-muted-foreground"
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold capitalize ${cls}`}>
      {platform}
    </span>
  )
}

// ── Extension Setup Tab ───────────────────────────────────────────────────────

function ExtensionSetupTab() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const s = await apiClient.getIngestionStats()
      setStats(s)
    } catch {
      setStats(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Ingested", value: stats?.total_documents ?? 0 },
          { label: "Last 24h", value: stats?.last_24h ?? 0 },
          { label: "Last 7 Days", value: stats?.last_7d ?? 0 },
          { label: "Last Data Received", value: fmtRelative(stats?.last_ingestion_at), isText: true },
        ].map((card, i) => (
          <Card key={i} className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{card.label}</p>
              <p className={card.isText ? "text-sm font-semibold text-foreground" : "text-2xl font-bold text-foreground"}>
                {typeof card.value === "number" ? card.value.toLocaleString() : card.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Puzzle className="size-5 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Browser Extension Setup</h3>
          </div>

          <div className="rounded-md bg-muted/50 border border-border p-4 text-xs text-muted-foreground space-y-3">
            <div className="flex flex-col gap-2">
              <p className="font-semibold text-foreground">1. Install the Extension</p>
              <p>Open Chrome and navigate to <code className="bg-muted px-1 py-0.5 rounded text-[10px]">chrome://extensions</code></p>
              <p>Enable <strong className="text-foreground">Developer mode</strong> (toggle in top-right corner)</p>
              <p>Click <strong className="text-foreground">Load unpacked</strong> and select the folder:</p>
              <code className="block bg-muted px-2 py-1.5 rounded text-[10px] font-mono">services/extension/</code>
            </div>

            <div className="flex flex-col gap-2">
              <p className="font-semibold text-foreground">2. Configure the Extension</p>
              <p>Click the extension icon and go to <strong className="text-foreground">Options</strong> (or right-click → Options)</p>
              <p>Set the <strong className="text-foreground">API URL</strong> to your backend server:</p>
              <code className="block bg-muted px-2 py-1.5 rounded text-[10px] font-mono">http://localhost:8000</code>
              <p>If authentication is enabled, paste your <strong className="text-foreground">API Token</strong> from the admin panel.</p>
            </div>

            <div className="flex flex-col gap-2">
              <p className="font-semibold text-foreground">3. Start Collecting</p>
              <p>Log in to the social platform you want to scrape (Instagram, Twitter/X, Facebook).</p>
              <p>Navigate to a profile or feed page. The extension will auto-detect the platform.</p>
              <p>Click the extension popup and hit <strong className="text-foreground">Start Collection</strong>. The extension will auto-scroll,
              click "load more", and send posts to the ingestion API.</p>
            </div>
          </div>

          <div className="flex items-center justify-end">
            <Button variant="outline" size="sm" onClick={load} className="h-8">
              <RefreshCw className="size-3.5 mr-1.5" />Refresh Stats
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Ingestion Feed Tab ────────────────────────────────────────────────────────

function IngestionFeedTab() {
  const [logs, setLogs] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [platformFilter, setPlatformFilter] = useState("all")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [logsData, statsData] = await Promise.all([
        apiClient.getIngestionLogs({
          platform: platformFilter === "all" ? undefined : platformFilter,
          limit: 50,
        }),
        apiClient.getIngestionStats(),
      ])
      setLogs(logsData)
      setStats(statsData)
    } catch {
      setLogs([])
      setStats(null)
    } finally {
      setLoading(false)
    }
  }, [platformFilter])

  useEffect(() => { load() }, [load])

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Posts Today", value: stats?.posts_today ?? 0 },
          { label: "Comments Today", value: stats?.comments_today ?? 0 },
          { label: "Pending AI Review", value: stats?.ai_decisions_pending ?? 0 },
          { label: "Last 7 Days", value: stats?.last_7d ?? 0 },
        ].map((card, i) => (
          <Card key={i} className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{card.label}</p>
              <p className="text-2xl font-bold text-foreground">{card.value.toLocaleString()}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
            Recent Ingested Posts
          </p>
          <Select value={platformFilter} onValueChange={(v) => v && setPlatformFilter(v)}>
            <SelectTrigger className="h-7 w-[130px] bg-input border-border text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Platforms</SelectItem>
              {PLATFORMS.slice(0, 3).map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="h-8">
          <RefreshCw className="size-3.5 mr-1.5" />Refresh
        </Button>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="size-7 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Activity className="size-8 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No ingested posts yet. Use the browser extension to start collecting.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    {["Title", "Platform", "Author", "Status", "Collected", "Engagement"].map((h) => (
                      <th key={h} className="text-left text-muted-foreground font-medium px-4 py-2.5 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground max-w-[250px] truncate">{log.title}</td>
                      <td className="px-4 py-3"><PlatformBadge platform={log.platform} /></td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {log.author_handle || log.author || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${
                          log.status === "pending_ai_review" ? "text-amber-400" :
                          log.status === "pending" ? "text-muted-foreground" : "text-emerald-400"
                        }`}>
                          {log.status === "pending_ai_review" ? <AlertCircle className="size-3" /> :
                           log.status === "processed" ? <CheckCircle2 className="size-3" /> : null}
                          {log.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{fmtRelative(log.collected_at)}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {(log.likes_count || 0) > 0 && <span>{log.likes_count} likes</span>}
                        {(log.comments_count || 0) > 0 && <span className="ml-2">{log.comments_count} comments</span>}
                        {!(log.likes_count || log.comments_count) && "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {stats?.by_platform && Object.keys(stats.by_platform).length > 0 && (
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3">
              Posts by Platform (all time)
            </p>
            <div className="flex flex-wrap gap-3">
              {Object.entries(stats.by_platform).map(([platform, count]) => (
                <div key={platform} className="flex items-center gap-2">
                  <PlatformBadge platform={platform} />
                  <span className="text-sm font-semibold text-foreground">{(count as number).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CollectionPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Collection Manager</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage browser extension collection and monitor ingested data
        </p>
      </div>

      <Tabs defaultValue="extension">
        <TabsList className="mb-4">
          <TabsTrigger value="extension">
            <Puzzle className="size-3.5 mr-1.5" />Extension Setup
          </TabsTrigger>
          <TabsTrigger value="feed">
            <Activity className="size-3.5 mr-1.5" />Ingestion Feed
          </TabsTrigger>
        </TabsList>

        <TabsContent value="extension">
          <ExtensionSetupTab />
        </TabsContent>

        <TabsContent value="feed">
          <IngestionFeedTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
