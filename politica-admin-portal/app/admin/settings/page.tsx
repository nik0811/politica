"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Save, RefreshCw, Globe, Bell, Database, Shield, Cpu, Languages } from "lucide-react"

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {description && <span className="text-xs text-muted-foreground">{description}</span>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

export default function SettingsPage() {
  const [saved, setSaved] = useState(false)
  const [notifEmail, setNotifEmail] = useState(true)
  const [notifSlack, setNotifSlack] = useState(false)
  const [autoProcess, setAutoProcess] = useState(true)
  const [nlpEnabled, setNlpEnabled] = useState(true)
  const [multiLang, setMultiLang] = useState(true)
  const [darkMode, setDarkMode] = useState(true)
  const [twoFactor, setTwoFactor] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Configure platform preferences and system settings</p>
        </div>
        <Button size="sm" onClick={handleSave} variant={saved ? "secondary" : "default"}>
          <Save data-icon="inline-start" />
          {saved ? "Saved!" : "Save Changes"}
        </Button>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="bg-muted/50 border border-border h-9">
          <TabsTrigger value="general" className="text-xs h-7">General</TabsTrigger>
          <TabsTrigger value="notifications" className="text-xs h-7">Notifications</TabsTrigger>
          <TabsTrigger value="processing" className="text-xs h-7">Processing</TabsTrigger>
          <TabsTrigger value="security" className="text-xs h-7">Security</TabsTrigger>
          <TabsTrigger value="api" className="text-xs h-7">API Keys</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Globe className="size-4 text-primary" />
                  <CardTitle className="text-base">Platform Info</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="platform-name">Platform Name</Label>
                  <Input id="platform-name" defaultValue="Politica" className="bg-background" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="org-name">Organisation</Label>
                  <Input id="org-name" defaultValue="Politica Intelligence Labs" className="bg-background" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Input id="timezone" defaultValue="Asia/Kolkata (IST +5:30)" className="bg-background" />
                </div>
                <Separator className="bg-border" />
                <SettingRow label="Dark Mode" description="Always use dark interface">
                  <Switch checked={darkMode} onCheckedChange={setDarkMode} />
                </SettingRow>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Languages className="size-4 text-primary" />
                  <CardTitle className="text-base">Language & Region</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <Separator className="bg-border mb-3" />
                <SettingRow label="Multi-language Support" description="Enable Hindi, Bengali, Telugu, Tamil NLP">
                  <Switch checked={multiLang} onCheckedChange={setMultiLang} />
                </SettingRow>
                <Separator className="bg-border my-2" />
                <SettingRow label="Transliteration" description="Auto-convert Hinglish to Hindi">
                  <Switch defaultChecked />
                </SettingRow>
                <Separator className="bg-border my-2" />
                <SettingRow label="English UI" description="Interface language">
                  <Switch defaultChecked />
                </SettingRow>
                <Separator className="bg-border my-2" />
                <div className="mt-4 flex flex-col gap-1.5">
                  <Label htmlFor="default-lang">Default Analysis Language</Label>
                  <Input id="default-lang" defaultValue="Hindi" className="bg-background" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="notifications" className="mt-4">
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Bell className="size-4 text-primary" />
                <CardTitle className="text-base">Notification Preferences</CardTitle>
              </div>
              <CardDescription>Control how and when you receive alerts</CardDescription>
            </CardHeader>
            <CardContent>
              {[
                { label: "Email Notifications", description: "Receive alerts via email", state: notifEmail, setter: setNotifEmail },
                { label: "Slack Integration", description: "Push alerts to Slack channels", state: notifSlack, setter: setNotifSlack },
                { label: "New Document Alerts", description: "When a new document is processed", state: true, setter: () => {} },
                { label: "Failed Processing Alerts", description: "When document processing fails", state: true, setter: () => {} },
                { label: "Low Confidence Flags", description: "NLP confidence score drops below 0.7", state: false, setter: () => {} },
                { label: "Daily Digest", description: "Summary email at 9:00 AM IST", state: true, setter: () => {} },
              ].map((item, i) => (
                <div key={i}>
                  <SettingRow label={item.label} description={item.description}>
                    <Switch checked={item.state} onCheckedChange={item.setter} />
                  </SettingRow>
                  {i < 5 && <Separator className="bg-border" />}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="processing" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Cpu className="size-4 text-primary" />
                  <CardTitle className="text-base">NLP Pipeline</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <SettingRow label="Auto-Process Documents" description="Process new documents immediately">
                  <Switch checked={autoProcess} onCheckedChange={setAutoProcess} />
                </SettingRow>
                <Separator className="bg-border my-2" />
                <SettingRow label="NLP Enrichment" description="Extract entities, topics, sentiment">
                  <Switch checked={nlpEnabled} onCheckedChange={setNlpEnabled} />
                </SettingRow>
                <Separator className="bg-border my-2" />
                <SettingRow label="Promise Detection" description="Auto-extract political promises">
                  <Switch defaultChecked />
                </SettingRow>
                <Separator className="bg-border my-2" />
                <SettingRow label="Summarisation" description="Generate AI summaries automatically">
                  <Switch defaultChecked />
                </SettingRow>
                <Separator className="bg-border mt-2 mb-4" />
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="min-confidence">Min. Confidence Threshold</Label>
                  <Input id="min-confidence" defaultValue="0.75" className="bg-background" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Database className="size-4 text-primary" />
                  <CardTitle className="text-base">Storage & Retention</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {[
                  { label: "Archive After 90 Days", description: "Move old docs to cold storage" },
                  { label: "Delete Failed Jobs", description: "Remove failed tasks after 7 days" },
                  { label: "Compress Media", description: "Auto-compress uploaded images" },
                  { label: "Backup Daily", description: "Automated daily database backup" },
                ].map((item, i) => (
                  <div key={i}>
                    <SettingRow label={item.label} description={item.description}>
                      <Switch defaultChecked={i < 2} />
                    </SettingRow>
                    {i < 3 && <Separator className="bg-border my-2" />}
                  </div>
                ))}
                <Separator className="bg-border mt-2 mb-4" />
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="retention">Data Retention Period (days)</Label>
                  <Input id="retention" defaultValue="365" className="bg-background" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="security" className="mt-4">
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Shield className="size-4 text-primary" />
                <CardTitle className="text-base">Security & Access</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <SettingRow label="Two-Factor Authentication" description="Require 2FA for all admin users">
                <Switch checked={twoFactor} onCheckedChange={setTwoFactor} />
              </SettingRow>
              <Separator className="bg-border my-2" />
              <SettingRow label="Session Timeout" description="Auto-logout after 30 minutes of inactivity">
                <Switch defaultChecked />
              </SettingRow>
              <Separator className="bg-border my-2" />
              <SettingRow label="IP Allowlist" description="Restrict access to specific IP ranges">
                <Switch />
              </SettingRow>
              <Separator className="bg-border my-2" />
              <SettingRow label="Audit Log" description="Record all admin actions">
                <Switch defaultChecked />
              </SettingRow>
              <Separator className="bg-border mt-2 mb-4" />
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label>Change Admin Password</Label>
                  <Input type="password" placeholder="New password" className="bg-background" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Input type="password" placeholder="Confirm new password" className="bg-background" />
                </div>
                <Button variant="outline" size="sm" className="w-fit">Update Password</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api" className="mt-4">
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">API Configuration</CardTitle>
              <CardDescription>Manage service integrations and API keys</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                {[
                  { service: "OpenAI API", key: "sk-proj-••••••••••••••••••••••••eF3a", status: "active" },
                  { service: "Hugging Face", key: "hf_••••••••••••••••••••••••QwRt", status: "active" },
                  { service: "Google Maps API", key: "AIza••••••••••••••••••••••••mN8x", status: "active" },
                  { service: "Twitter/X API v2", key: "AAAA••••••••••••••••••••••••Bp9k", status: "inactive" },
                  { service: "Telegram Bot API", key: "6547••••••••••••••••••••••••xPq2", status: "active" },
                ].map((api, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-background border border-border">
                    <div>
                      <p className="text-sm font-medium text-foreground">{api.service}</p>
                      <p className="text-xs font-mono text-muted-foreground mt-0.5">{api.key}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${api.status === "active" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" : "bg-muted text-muted-foreground border-border"}`}>
                        {api.status}
                      </span>
                      <Button variant="outline" size="sm" className="h-7 text-xs">
                        <RefreshCw className="size-3 mr-1" />
                        Rotate
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
