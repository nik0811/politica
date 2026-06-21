"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { useTheme } from "@/lib/theme-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Shield, Eye, EyeOff, AlertCircle, Sun, Moon, Monitor } from "lucide-react"

export default function LoginPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const { theme, setTheme } = useTheme()
  const router = useRouter()

  const cycleTheme = () => {
    const order = ["light", "dark", "system"] as const
    const next = order[(order.indexOf(theme) + 1) % order.length]
    setTheme(next)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    await new Promise((r) => setTimeout(r, 600))
    const ok = login(username, password)
    if (ok) {
      router.replace("/admin")
    } else {
      setError("Invalid username or password.")
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Background grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(88,101,242,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(88,101,242,0.03)_1px,transparent_1px)] bg-[size:48px_48px]" />

      {/* Theme toggle — top right */}
      <button
        onClick={cycleTheme}
        aria-label="Toggle theme"
        className="absolute top-4 right-4 flex items-center justify-center size-8 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
      >
        {theme === "light"  && <Sun className="size-4" />}
        {theme === "dark"   && <Moon className="size-4" />}
        {theme === "system" && <Monitor className="size-4" />}
      </button>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="size-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Shield className="size-7 text-primary" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold text-foreground tracking-tight">Politica Platform</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Political Intelligence Admin Panel</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-2xl shadow-black/40">
          <h2 className="text-sm font-medium text-muted-foreground mb-5 uppercase tracking-widest">Administrator Sign In</h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="username" className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Username</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="bg-input border-border h-10 text-sm"
                autoComplete="username"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password" className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="bg-input border-border h-10 text-sm pr-10"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                <AlertCircle className="size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading || !username || !password}
              className="h-10 w-full mt-1 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="size-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Authenticating…
                </span>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-5 pb-1">
            Demo: <span className="text-foreground font-mono">admin</span> / <span className="text-foreground font-mono">politica2026</span>
          </p>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Secured access — authorized personnel only
        </p>
      </div>
    </div>
  )
}
