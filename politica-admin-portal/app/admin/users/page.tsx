"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Search, Plus, Shield, Eye, Edit, Trash2, MoreHorizontal } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

const mockUsers = [
  { id: 1, name: "Arjun Mehta", username: "admin", email: "arjun@politica.in", role: "Super Admin", status: "active", lastLogin: "2026-06-21T10:15:00Z", createdAt: "2025-01-15", permissions: ["read", "write", "delete", "admin"] },
  { id: 2, name: "Priya Sharma", username: "priya_s", email: "priya@politica.in", role: "Analyst", status: "active", lastLogin: "2026-06-21T08:30:00Z", createdAt: "2025-03-22", permissions: ["read", "write"] },
  { id: 3, name: "Vikram Nair", username: "vikram_n", email: "vikram@politica.in", role: "Researcher", status: "active", lastLogin: "2026-06-20T16:45:00Z", createdAt: "2025-04-10", permissions: ["read"] },
  { id: 4, name: "Kavya Reddy", username: "kavya_r", email: "kavya@politica.in", role: "Editor", status: "inactive", lastLogin: "2026-06-15T12:00:00Z", createdAt: "2025-05-01", permissions: ["read", "write"] },
  { id: 5, name: "Rajan Patel", username: "rajan_p", email: "rajan@politica.in", role: "Viewer", status: "active", lastLogin: "2026-06-21T09:00:00Z", createdAt: "2025-06-12", permissions: ["read"] },
  { id: 6, name: "Sunita Joshi", username: "sunita_j", email: "sunita@politica.in", role: "Analyst", status: "suspended", lastLogin: "2026-06-01T11:20:00Z", createdAt: "2025-02-28", permissions: ["read", "write"] },
]

const roleColors: Record<string, string> = {
  "Super Admin": "bg-primary/15 text-primary border-primary/20",
  "Analyst": "bg-blue-500/15 text-blue-400 border-blue-500/20",
  "Researcher": "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  "Editor": "bg-amber-500/15 text-amber-400 border-amber-500/20",
  "Viewer": "bg-muted text-muted-foreground border-border",
}

const statusColors: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  inactive: "bg-muted text-muted-foreground border-border",
  suspended: "bg-destructive/15 text-destructive border-destructive/20",
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 1) return "Just now"
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function UsersPage() {
  const [search, setSearch] = useState("")
  const filtered = mockUsers.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">User Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage admin users, roles and permissions</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus data-icon="inline-start" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" placeholder="e.g. Priya Sharma" className="bg-background" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="priya@politica.in" className="bg-background" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="username">Username</Label>
                <Input id="username" placeholder="priya_s" className="bg-background" />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm">Cancel</Button>
                <Button size="sm">Create User</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Users", value: mockUsers.length, sub: "registered" },
          { label: "Active", value: mockUsers.filter(u => u.status === "active").length, sub: "currently active" },
          { label: "Inactive", value: mockUsers.filter(u => u.status === "inactive").length, sub: "no recent activity" },
          { label: "Suspended", value: mockUsers.filter(u => u.status === "suspended").length, sub: "access revoked" },
        ].map((s) => (
          <Card key={s.label} className="bg-card border-border">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold text-foreground mt-1">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">All Users</CardTitle>
              <CardDescription>{filtered.length} users found</CardDescription>
            </div>
            <div className="relative w-60">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 bg-background text-sm"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            {filtered.map((user) => (
              <div key={user.id} className="flex items-center gap-4 p-3 rounded-lg border border-border bg-background/50 hover:bg-accent/40 transition-colors">
                <Avatar className="size-9 shrink-0">
                  <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">
                    {user.name.split(" ").map(n => n[0]).join("")}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{user.name}</span>
                    {user.role === "Super Admin" && <Shield className="size-3 text-primary" />}
                  </div>
                  <p className="text-xs text-muted-foreground">@{user.username} · {user.email}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${roleColors[user.role]}`}>{user.role}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${statusColors[user.status]}`}>{user.status}</span>
                  <span className="text-xs text-muted-foreground hidden md:block w-20 text-right">Last: {timeAgo(user.lastLogin)}</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="size-7 p-0">
                        <MoreHorizontal className="size-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-popover border-border">
                      <DropdownMenuItem onSelect={() => {}}><Eye className="size-3.5 mr-2" />View Profile</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => {}}><Edit className="size-3.5 mr-2" />Edit User</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => {}} className="text-destructive focus:text-destructive"><Trash2 className="size-3.5 mr-2" />Remove</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
