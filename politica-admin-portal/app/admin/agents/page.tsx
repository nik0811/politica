"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { apiClient } from "@/lib/api-client"
import {
  Brain, Cpu, Tag, BookMarked, Zap, Loader2, Play, CheckCircle2, AlertCircle, Clock, RefreshCw, FlaskConical, Settings
} from "lucide-react"

const AGENT_ICONS: Record<string, React.ElementType> = {
  sentiment_analysis: Brain,
  entity_extraction: Cpu,
  topic_classification: Tag,
  promise_extraction: BookMarked,
  embedding_generation: Zap,
}

const STATUS_STYLE: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: "Pending", color: "text-muted-foreground", icon: Clock },
  running: { label: "Running", color: "text-[var(--chart-4)]", icon: Loader2 },
  completed: { label: "Completed", color: "text-[var(--chart-3)]", icon: CheckCircle2 },
  failed: { label: "Failed", color: "text-destructive", icon: AlertCircle },
}

const PROVIDER_BADGE: Record<string, { label: string; className: string }> = {
  bedrock:  { label: "Bedrock",  className: "bg-orange-500/15 text-orange-400 border-orange-500/20" },
  ollama:   { label: "Ollama",   className: "bg-green-500/15 text-green-400 border-green-500/20" },
  openai:   { label: "OpenAI",   className: "bg-blue-500/15 text-blue-400 border-blue-500/20" },
}

function providerBadgeProps(provider: string) {
  return PROVIDER_BADGE[provider?.toLowerCase()] ?? { label: provider, className: "bg-muted text-muted-foreground" }
}

function shortModelName(model: string): string {
  const part = model?.split("/").pop() ?? model
  if (part.includes("claude-3-sonnet")) return "Claude 3 Sonnet"
  if (part.includes("claude-3-haiku"))  return "Claude 3 Haiku"
  if (part.includes("claude-3-opus"))   return "Claude 3 Opus"
  if (part.includes("claude-3-5"))      return "Claude 3.5"
  if (part.includes("gpt-4o"))          return "GPT-4o"
  if (part.includes("gpt-4"))           return "GPT-4"
  if (part.includes("gpt-3.5"))         return "GPT-3.5"
  return part
}

