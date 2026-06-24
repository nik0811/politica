"use client"

import { useState, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { useTheme } from "@/lib/theme-context"
import { Separator } from "@/components/ui/separator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  LogOut,
  User,
  Settings,
  ChevronRight,
  Sun,
  Moon,
  Monitor,
  Wifi,
  WifiOff,
} from "lucide-react"
import { cn } from "@/lib/utils"

const PAGE_TITLES: Record<string, string> = {
  "/admin":             "Dashboard",
  "/admin/analytics":   "Analytics",
  "/admin/logs":        "Activity Log",
  "/admin/documents":   "Documents",
  "/admin/topics":      "Topics",
  "/admin/promises":    "Promises",
  "/admin/entities":    "Entities",
  "/admin/summaries":   "Summaries",
  "/admin/geographic":  "Geographic View",
  "/admin/media":       "Media Library",
  "/admin/research":    "Research Assistant",
  "/admin/workspaces":  "Workspaces",
  "/admin/users":       "Users",
  "/admin/settings":    "Settings",
}

const THEME_OPTIONS = [
  { value: "light",  label: "Light",  icon: Sun },
  { value: "dark",   label: "Dark",   icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const

export function AdminHeader() {
  const pathname = usePathname()
  const { username, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const title = PAGE_TITLES[pathname] ?? "Admin"
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    setIsOnline(navigator.onLine)

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  const handleLogout = () => {
    logout()
    router.replace("/login")
  }

  return (
    <header className="h-14 flex items-center gap-3 px-4 border-b border-border bg-background/90 backdrop-blur-sm sticky top-0 z-20 shrink-0">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm min-w-0">
        <span className="text-muted-foreground/60 hidden sm:block shrink-0">Politica</span>
        <ChevronRight className="size-3 text-muted-foreground/30 hidden sm:block shrink-0" />
        <span className="font-medium text-foreground truncate">{title}</span>
      </div>

      <div className="flex items-center gap-1.5 ml-auto">
        {/* Internet status */}
        <div className={cn(
          "hidden md:flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full select-none border",
          isOnline 
            ? "text-emerald-600 bg-emerald-500/10 border-emerald-500/20" 
            : "text-red-500 bg-red-500/10 border-red-500/20"
        )}>
          {isOnline ? (
            <>
              <Wifi className="size-3" />
              Online
            </>
          ) : (
            <>
              <WifiOff className="size-3" />
              Offline
            </>
          )}
        </div>

        {/* Theme switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex items-center justify-center size-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors outline-none"
            aria-label="Switch theme"
          >
            {theme === "light"  && <Sun className="size-4" />}
            {theme === "dark"   && <Moon className="size-4" />}
            {theme === "system" && <Monitor className="size-4" />}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <div className="px-1.5 py-1 text-xs font-normal text-muted-foreground">
              Appearance
            </div>
            {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
              <DropdownMenuItem
                key={value}
                onClick={() => setTheme(value)}
                className={cn(
                  "gap-2.5 text-sm cursor-pointer",
                  theme === value && "text-primary font-medium"
                )}
              >
                <Icon className="size-3.5" />
                {label}
                {theme === value && (
                  <span className="ml-auto size-1.5 rounded-full bg-primary" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Separator orientation="vertical" className="h-5 mx-0.5" />

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex items-center gap-2 h-8 px-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors outline-none"
          >
            <div className="size-6 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center text-[11px] font-bold text-primary uppercase shrink-0">
              {username?.[0] ?? "A"}
            </div>
            <span className="text-sm hidden sm:block font-medium text-foreground">
              {username}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-1.5 py-1 text-xs text-muted-foreground font-normal">
              Signed in as
            </div>
            <div className="px-1.5 pb-1 text-sm font-semibold">
              {username}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 text-sm cursor-pointer"
              onClick={() => router.push("/admin/settings")}
            >
              <Settings className="size-3.5" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2 text-sm cursor-pointer"
              onClick={() => router.push("/admin/users")}
            >
              <User className="size-3.5" />
              Users
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 text-sm cursor-pointer text-destructive focus:text-destructive"
              onClick={handleLogout}
            >
              <LogOut className="size-3.5" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
