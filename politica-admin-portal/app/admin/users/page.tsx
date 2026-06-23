"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { apiClient } from "@/lib/api-client"
import { Search, Plus, Users as UsersIcon, UserCheck, UserX, UserMinus, Mail, Shield, Calendar, Loader2, Trash2 } from "lucide-react"

const ROLES = ["Admin", "Editor", "Analyst", "Viewer"]
const PERMISSIONS = ["read", "write", "delete", "admin"]

const statusConfig = {
  active: { icon: UserCheck, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" },
  inactive: { icon: UserMinus, color: "text-muted-foreground", bg: "bg-muted/20 border-border", badge: "bg-muted text-muted-foreground border-border" },
  suspended: { icon: UserX, color: "text-destructive", bg: "bg-destructive/10 border-destructive/20", badge: "bg-destructive/15 text-destructive border-destructive/20" },
}

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([])
  const [stats, setStats] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newUser, setNewUser] = useState({ name: "", username: "", email: "", role: "Viewer" })

  async function fetchUsers() {
    try {
      setLoading(true)
      const [usersData, statsData] = await Promise.all([
        apiClient.getUsers({ limit: 100, status: statusFilter === "all" ? undefined : statusFilter }),
        apiClient.getUserStats()
      ])
      setUsers(usersData || [])
      setStats(statsData || {})
    } catch (error) {
      console.error("Failed to fetch users:", error)
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [statusFilter])

  async function handleCreate() {
    if (!newUser.name || !newUser.username || !newUser.email) {
      alert("Please fill all required fields")
      return
    }
    try {
      await apiClient.createUser({
        name: newUser.name,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        permissions: ["read"]
      })
      setIsDialogOpen(false)
      setNewUser({ name: "", username: "", email: "", role: "Viewer" })
      fetchUsers()
    } catch (error) {
      console.error("Failed to create user:", error)
      alert("Failed to create user")
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this user?")) return
    try {
      await apiClient.deleteUser(id)
      fetchUsers()
    } catch (error) {
      console.error("Failed to delete user:", error)
    }
  }

  async function handleStatusToggle(user: any) {
    try {
      const newStatus = user.status === "active" ? "inactive" : "active"
      await apiClient.updateUser(user.id, { status: newStatus })
      fetchUsers()
    } catch (error) {
      console.error("Failed to update user:", error)
    }
  }

  const filtered = users.filter(user => {
    const matchSearch = user.name?.toLowerCase().includes(search.toLowerCase()) ||
      user.username?.toLowerCase().includes(search.toLowerCase()) ||
      user.email?.toLowerCase().includes(search.toLowerCase())
    return matchSearch
  })

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
          <h1 className="text-2xl font-semibold text-foreground">User Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage user accounts, roles, and permissions</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-3.5 mr-1.5" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 mt-4">
              <div>
                <label className="text-sm font-medium text-foreground">Full Name</label>
                <Input
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  placeholder="John Doe"
                  className="mt-1.5"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Username</label>
                <Input
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  placeholder="johndoe"
                  className="mt-1.5"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Email</label>
                <Input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="john@example.com"
                  className="mt-1.5"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Role</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="w-full mt-1.5 h-9 px-3 rounded-md border border-border bg-background text-sm"
                >
                  {ROLES.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <Button onClick={handleCreate} className="mt-2">
                Create User
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(["total", "active", "inactive", "suspended"] as const).map(status => {
          const count = stats[status] || 0
          const cfg = status === "total" ? null : statusConfig[status]
          const Icon = cfg?.icon || UsersIcon
          return (
            <Card
              key={status}
              className={`bg-card border-border cursor-pointer transition-colors ${statusFilter === status ? "border-primary/40 bg-primary/5" : "hover:bg-accent/30"}`}
              onClick={() => setStatusFilter(statusFilter === status ? "all" : status)}
            >
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`size-4 ${cfg?.color || "text-primary"}`} />
                  <p className="text-xs text-muted-foreground capitalize">{status}</p>
                </div>
                <p className="text-2xl font-bold text-foreground">{count}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base">All Users</CardTitle>
              <CardDescription>{filtered.length} of {users.length} users</CardDescription>
            </div>
            <div className="relative w-64">
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
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <UsersIcon className="size-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{users.length === 0 ? "No users yet. Create your first user above." : "No users match your search."}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map(user => {
                const cfg = statusConfig[user.status as keyof typeof statusConfig] || statusConfig.active
                const Icon = cfg.icon
                return (
                  <div key={user.id} className={`flex items-center justify-between gap-4 p-3 rounded-lg border transition-colors ${cfg.bg}`}>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Icon className={`size-4 shrink-0 ${cfg.color}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-foreground">{user.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${cfg.badge}`}>{user.status}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          <span className="text-xs text-muted-foreground">@{user.username}</span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Mail className="size-3" />
                            {user.email}
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Shield className="size-3" />
                            {user.role}
                          </span>
                          {user.last_login && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="size-3" />
                              Last login: {new Date(user.last_login).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStatusToggle(user)}
                      >
                        {user.status === "active" ? "Deactivate" : "Activate"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(user.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
