"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { apiClient, Agent } from "@/lib/api-client"
import {
  Brain, Cpu, Tag, BookMarked, Zap, Loader2, Play, CheckCircle2, AlertCircle, Clock, RefreshCw, FlaskConical
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

// Agents that use the configured LLM provider — no longer needed (provider comes from API)
const PROVIDER_BADGE: Record<string, { label: string; className: string }> = {
  bedrock:  { label: "Bedrock",  className: "bg-orange-500/15 text-orange-400 border-orange-500/20" },
  ollama:   { label: "Ollama",   className: "bg-green-500/15 text-green-400 border-green-500/20" },
  openai:   { label: "OpenAI",   className: "bg-blue-500/15 text-blue-400 border-blue-500/20" },
}

function providerBadgeProps(provider: string) {
  return PROVIDER_BADGE[provider?.toLowerCase()] ?? { label: provider, className: "bg-muted text-muted-foreground" }
}

function shortModelName(model: string): string {
  // e.g. "bedrock/anthropic.claude-3-sonnet-20240229-v1:0" → "Claude 3 Sonnet"
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
  const [agents, setAgents] = useState<Agent[]>([])
  const [jobs, setJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState("")
  const [scope, setScope] = useState<"all" | "pending">("pending")
  const [submitting, setSubmitting] = useState(false)

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
      const [agentList, jobList] = await Promise.all([
        apiClient.getAgents().catch(() => []),
        apiClient.getAgentJobs({ limit: 20 }).catch(() => []),
      ])
      setAgents(agentList)
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
      // silently ignore — LLM config is informational
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
      // silently ignore — scheduler config is informational
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

  async function handleRunDailyNow() {
    setRunningDaily(true)
    setRunMessage(null)
    try {
      const result = await apiClient.runDailyAgents()
      setLastRun(result.timestamp)
      setRunMessage({
        text: "✓ All agents queued for processing. Jobs added to queue for Sentiment Analysis, Entity Extraction, Topic Classification, and Promise Extraction.",
        type: "success"
      })
      await fetchData()
      // Clear message after 5 seconds
      setTimeout(() => setRunMessage(null), 5000)
    } catch (error) {
      console.error("Failed to run daily agents:", error)
      setRunMessage({
        text: "✗ Failed to queue agents. Please try again.",
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

  async function handleRunAgent() {
    if (!selectedAgent) return
    setSubmitting(true)
    try {
      await apiClient.runAgent({ agent_type: selectedAgent, document_ids: scope })
      setDialogOpen(false)
      setSelectedAgent("")
      await fetchData()
    } catch (error) {
      console.error("Failed to run agent:", error)
    } finally {
      setSubmitting(false)
    }
  }

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
          <h1 className="text-lg font-semibold text-foreground">AI Agents</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Run NLP processing agents on collected documents
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} className="h-8">
            <RefreshCw className="size-3.5 mr-1.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* LLM Provider Status Bar */}
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

      {/* Daily Scheduler Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Daily Agent Scheduler</p>
                <p className="text-xs text-muted-foreground mt-0.5">Automatically run all agents daily</p>
              </div>
              <div className={`size-2 rounded-full shrink-0 ${schedulerEnabled ? "bg-green-500" : "bg-muted-foreground/30"}`} />
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={schedulerEnabled}
                  onChange={handleSchedulerToggle}
                  disabled={schedulerUpdating}
                  className="w-4 h-4 rounded border-border"
                />
                <span className="text-xs text-foreground">Enable daily runs</span>
              </div>

              {schedulerEnabled && (
                <div className="flex items-center gap-2 pl-6">
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
                <p className="text-xs text-muted-foreground">
                  Last run: {new Date(lastRun).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                </p>
              )}

              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs w-full mt-2"
                onClick={handleRunDailyNow}
                disabled={runningDaily}
              >
                {runningDaily ? <Loader2 className="size-3 mr-1.5 animate-spin" /> : <Play className="size-3 mr-1.5" />}
                Run Now
              </Button>

              {runMessage && (
                <div className={`mt-3 p-2.5 rounded-lg text-xs ${
                  runMessage.type === "success"
                    ? "bg-green-500/10 border border-green-500/20 text-green-700"
                    : "bg-destructive/10 border border-destructive/20 text-destructive"
                }`}>
                  {runMessage.text}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div>
              <p className="text-sm font-semibold text-foreground mb-3">Daily Agents</p>
              <div className="space-y-2">
                {["Sentiment Analyzer", "Entity Extractor", "Topic Classifier", "Promise Extractor"].map((name) => (
                  <div key={name} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="size-1.5 rounded-full bg-primary/60" />
                    {name}
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Processes all pending documents when scheduler runs
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Agent Cards */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3">Available Agents</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => {
            const Icon = AGENT_ICONS[agent.agent_type] || Brain
            const isLLMAgent = agent.provider && agent.provider !== "local"
            const displayModel = isLLMAgent ? shortModelName(agent.model) : agent.model
            const badge = isLLMAgent ? providerBadgeProps(agent.provider) : null
            return (
              <Card key={agent.agent_type} className="bg-card border-border hover:border-primary/20 transition-colors">
                <CardContent className="p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="size-8 rounded-lg bg-primary/10 border border-primary/15 flex items-center justify-center shrink-0">
                        <Icon className="size-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground leading-tight">{agent.name}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          {badge && (
                            <Badge
                              variant="outline"
                              className={`text-[9px] h-4 px-1.5 font-semibold border ${badge.className}`}
                            >
                              {badge.label}
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-[9px] h-4">{displayModel}</Badge>
                        </div>
                      </div>
                    </div>
                    <span className={`size-2 rounded-full mt-1 shrink-0 ${agent.status === "available" ? "bg-[var(--chart-3)]" : "bg-muted-foreground/30"}`} />
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{agent.description}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs mt-auto"
                    onClick={() => {
                      setSelectedAgent(agent.agent_type)
                      setDialogOpen(true)
                    }}
                  >
                    <Play className="size-3 mr-1.5" />
                    Run Agent
                  </Button>
                </CardContent>
              </Card>
            )
          })}

          {agents.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              <Brain className="size-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No agents available. Check API connection.</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Jobs */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3">Recent Jobs</p>
        <Card className="bg-card border-border">
          <CardContent className="p-0">
            {jobs.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Clock className="size-8 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No jobs yet. Run an agent to get started.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left text-muted-foreground font-medium px-4 py-2.5 uppercase tracking-wider">Job ID</th>
                      <th className="text-left text-muted-foreground font-medium px-4 py-2.5 uppercase tracking-wider">Agent</th>
                      <th className="text-left text-muted-foreground font-medium px-4 py-2.5 uppercase tracking-wider">Status</th>
                      <th className="text-left text-muted-foreground font-medium px-4 py-2.5 uppercase tracking-wider">Progress</th>
                      <th className="text-left text-muted-foreground font-medium px-4 py-2.5 uppercase tracking-wider">Started</th>
                      <th className="text-left text-muted-foreground font-medium px-4 py-2.5 uppercase tracking-wider">Completed</th>
                      <th className="text-left text-muted-foreground font-medium px-4 py-2.5 uppercase tracking-wider">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((job) => {
                      const cfg = STATUS_STYLE[job.status] || STATUS_STYLE.pending
                      const StatusIcon = cfg.icon
                      const agentDef = agents.find((a) => a.agent_type === job.agent_type)
                      const durationMs = job.started_at && job.completed_at
                        ? new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()
                        : null
                      const duration = durationMs != null
                        ? durationMs < 60000 ? `${Math.round(durationMs / 1000)}s` : `${Math.round(durationMs / 60000)}m`
                        : "—"
                      return (
                        <tr key={job.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                          <td className="px-4 py-3 font-mono text-muted-foreground">{job.id.slice(0, 8)}…</td>
                          <td className="px-4 py-3 text-foreground font-medium">{agentDef?.name || job.agent_type}</td>
                          <td className="px-4 py-3">
                            <div className={`flex items-center gap-1.5 ${cfg.color}`}>
                              <StatusIcon className={`size-3 ${job.status === "running" ? "animate-spin" : ""}`} />
                              <span className="capitalize font-medium">{cfg.label}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {job.documents_processed}/{job.documents_total} docs
                          </td>
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                            {job.started_at
                              ? new Date(job.started_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })
                              : "—"}
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
            )}
          </CardContent>
        </Card>
      </div>

      {/* Run Agent Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>Run Agent</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Agent Type</label>
              <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                <SelectTrigger className="h-9 bg-input border-border text-sm">
                  <SelectValue placeholder="Select agent..." />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a.agent_type} value={a.agent_type}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Document Scope</label>
              <Select value={scope} onValueChange={(v) => setScope(v as "all" | "pending")}>
                <SelectTrigger className="h-9 bg-input border-border text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending documents only</SelectItem>
                  <SelectItem value="all">All documents</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleRunAgent} disabled={!selectedAgent || submitting}>
              {submitting ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Play className="size-3.5 mr-1.5" />}
              Run Agent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
