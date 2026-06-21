"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FolderOpen, Search, BookMarked, StickyNote, Clock, Plus, X } from "lucide-react"
import { workspaces } from "@/lib/mock-data"

export default function WorkspacesPage() {
  const [search, setSearch] = useState("")
  const [openWorkspace, setOpenWorkspace] = useState<typeof workspaces[0] | null>(null)
  const [showNew, setShowNew] = useState(false)

  const filtered = workspaces.filter((w) =>
    w.name.toLowerCase().includes(search.toLowerCase()) ||
    w.description.toLowerCase().includes(search.toLowerCase()) ||
    w.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="flex flex-col gap-6">
      {/* Header actions */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search workspaces…" className="pl-8 h-9 bg-input border-border text-sm" />
        </div>
        <Button size="sm" className="h-9 gap-1.5" onClick={() => setShowNew(true)}>
          <Plus className="size-3.5" /> New Workspace
        </Button>
      </div>

      {/* Workspace grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((ws) => (
          <Card key={ws.id} className="bg-card border-border hover:border-primary/30 transition-colors cursor-pointer" onClick={() => setOpenWorkspace(ws)}>
            <CardContent className="p-5 flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="size-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <FolderOpen className="size-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{ws.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{ws.description}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs text-center">
                <div className="bg-muted/40 rounded-lg p-2.5">
                  <Search className="size-3.5 mx-auto text-[var(--chart-1)] mb-1" />
                  <p className="font-bold text-foreground">{ws.savedQueries}</p>
                  <p className="text-muted-foreground text-[10px]">Queries</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-2.5">
                  <StickyNote className="size-3.5 mx-auto text-[var(--chart-4)] mb-1" />
                  <p className="font-bold text-foreground">{ws.annotations}</p>
                  <p className="text-muted-foreground text-[10px]">Notes</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-2.5">
                  <Clock className="size-3.5 mx-auto text-muted-foreground mb-1" />
                  <p className="font-bold text-foreground text-[10px]">{new Date(ws.lastUpdated).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</p>
                  <p className="text-muted-foreground text-[10px]">Updated</p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-1">
                  {ws.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
                  ))}
                </div>
                <span className="text-[10px] text-muted-foreground">{ws.owner}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Workspace detail dialog */}
      <Dialog open={!!openWorkspace} onOpenChange={() => setOpenWorkspace(null)}>
        <DialogContent className="bg-card border-border max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="size-5 text-primary" />
              {openWorkspace?.name}
            </DialogTitle>
          </DialogHeader>
          {openWorkspace && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">{openWorkspace.description}</p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-muted/40 rounded-xl p-4">
                  <p className="text-2xl font-bold text-foreground">{openWorkspace.savedQueries}</p>
                  <p className="text-xs text-muted-foreground mt-1">Saved Queries</p>
                </div>
                <div className="bg-muted/40 rounded-xl p-4">
                  <p className="text-2xl font-bold text-foreground">{openWorkspace.annotations}</p>
                  <p className="text-xs text-muted-foreground mt-1">Annotations</p>
                </div>
                <div className="bg-muted/40 rounded-xl p-4">
                  <p className="text-2xl font-bold text-foreground">{openWorkspace.tags.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">Tags</p>
                </div>
              </div>
              <div className="flex flex-col gap-2 text-xs">
                <div className="flex justify-between py-2 border-b border-border/50">
                  <span className="text-muted-foreground">Owner</span>
                  <span className="text-foreground font-medium">{openWorkspace.owner}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border/50">
                  <span className="text-muted-foreground">Last Updated</span>
                  <span className="text-foreground font-medium">{new Date(openWorkspace.lastUpdated).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">Tags</span>
                  <div className="flex gap-1">{openWorkspace.tags.map((t) => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}</div>
                </div>
              </div>
              <div className="flex gap-2 mt-2">
                <Button size="sm" className="h-8 text-xs flex-1">Open Workspace</Button>
                <Button size="sm" variant="outline" className="h-8 text-xs">Export</Button>
                <Button size="sm" variant="outline" className="h-8 text-xs text-destructive hover:text-destructive">Delete</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* New workspace dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Workspace</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Name</label>
              <Input placeholder="e.g. UP Election 2027" className="bg-input border-border h-9 text-sm" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Description</label>
              <Input placeholder="What is this workspace for?" className="bg-input border-border h-9 text-sm" />
            </div>
            <div className="flex gap-2 mt-2">
              <Button size="sm" className="h-9 flex-1 text-sm">Create Workspace</Button>
              <Button size="sm" variant="outline" className="h-9 text-sm" onClick={() => setShowNew(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
