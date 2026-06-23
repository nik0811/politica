"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { apiClient } from "@/lib/api-client"
import { Settings as SettingsIcon, Save, CheckCircle, Loader2, Bell, Shield, Cpu, Globe, Brain, RefreshCw, Wifi, WifiOff, Key, Plus, Copy, Check, Trash2, AlertTriangle } from "lucide-react"

const categoryIcons = {
  general: Globe,
  notifications: Bell,
  processing: Cpu,
  security: Shield,
}

interface LLMModel {
  id: string
  provider: string
  name: string
  description: string
  available: boolean
}

interface LLMInfo {
  current_provider: string
  current_model: string
  models: LLMModel[]
}

const providerColors: Record<string, string> = {
  ollama: "bg-green-500/10 text-green-600 border-green-500/20",
  openai: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  bedrock: "bg-orange-500/10 text-orange-600 border-orange-500/20",
}

interface ApiToken {
  id: string
  name: string
  description: string | null
  token_prefix: string
  is_active: boolean
  created_at: string
  last_used_at: string | null
  expires_at: string | null
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [llmInfo, setLlmInfo] = useState<LLMInfo | null>(null)
  const [llmStatus, setLlmStatus] = useState<"idle" | "testing" | "ok" | "error">("idle")
  const [llmTestResponse, setLlmTestResponse] = useState<string | null>(null)
  const [llmLoading, setLlmLoading] = useState(false)

  // API Tokens state
  const [tokens, setTokens] = useState<ApiToken[]>([])
  const [tokensLoading, setTokensLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showTokenDialog, setShowTokenDialog] = useState(false)
  const [newRawToken, setNewRawToken] = useState("")
  const [copied, setCopied] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [formName, setFormName] = useState("")
  const [formDescription, setFormDescription] = useState("")
  const [formExpiry, setFormExpiry] = useState("")

  async function fetchSettings() {
    try {
      setLoading(true)
      const data = await apiClient.getAllSettings()
      setSettings(data || {})
    } catch (error) {
      console.error("Failed to fetch settings:", error)
      setSettings({})
    } finally {
      setLoading(false)
    }
  }

  async function fetchLLMInfo() {
    try {
      setLlmLoading(true)
      const data = await apiClient.getLLMProviderConfig()
      console.log("LLM Config Response:", data)
      setLlmInfo({
        current_provider: data.active_provider,
        current_model: data.active_model,
        models: data.available_models
      })
    } catch (error) {
      console.error("Failed to fetch LLM info:", error)
    } finally {
      setLlmLoading(false)
    }
  }

  async function handleTestLLM() {
    setLlmStatus("testing")
    setLlmTestResponse(null)
    try {
      const result = await apiClient.testLLM()
      if (result.status === "ok") {
        setLlmStatus("ok")
        setLlmTestResponse(result.response)
      } else {
        setLlmStatus("error")
        setLlmTestResponse(result.error || "Unknown error")
      }
    } catch (error: any) {
      setLlmStatus("error")
      setLlmTestResponse(error?.message || "Request failed")
    }
  }

  useEffect(() => {
    fetchSettings()
    fetchLLMInfo()
    fetchTokens()
  }, [])

  // API Tokens functions
  async function fetchTokens() {
    try {
      setTokensLoading(true)
      const data = await apiClient.getApiTokens()
      setTokens(data)
    } catch (error) {
      console.error("Failed to fetch tokens:", error)
    } finally {
      setTokensLoading(false)
    }
  }

  async function handleGenerate() {
    if (!formName.trim()) return
    try {
      setGenerating(true)
      const result = await apiClient.generateApiToken({
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        expires_in_days: formExpiry ? parseInt(formExpiry) : undefined,
      })
      setNewRawToken(result.raw_token)
      setShowCreateDialog(false)
      setShowTokenDialog(true)
      setFormName("")
      setFormDescription("")
      setFormExpiry("")
      fetchTokens()
    } catch (error) {
      console.error("Failed to generate token:", error)
    } finally {
      setGenerating(false)
    }
  }

  async function handleToggleActive(token: ApiToken) {
    try {
      await apiClient.updateApiToken(token.id, { is_active: !token.is_active })
      setTokens((prev) =>
        prev.map((t) => (t.id === token.id ? { ...t, is_active: !t.is_active } : t))
      )
    } catch (error) {
      console.error("Failed to toggle token:", error)
    }
  }

