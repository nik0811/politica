import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

interface StatCardProps {
  title: string
  value: string | number
  sub?: string
  icon: LucideIcon
  trend?: string
  trendUp?: boolean
  color?: "blue" | "green" | "orange" | "red" | "purple" | "cyan"
}

const colorMap = {
  blue: "text-[var(--chart-1)] bg-[var(--chart-1)]/10 border-[var(--chart-1)]/20",
  green: "text-[var(--chart-3)] bg-[var(--chart-3)]/10 border-[var(--chart-3)]/20",
  orange: "text-[var(--chart-4)] bg-[var(--chart-4)]/10 border-[var(--chart-4)]/20",
  red: "text-destructive bg-destructive/10 border-destructive/20",
  purple: "text-[var(--chart-5)] bg-[var(--chart-5)]/10 border-[var(--chart-5)]/20",
  cyan: "text-[var(--chart-2)] bg-[var(--chart-2)]/10 border-[var(--chart-2)]/20",
}

export function StatCard({ title, value, sub, icon: Icon, trend, trendUp, color = "blue" }: StatCardProps) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider truncate">{title}</p>
            <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
            {sub && <p className="text-xs text-muted-foreground truncate">{sub}</p>}
          </div>
          <div className={cn("size-10 rounded-lg border flex items-center justify-center shrink-0", colorMap[color])}>
            <Icon className="size-4.5" />
          </div>
        </div>
        {trend && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <span className={cn("text-xs font-medium", trendUp ? "text-[var(--success)]" : "text-destructive")}>
              {trend}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