export default function AgentsPage() {
  const [jobs, setJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [currentProvider, setCurrentProvider] = useState<string>("")
  const [currentModel, setCurrentModel] = useState<string>("")
  const [llmTesting, setLlmTesting] = useState(false)
  const [llmTestResult, setLlmTestResult] = useState<{ status: "ok" | "error"; message: string } | null>(null)

  const [schedulerEnabled, setSchedulerEnabled] = useState(false)
  const [schedulerHour, setSchedulerHour] = useState(2)
  const [schedulerMinute, setSchedulerMinute] = useState(0)
  const [lastRun, setLastRun] = useState<string | null>(null)
  const [schedulerUpdating, setSchedulerUpdating] = useState(false)
  const [runningDaily, setRunningDaily] = useState(false)
  const [runMessage, setRunMessage] = useState<{ text: string; type: "success" | "error" } | null>(null)

  async function fetchData() {
    try {
      const jobList = await apiClient.getAgentJobs({ limit: 50 }).catch(() => [])
      setJobs(jobList)
    } catch (error) {
      console.error("Failed to fetch agent data:", error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchLLMConfig() {
    try {
      const data = await apiClient.getLLMModels()
      setCurrentProvider(data.current_provider ?? "")
      setCurrentModel(data.current_model ?? "")
    } catch {
      // silently ignore
    }
  }

  async function fetchSchedulerConfig() {
    try {
      const data = await apiClient.getSchedulerConfig()
      setSchedulerEnabled(data.enabled ?? false)
      setSchedulerHour(data.hour ?? 2)
      setSchedulerMinute(data.minute ?? 0)
      setLastRun(data.last_run ?? null)
    } catch {
      // silently ignore
    }
  }

  async function handleTestLLM() {
    setLlmTesting(true)
    setLlmTestResult(null)
    try {
      const data = await apiClient.testLLM()
      setLlmTestResult(
        data.status === "ok"
          ? { status: "ok", message: data.response ?? "OK" }
          : { status: "error", message: data.error ?? "Unknown error" }
      )
    } catch (e: any) {
      setLlmTestResult({ status: "error", message: e?.message ?? "Request failed" })
    } finally {
      setLlmTesting(false)
    }
  }

  async function handleSchedulerToggle() {
    setSchedulerUpdating(true)
    try {
      await apiClient.updateSchedulerConfig({
        enabled: !schedulerEnabled,
        hour: schedulerHour,
        minute: schedulerMinute,
      })
      setSchedulerEnabled(!schedulerEnabled)
    } catch (error) {
      console.error("Failed to update scheduler:", error)
    } finally {
      setSchedulerUpdating(false)
    }
  }

  async function handleSchedulerTimeChange(hour: number, minute: number) {
    setSchedulerUpdating(true)
    try {
      await apiClient.updateSchedulerConfig({
        enabled: schedulerEnabled,
        hour,
        minute,
      })
      setSchedulerHour(hour)
      setSchedulerMinute(minute)
    } catch (error) {
      console.error("Failed to update scheduler time:", error)
    } finally {
      setSchedulerUpdating(false)
    }
  }

  async function handleRunNow() {
    setRunningDaily(true)
    setRunMessage(null)
    try {
      const result = await apiClient.runDailyAgents()
      setLastRun(result.timestamp)
      setRunMessage({
        text: `✓ Processing started. ${result.jobs_created} jobs queued.`,
        type: "success"
      })
      await fetchData()
      setTimeout(() => setRunMessage(null), 5000)
    } catch (error) {
      console.error("Failed to run agents:", error)
      setRunMessage({
        text: "✗ Failed to start processing. Please try again.",
        type: "error"
      })
    } finally {
      setRunningDaily(false)
    }
  }

  useEffect(() => {
    fetchData()
    fetchLLMConfig()
    fetchSchedulerConfig()
  }, [])

  // Auto-poll every 5s when any job is pending or running
  useEffect(() => {
    const hasActive = jobs.some((j) => j.status === "pending" || j.status === "running")
    if (!hasActive) return
    const timer = setInterval(fetchData, 5000)
    return () => clearInterval(timer)
  }, [jobs])

  // Filter to show only active jobs (pending/running) or recent completed
  const activeJobs = jobs.filter(j => j.status === "pending" || j.status === "running")
  const recentCompletedJobs = jobs
    .filter(j => j.status === "completed" || j.status === "failed")
    .slice(0, 10)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">AI Processing</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Automated document and comment analysis
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} className="h-8">
          <RefreshCw className="size-3.5 mr-1.5" />
          Refresh
        </Button>
      </div>

      {/* LLM Provider Status */}
      {currentProvider && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-border bg-card">
          <span className="text-xs font-medium text-muted-foreground">LLM Provider</span>
          <Badge
            variant="outline"
            className={`text-[10px] h-5 px-2 font-semibold border ${providerBadgeProps(currentProvider).className}`}
          >
            {providerBadgeProps(currentProvider).label}
          </Badge>
          <span className="text-xs text-foreground font-medium">{shortModelName(currentModel)}</span>
          <div className="ml-auto flex items-center gap-2">
            {llmTestResult && (
              <span className={`text-xs font-medium ${llmTestResult.status === "ok" ? "text-green-400" : "text-destructive"}`}>
                {llmTestResult.status === "ok" ? "✓ Working" : `✗ ${llmTestResult.message}`}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={handleTestLLM}
              disabled={llmTesting}
            >
              {llmTesting
                ? <Loader2 className="size-3 mr-1.5 animate-spin" />
                : <FlaskConical className="size-3 mr-1.5" />}
              Test
            </Button>
          </div>
        </div>
      )}

      {/* Active Jobs - Only show if there are running jobs */}
      {activeJobs.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3 flex items-center gap-2">
            <Loader2 className="size-3 animate-spin" />
            Currently Processing
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeJobs.map((job) => {
              const Icon = AGENT_ICONS[job.agent_type] || Brain
              const cfg = STATUS_STYLE[job.status] || STATUS_STYLE.pending
              const StatusIcon = cfg.icon
              const progress = job.documents_total > 0 
                ? Math.round((job.documents_processed / job.documents_total) * 100) 
                : 0
              
              return (
                <Card key={job.id} className="bg-card border-border border-l-4 border-l-primary">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Icon className="size-4 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{job.agent_type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}</p>
                        <div className={`flex items-center gap-1 text-xs ${cfg.color}`}>
                          <StatusIcon className={`size-3 ${job.status === "running" ? "animate-spin" : ""}`} />
                          {cfg.label}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Progress</span>
                        <span>{job.documents_processed}/{job.documents_total}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Automation Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Settings className="size-4" />
              Automation Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Auto-process new data</p>
                <p className="text-xs text-muted-foreground">Run agents when new posts are collected</p>
              </div>
              <div className="size-2 rounded-full bg-green-500" title="Always enabled" />
            </div>
            
            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-medium">Scheduled daily run</p>
                  <p className="text-xs text-muted-foreground">Process all pending items at set time</p>
                </div>
                <input
                  type="checkbox"
                  checked={schedulerEnabled}
                  onChange={handleSchedulerToggle}
                  disabled={schedulerUpdating}
                  className="w-4 h-4 rounded border-border"
                />
              </div>

              {schedulerEnabled && (
                <div className="flex items-center gap-2 pl-0">
                  <label className="text-xs text-muted-foreground">Run at:</label>
                  <select
                    value={schedulerHour}
                    onChange={(e) => handleSchedulerTimeChange(parseInt(e.target.value), schedulerMinute)}
                    disabled={schedulerUpdating}
                    className="h-7 text-xs px-2 rounded border border-border bg-input"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{String(i).padStart(2, "0")}</option>
                    ))}
                  </select>
                  <span className="text-xs text-muted-foreground">:</span>
                  <select
                    value={schedulerMinute}
                    onChange={(e) => handleSchedulerTimeChange(schedulerHour, parseInt(e.target.value))}
                    disabled={schedulerUpdating}
                    className="h-7 text-xs px-2 rounded border border-border bg-input"
                  >
                    {[0, 15, 30, 45].map((m) => (
                      <option key={m} value={m}>{String(m).padStart(2, "0")}</option>
                    ))}
                  </select>
                </div>
              )}

              {lastRun && (
                <p className="text-xs text-muted-foreground mt-3">
                  Last run: {new Date(lastRun).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                </p>
              )}
            </div>

            <Button
              size="sm"
              className="w-full"
              onClick={handleRunNow}
              disabled={runningDaily || activeJobs.length > 0}
            >
              {runningDaily ? <Loader2 className="size-3 mr-1.5 animate-spin" /> : <Play className="size-3 mr-1.5" />}
              {activeJobs.length > 0 ? "Processing in progress..." : "Run All Agents Now"}
            </Button>

            {runMessage && (
              <div className={`p-2.5 rounded-lg text-xs ${
                runMessage.type === "success"
                  ? "bg-green-500/10 border border-green-500/20 text-green-600"
                  : "bg-destructive/10 border border-destructive/20 text-destructive"
              }`}>
                {runMessage.text}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Processing Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-4">
              Agents run in sequence on all pending documents and comments:
            </p>
            <div className="space-y-3">
              {[
                { name: "Sentiment Analyzer", desc: "Classifies positive/negative/neutral", icon: Brain },
                { name: "Entity Extractor", desc: "Identifies politicians, parties, places", icon: Cpu },
                { name: "Topic Classifier", desc: "Assigns topic labels", icon: Tag },
                { name: "Promise Extractor", desc: "Detects political commitments", icon: BookMarked },
                { name: "Embedding Generator", desc: "Creates search vectors", icon: Zap },
              ].map((agent, i) => (
                <div key={agent.name} className="flex items-center gap-3">
                  <div className="flex items-center justify-center size-6 rounded bg-muted text-xs font-medium text-muted-foreground">
                    {i + 1}
                  </div>
                  <agent.icon className="size-4 text-primary" />
                  <div className="flex-1">
                    <p className="text-xs font-medium">{agent.name}</p>
                    <p className="text-[10px] text-muted-foreground">{agent.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Completed Jobs */}
      {recentCompletedJobs.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3">Recent Jobs</p>
          <Card className="bg-card border-border">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left text-muted-foreground font-medium px-4 py-2.5 uppercase tracking-wider">Agent</th>
                      <th className="text-left text-muted-foreground font-medium px-4 py-2.5 uppercase tracking-wider">Status</th>
                      <th className="text-left text-muted-foreground font-medium px-4 py-2.5 uppercase tracking-wider">Processed</th>
                      <th className="text-left text-muted-foreground font-medium px-4 py-2.5 uppercase tracking-wider">Completed</th>
                      <th className="text-left text-muted-foreground font-medium px-4 py-2.5 uppercase tracking-wider">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentCompletedJobs.map((job) => {
                      const cfg = STATUS_STYLE[job.status] || STATUS_STYLE.pending
                      const StatusIcon = cfg.icon
                      const durationMs = job.started_at && job.completed_at
                        ? new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()
                        : null
                      const duration = durationMs != null
                        ? durationMs < 60000 ? `${Math.round(durationMs / 1000)}s` : `${Math.round(durationMs / 60000)}m`
                        : "—"
                      return (
                        <tr key={job.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                          <td className="px-4 py-3 text-foreground font-medium">
                            {job.agent_type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                          </td>
                          <td className="px-4 py-3">
                            <div className={`flex items-center gap-1.5 ${cfg.color}`}>
                              <StatusIcon className="size-3" />
                              <span className="capitalize font-medium">{cfg.label}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {job.documents_processed}/{job.documents_total}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                            {job.completed_at
                              ? new Date(job.completed_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })
                              : "—"}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{duration}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty state when no jobs */}
      {activeJobs.length === 0 && recentCompletedJobs.length === 0 && (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="size-10 mx-auto mb-3 text-green-500/50" />
            <p className="text-sm text-muted-foreground">All caught up! No pending processing jobs.</p>
            <p className="text-xs text-muted-foreground mt-1">New data will be processed automatically.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