  async function handleDeleteToken(tokenId: string) {
    try {
      await apiClient.deleteApiToken(tokenId)
      setTokens((prev) => prev.filter((t) => t.id !== tokenId))
      setDeleteConfirmId(null)
    } catch (error) {
      console.error("Failed to delete token:", error)
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(newRawToken)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function getStatusBadge(token: ApiToken) {
    if (!token.is_active) {
      return <Badge variant="secondary">Revoked</Badge>
    }
    if (token.expires_at && new Date(token.expires_at) < new Date()) {
      return <Badge variant="destructive">Expired</Badge>
    }
    return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Active</Badge>
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "Never"
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  function updateValue(category: string, key: string, value: any) {
    setSettings((prev: any) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: { ...prev[category][key], value }
      }
    }))
  }

  async function handleSave() {
    try {
      setSaving(true)
      await apiClient.bulkUpdateSettings(settings)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (error) {
      console.error("Failed to save settings:", error)
    } finally {
      setSaving(false)
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
          <h1 className="text-2xl font-semibold text-foreground">System Settings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Configure platform behavior and integrations</p>
        </div>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList>
          <TabsTrigger value="general" className="gap-2">
            <SettingsIcon className="size-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="tokens" className="gap-2">
            <Key className="size-4" />
            API Tokens
          </TabsTrigger>
        </TabsList>

        {/* ─── General Settings Tab ─────────────────────────────────────────── */}
        <TabsContent value="general" className="mt-6 space-y-6">
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving || saved}>
              {saving ? (
                <>
                  <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                  Saving...
                </>
              ) : saved ? (
                <>
                  <CheckCircle className="size-3.5 mr-1.5" />
                  Saved
                </>
              ) : (
                <>
                  <Save className="size-3.5 mr-1.5" />
                  Save Changes
                </>
              )}
            </Button>
          </div>

          {/* LLM Provider Section */}
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="size-4 text-primary" />
                  <CardTitle className="text-base">LLM Provider</CardTitle>
                </div>
                <Button variant="ghost" size="sm" onClick={fetchLLMInfo} disabled={llmLoading}>
                  <RefreshCw className={`size-3.5 mr-1.5 ${llmLoading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
              <CardDescription>Unified LLM via LiteLLM — configure via environment variables</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {llmLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading LLM info...
                </div>
              ) : llmInfo ? (
                <>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border/50">
                    <div className="flex flex-col gap-1 flex-1">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Active Configuration</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {llmInfo?.current_provider ? (
                          <>
                            <Badge
                              variant="outline"
                              className={`text-xs capitalize ${providerColors[llmInfo.current_provider] || ""}`}
                            >
                              {llmInfo.current_provider}
                            </Badge>
                            <span className="text-sm font-mono text-foreground">{llmInfo.current_model}</span>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">Loading configuration...</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleTestLLM}
                        disabled={llmStatus === "testing"}
                        className="h-7 text-xs"
                      >
                        {llmStatus === "testing" ? (
                          <><Loader2 className="size-3 mr-1.5 animate-spin" />Testing...</>
                        ) : (
                          "Test LLM"
                        )}
                      </Button>
                      {llmStatus === "ok" && (
                        <span className="flex items-center gap-1 text-xs text-green-600">
                          <Wifi className="size-3" /> Online
                        </span>
                      )}
                      {llmStatus === "error" && (
                        <span className="flex items-center gap-1 text-xs text-destructive">
                          <WifiOff className="size-3" /> Offline
                        </span>
                      )}
                    </div>
                  </div>

                  {llmTestResponse && (
                    <p className={`text-xs px-3 py-2 rounded border ${llmStatus === "ok" ? "bg-green-500/5 border-green-500/20 text-green-700" : "bg-destructive/5 border-destructive/20 text-destructive"}`}>
                      {llmStatus === "ok" ? `Response: "${llmTestResponse}"` : `Error: ${llmTestResponse}`}
                    </p>
                  )}

                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">Available Models</p>
                    <div className="flex flex-col gap-1.5">
                      {llmInfo && llmInfo.models && llmInfo.models.length > 0 ? (
                        llmInfo.models.map((m) => (
                          <div
                            key={m.id}
                            className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm
                              ${m.id === llmInfo.current_model ? "border-primary/30 bg-primary/5" : "border-border/50 bg-muted/20"}`}
                          >
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-foreground">{m.name}</span>
                                {m.id === llmInfo.current_model && (
                                  <Badge variant="outline" className="text-xs h-4 px-1.5 border-primary/40 text-primary">active</Badge>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">{m.description}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className={`size-2 rounded-full ${m.available ? "bg-green-500" : "bg-muted-foreground/40"}`} />
                              <span className={`text-xs ${m.available ? "text-green-600" : "text-muted-foreground"}`}>
                                {m.available ? "Available" : "Offline"}
                              </span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground">No models available</p>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Switch providers by setting <code className="bg-muted px-1 rounded text-xs">LLM_PROVIDER</code> and{" "}
                    <code className="bg-muted px-1 rounded text-xs">LLM_MODEL</code> environment variables and restarting the API.
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Failed to load LLM info. Is the API running?</p>
              )}
            </CardContent>
          </Card>

          {Object.keys(settings).length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="py-12 text-center">
                <SettingsIcon className="size-8 mx-auto mb-3 text-muted-foreground opacity-30" />
                <p className="text-sm text-muted-foreground">No settings configured yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6">
              {Object.entries(settings).map(([category, categorySettings]: [string, any]) => {
                const Icon = categoryIcons[category as keyof typeof categoryIcons] || SettingsIcon
                return (
                  <Card key={category} className="bg-card border-border">
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <Icon className="size-4 text-primary" />
                        <CardTitle className="text-base capitalize">{category}</CardTitle>
                      </div>
                      <CardDescription>Manage {category} configuration</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-col gap-4">
                        {Object.entries(categorySettings).map(([key, setting]: [string, any]) => {
                          const isBool = typeof setting.value === "boolean"
                          const isNumber = typeof setting.value === "number"

                          return (
                            <div key={key} className="flex items-center justify-between gap-4 py-2 border-b border-border/50 last:border-0">
                              <div className="flex-1">
                                <p className="text-sm font-medium text-foreground capitalize">{key.replace(/_/g, " ")}</p>
                                {setting.description && (
                                  <p className="text-xs text-muted-foreground mt-0.5">{setting.description}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {isBool ? (
                                  <Switch
                                    checked={setting.value}
                                    onCheckedChange={(checked) => updateValue(category, key, checked)}
                                  />
                                ) : isNumber ? (
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={setting.value}
                                    onChange={(e) => updateValue(category, key, parseFloat(e.target.value))}
                                    className="w-24 h-8 text-sm"
                                  />
                                ) : (
                                  <Input
                                    value={setting.value}
                                    onChange={(e) => updateValue(category, key, e.target.value)}
                                    className="w-64 h-8 text-sm"
                                  />
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* ─── API Tokens Tab ─────────────────────────────────────────── */}
        <TabsContent value="tokens" className="mt-6 space-y-6">
          <div className="flex justify-end">
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger render={<Button />}>
                <Plus className="size-4 mr-2" />
                Generate New Token
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Generate API Token</DialogTitle>
                  <DialogDescription>
                    Create a new token for authenticating browser extensions or external services.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="token-name">Name</Label>
                    <Input
                      id="token-name"
                      placeholder="e.g. Chrome Extension - Production"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="token-desc">Description (optional)</Label>
                    <Textarea
                      id="token-desc"
                      placeholder="What is this token used for?"
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="token-expiry">Expires in (days, optional)</Label>
                    <Input
                      id="token-expiry"
                      type="number"
                      placeholder="Leave empty for no expiration"
                      value={formExpiry}
                      onChange={(e) => setFormExpiry(e.target.value)}
                      min={1}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleGenerate} disabled={!formName.trim() || generating}>
                    {generating && <Loader2 className="size-4 mr-2 animate-spin" />}
                    Generate Token
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Token reveal dialog */}
          <Dialog open={showTokenDialog} onOpenChange={setShowTokenDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="size-5 text-amber-500" />
                  Token Generated
                </DialogTitle>
                <DialogDescription>
                  Copy this token now. It will not be shown again.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={newRawToken}
                    className="font-mono text-sm"
                  />
                  <Button size="icon" variant="outline" onClick={handleCopy}>
                    {copied ? <Check className="size-4 text-green-600" /> : <Copy className="size-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Store this token securely. You will need to paste it into your browser extension settings.
                </p>
              </div>
              <DialogFooter>
                <Button onClick={() => setShowTokenDialog(false)}>Done</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Tokens table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="size-5" />
                Active Tokens
              </CardTitle>
              <CardDescription>
                Tokens authenticate browser extensions connecting to the ingestion API
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tokensLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              ) : tokens.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Key className="size-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No API tokens yet</p>
                  <p className="text-sm mt-1">Generate a token to connect your browser extension</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Token</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Last Used</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tokens.map((token) => (
                      <TableRow key={token.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{token.name}</p>
                            {token.description && (
                              <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {token.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                            {token.token_prefix}
                          </code>
                        </TableCell>
                        <TableCell>{getStatusBadge(token)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(token.created_at)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(token.last_used_at)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {token.expires_at ? formatDate(token.expires_at) : "Never"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Switch
                              checked={token.is_active}
                              onCheckedChange={() => handleToggleActive(token)}
                            />
                            {deleteConfirmId === token.id ? (
                              <div className="flex items-center gap-1">
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleDeleteToken(token.id)}
                                >
                                  Confirm
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setDeleteConfirmId(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setDeleteConfirmId(token.id)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
