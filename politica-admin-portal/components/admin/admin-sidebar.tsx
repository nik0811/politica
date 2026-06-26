"use client"

import { useState, createContext, useContext } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  FileText,
  BarChart3,
  ImageIcon,
  MessageSquare,
  FolderOpen,
  Settings,
  Shield,
  Activity,
  ChevronRight,
  UserCog,
  PanelLeftClose,
  PanelLeftOpen,
  Radio,
  Brain,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

/* ─── Sidebar collapse context (shared with header trigger) ─── */
interface SidebarCtx { collapsed: boolean; toggle: () => void }
export const SidebarCollapseContext = createContext<SidebarCtx>({ collapsed: false, toggle: () => {} })
export function useSidebarCollapse() { return useContext(SidebarCollapseContext) }

/* ─── Nav definition ─── */
const navGroups = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard",    href: "/admin",           icon: LayoutDashboard },
      { title: "Analytics",    href: "/admin/analytics", icon: BarChart3 },
      { title: "Activity Log", href: "/admin/logs",      icon: Activity },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { title: "Documents",  href: "/admin/documents", icon: FileText },
    ],
  },
  {
    label: "Discover",
    items: [
      { title: "Media Library", href: "/admin/media",  icon: ImageIcon },
    ],
  },
  {
    label: "Research",
    items: [
      { title: "AI Assistant", href: "/admin/assistant",  icon: Brain },
      { title: "Research",     href: "/admin/research",   icon: MessageSquare },
    ],
  },
  {
    label: "Pipeline",
    items: [
      { title: "Collection", href: "/admin/collection", icon: Radio },
      { title: "AI Agents",  href: "/admin/agents",     icon: Brain },
    ],
  },
  {
    label: "System",
    items: [
      { title: "Users",      href: "/admin/users",            icon: UserCog },
      { title: "Settings",   href: "/admin/settings",         icon: Settings },
    ],
  },
]

/* ─── Single nav item ─── */
function NavItem({
  item,
  isActive,
  collapsed,
}: {
  item: { title: string; href: string; icon: React.ElementType }
  isActive: boolean
  collapsed: boolean
}) {
  const Icon = item.icon

  const inner = (
    <Link
      href={item.href}
      className={cn(
        "relative flex items-center gap-2.5 rounded-md text-sm transition-all duration-150 outline-none select-none",
        "focus-visible:ring-2 focus-visible:ring-primary/50",
        collapsed ? "justify-center h-9 w-9 mx-auto" : "h-8 px-2.5 pr-3",
        isActive
          ? "bg-primary/10 text-primary font-medium"
          : "text-sidebar-foreground/55 hover:bg-sidebar-accent hover:text-sidebar-foreground"
      )}
    >
      {isActive && !collapsed && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-3.5 w-[3px] rounded-full bg-primary" />
      )}
      <Icon className={cn("size-4 shrink-0", isActive ? "text-primary" : "text-sidebar-foreground/40")} />
      {!collapsed && <span className="flex-1 truncate leading-none">{item.title}</span>}
      {!collapsed && isActive && <ChevronRight className="size-3 shrink-0 text-primary/50" />}
    </Link>
  )

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{inner}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8} className="text-xs font-medium">
          {item.title}
        </TooltipContent>
      </Tooltip>
    )
  }
  return inner
}

/* ─── Main sidebar ─── */
export function AdminSidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()

  return (
    <SidebarCollapseContext.Provider value={{ collapsed, toggle: () => setCollapsed((p) => !p) }}>
      <aside
        className={cn(
          "relative flex flex-col h-screen bg-sidebar border-r border-sidebar-border shrink-0 transition-[width] duration-300 ease-in-out overflow-hidden",
          collapsed ? "w-[60px]" : "w-[220px]"
        )}
      >
        {/* ── Brand header ── */}
        <div className={cn(
          "flex items-center h-14 border-b border-sidebar-border shrink-0 px-3 gap-2.5",
          collapsed && "justify-center px-0"
        )}>
          <div className="flex items-center justify-center size-8 rounded-lg bg-primary/10 border border-primary/20 shrink-0">
            <Shield className="size-4 text-primary" />
          </div>
          {!collapsed && (
            <div className="flex flex-col gap-0.5 overflow-hidden">
              <span className="text-[13px] font-semibold tracking-tight text-sidebar-foreground leading-none">
                Politica
              </span>
              <span className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground/60 leading-none">
                Admin Panel
              </span>
            </div>
          )}
        </div>

        {/* ── Nav groups ── */}
        <ScrollArea className="flex-1 overflow-hidden">
          <nav className={cn("flex flex-col gap-4 py-3 pb-4", collapsed ? "px-[10px]" : "px-2")}>
            {navGroups.map((group, gi) => (
              <div key={group.label} className="flex flex-col gap-0.5">
                {!collapsed ? (
                  <p className="mb-0.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/40 select-none">
                    {group.label}
                  </p>
                ) : gi > 0 ? (
                  <div className="my-1 h-px bg-sidebar-border/50" />
                ) : null}

                {group.items.map((item) => {
                  const isActive =
                    item.href === "/admin"
                      ? pathname === "/admin"
                      : pathname.startsWith(item.href)
                  return (
                    <NavItem key={item.href} item={item} isActive={isActive} collapsed={collapsed} />
                  )
                })}
              </div>
            ))}
          </nav>
        </ScrollArea>

        {/* ── Footer ── */}
        <div className={cn(
          "flex items-center h-14 border-t border-sidebar-border shrink-0 px-3 gap-2.5",
          collapsed && "justify-center px-0"
        )}>
          <div className="size-7 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
            <span className="text-[11px] font-bold text-primary">A</span>
          </div>
          {!collapsed && (
            <div className="flex flex-col gap-0.5 flex-1 overflow-hidden">
              <span className="text-xs font-medium text-sidebar-foreground leading-none truncate">Admin User</span>
              <span className="text-[10px] text-muted-foreground/50 leading-none truncate">admin@politica.in</span>
            </div>
          )}
        </div>

        {/* ── Collapse toggle button ── */}
        <button
          onClick={() => setCollapsed((p) => !p)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "absolute -right-3 top-[58px] z-10 flex items-center justify-center",
            "size-6 rounded-full border border-sidebar-border bg-sidebar text-muted-foreground",
            "hover:bg-accent hover:text-foreground transition-colors shadow-sm"
          )}
        >
          {collapsed
            ? <PanelLeftOpen className="size-3" />
            : <PanelLeftClose className="size-3" />
          }
        </button>
      </aside>
    </SidebarCollapseContext.Provider>
  )
}
