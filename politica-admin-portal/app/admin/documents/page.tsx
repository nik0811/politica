"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  ExternalLink,
  Heart,
  MessageCircle,
  Eye,
  Share2,
  Calendar,
  User,
  ChevronLeft,
  ChevronRight,
  Mic,
} from "lucide-react"
import { apiClient, type Document, type PostComment } from "@/lib/api-client"

const PLATFORM_COLOR: Record<string, string> = {
  x: "bg-foreground/10 text-foreground",
  instagram: "bg-[var(--chart-5)]/10 text-[var(--chart-5)]",
  telegram: "bg-[var(--chart-1)]/10 text-[var(--chart-1)]",
  news: "bg-[var(--chart-4)]/10 text-[var(--chart-4)]",
  facebook: "bg-blue-500/10 text-blue-500",
  twitter: "bg-sky-500/10 text-sky-500",
}

const STATUS_CONFIG = {
  processed: { icon: CheckCircle2, badge: "bg-[var(--chart-3)]/10 text-[var(--chart-3)]" },
  processing: { icon: Loader2, badge: "bg-[var(--chart-4)]/10 text-[var(--chart-4)]" },
  failed: { icon: AlertCircle, badge: "bg-destructive/10 text-destructive" },
  pending: { icon: Clock, badge: "bg-muted text-muted-foreground" },
  in_progress: { icon: Loader2, badge: "bg-[var(--chart-1)]/10 text-[var(--chart-1)]" },
}

function getInitials(name?: string, handle?: string): string {
  const source = name || handle || "?"
  return source.replace(/^@/, "").slice(0, 2).toUpperCase()
}

function StatCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg bg-muted/50 px-3 py-2.5 text-center">
      <Icon className="size-4 text-muted-foreground" />
      <p className="text-base font-semibold leading-none">{value.toLocaleString()}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
    </div>
  )
}

function DocumentDrawer({
  doc,
  open,
  onClose,
}: {
  doc: Document | null
  open: boolean
  onClose: () => void
}) {
  const [comments, setComments] = useState<PostComment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)

  useEffect(() => {
    if (!doc) { setComments([]); return }
    setCommentsLoading(true)
    apiClient.getDocumentComments(doc.id, { limit: 100 })
      .then(setComments)
      .catch(() => setComments([]))
      .finally(() => setCommentsLoading(false))
  }, [doc])

  const engagementStats = doc ? [
    { icon: Heart, label: "Likes", value: doc.likes_count },
    { icon: MessageCircle, label: "Comments", value: doc.comments_count },
    { icon: Eye, label: "Views", value: doc.views_count },
    { icon: Share2, label: "Shares", value: doc.shares_count },
  ].filter((s) => (s.value ?? 0) > 0) as { icon: React.ElementType; label: string; value: number }[] : []

  const publishDate = doc?.published_at
    ? new Date(doc.published_at).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : doc?.created_at
    ? new Date(doc.created_at).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : null

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-xl flex flex-col p-0 gap-0" side="right">
        {doc && (
          <>
            {/* Header */}
            <SheetHeader className="px-5 pt-5 pb-4 shrink-0">
              <div className="flex items-start gap-2 flex-wrap">
                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${PLATFORM_COLOR[doc.platform] ?? "bg-muted text-muted-foreground"}`}>
                  {doc.platform}
                </span>
                {(() => {
                  const status = doc.status as keyof typeof STATUS_CONFIG
                  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending
                  const Icon = cfg.icon
                  return (
                    <span className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${cfg.badge}`}>
                      <Icon className="size-2.5" />
                      {doc.status}
                    </span>
                  )
                })()}
              </div>
              <SheetTitle className="text-sm font-semibold leading-snug mt-1">{doc.title}</SheetTitle>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1">
                {(doc.author || doc.author_handle) && (
                  <span className="flex items-center gap-1">
                    <User className="size-3" />
                    <span className="font-medium text-foreground">{doc.author || ""}</span>
                    {doc.author_handle && <span>@{doc.author_handle}</span>}
                  </span>
                )}
                {publishDate && (
                  <span className="flex items-center gap-1">
                    <Calendar className="size-3" />
                    {publishDate}
                  </span>
                )}
                {doc.url && (
                  <a href={doc.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                    <ExternalLink className="size-3" />
                    View post
                  </a>
                )}
              </div>
            </SheetHeader>

            <ScrollArea className="flex-1 min-h-0">
              <div className="px-5 pb-6 flex flex-col gap-5">
                {/* Engagement stats */}
                {engagementStats.length > 0 && (
                  <div className={`grid gap-2 ${engagementStats.length >= 4 ? "grid-cols-4" : `grid-cols-${engagementStats.length}`}`}>
                    {engagementStats.map((s) => (
                      <StatCard key={s.label} icon={s.icon} label={s.label} value={s.value} />
                    ))}
                  </div>
                )}

                <Separator />

                {/* Post content */}
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Post Content</p>
                  <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">{doc.content}</p>
                </div>

                {/* Video Transcription */}
                {doc.transcription && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Mic className="size-3" />
                        Video Transcription
                      </p>
                      <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap bg-muted/40 rounded-md px-3 py-2.5 border border-border/50">
                        {doc.transcription}
                      </p>
                    </div>
                  </>
                )}

                {/* Topics & entities */}
                {((doc.topics?.length ?? 0) > 0 || (doc.entities?.length ?? 0) > 0) && (
                  <>
                    <Separator />
                    <div className="flex flex-col gap-3">
                      {(doc.topics?.length ?? 0) > 0 && (
                        <div>
                          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Topics</p>
                          <div className="flex gap-1 flex-wrap">
                            {doc.topics!.map((t) => (
                              <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {(doc.entities?.length ?? 0) > 0 && (
                        <div>
                          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Entities</p>
                          <div className="flex gap-1 flex-wrap">
                            {doc.entities!.map((e) => (
                              <Badge key={e} variant="outline" className="text-[10px] border-border">{e}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                <Separator />

                {/* Comments */}
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-3">
                    Comments {comments.length > 0 ? `(${comments.length})` : ""}
                  </p>
                  {commentsLoading ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
                      <Loader2 className="size-3.5 animate-spin" />
                      Loading comments…
                    </div>
                  ) : comments.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">No comments collected yet.</p>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {comments.map((c, i) => (
                        <div key={c.id || i} className="flex gap-3">
                          <Avatar className="size-7 shrink-0 mt-0.5">
                            <AvatarFallback className="text-[10px]">
                              {getInitials(c.author, c.author_handle)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-0.5">
                              <div className="flex items-baseline gap-1.5 min-w-0">
                                {c.author && <span className="text-xs font-semibold truncate">{c.author}</span>}
                                {c.author_handle && (
                                  <span className="text-[10px] text-muted-foreground">@{c.author_handle}</span>
                                )}
                                {!c.author && !c.author_handle && (
                                  <span className="text-xs font-semibold text-muted-foreground">Unknown</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {c.likes_count > 0 && (
                                  <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                    <Heart className="size-2.5" />
                                    {c.likes_count}
                                  </span>
                                )}
                                {c.replies_count > 0 && (
                                  <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                    <MessageCircle className="size-2.5" />
                                    {c.replies_count}
                                  </span>
                                )}
                              </div>
                            </div>
                            <p className="text-xs text-foreground/80 leading-relaxed">{c.content}</p>
                            {c.published_at && (
                              <p className="text-[10px] text-muted-foreground mt-1">
                                {new Date(c.published_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterPlatform, setFilterPlatform] = useState<string>("all")
  const [selected, setSelected] = useState<Document | null>(null)
  
  // Pagination state
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const pageSize = 25

  useEffect(() => {
    async function fetchDocuments() {
      try {
        setLoading(true)
        const skip = (page - 1) * pageSize
        const params: any = { skip, limit: pageSize }
        if (filterStatus !== "all") params.status = filterStatus
        if (filterPlatform !== "all") params.platform = filterPlatform
        
        const data = await apiClient.getDocuments(params)
        // If data is undefined, it means we got a 401 and were redirected
        if (!data) {
          setDocuments([])
          return
        }
        setDocuments(data)
        
        // Get total count for pagination
        const allData = await apiClient.getDocuments({ limit: 1 })
        // Estimate total from response or use a separate count endpoint
        setTotalCount(Math.max(data.length + skip, totalCount))
      } catch (error) {
        // Silently handle 401 errors - the redirect will take care of it
        if (error instanceof Error && error.message.includes("Unauthorized")) {
          // Don't log 401 errors as they're expected during logout/token expiry
          return
        }
        console.error("Failed to fetch documents:", error)
        setDocuments([])
      } finally {
        setLoading(false)
      }
    }

    fetchDocuments()
  }, [page, filterStatus, filterPlatform])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [filterStatus, filterPlatform])

  const filtered = documents.filter((d) => {
    const entities = d.entities ?? []
    const matchSearch =
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      (d.author_handle ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (d.author ?? "").toLowerCase().includes(search.toLowerCase()) ||
      entities.some((e) => e.toLowerCase().includes(search.toLowerCase()))
    return matchSearch
  })

  const totalPages = Math.ceil(totalCount / pageSize) || 1

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents, entities, authors…"
            className="pl-8 h-9 bg-input border-border text-sm"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {["all", "processed", "processing", "failed"].map((s) => (
            <Button key={s} size="sm" variant={filterStatus === s ? "default" : "outline"} className="h-8 text-xs capitalize" onClick={() => setFilterStatus(s)}>
              {s}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          {["all", "twitter", "facebook", "instagram"].map((p) => (
            <Button key={p} size="sm" variant={filterPlatform === p ? "default" : "outline"} className="h-8 text-xs capitalize" onClick={() => setFilterPlatform(p)}>
              {p}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-medium">Documents</CardTitle>
              <CardDescription className="text-xs">
                Page {page} of {totalPages} — {filtered.length} records shown
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-xs text-muted-foreground min-w-[60px] text-center">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setPage(p => p + 1)}
                disabled={documents.length < pageSize || loading}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  {["Platform", "Author", "Content", "Engagement", "Topics", "Sentiment", "Status", "Collected"].map((h) => (
                    <th key={h} className="text-left text-muted-foreground font-medium px-4 py-2.5 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((doc) => {
                  const status = doc.status as keyof typeof STATUS_CONFIG
                  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending
                  const Icon = cfg.icon
                  const isSelected = selected?.id === doc.id
                  const topics = doc.topics ?? []
                  const sentiment = doc.sentiment ?? 0
                  const preview = doc.content ? doc.content.slice(0, 80) + (doc.content.length > 80 ? "…" : "") : doc.title
                  return (
                    <tr
                      key={doc.id}
                      className={`border-b border-border/50 cursor-pointer transition-colors ${isSelected ? "bg-primary/5" : "hover:bg-accent/30"}`}
                      onClick={() => setSelected(isSelected ? null : doc)}
                    >
                      {/* Platform */}
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${PLATFORM_COLOR[doc.platform] ?? "bg-muted text-muted-foreground"}`}>
                          {doc.platform}
                        </span>
                      </td>
                      {/* Author */}
                      <td className="px-4 py-3 max-w-[120px]">
                        {doc.author_handle || doc.author ? (
                          <div>
                            {doc.author && <p className="font-medium text-foreground truncate">{doc.author}</p>}
                            {doc.author_handle && <p className="text-muted-foreground truncate">@{doc.author_handle}</p>}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      {/* Content preview */}
                      <td className="px-4 py-3 max-w-[280px]">
                        <div className="flex items-center gap-1.5">
                          {doc.transcription && (
                            <span title="Has video transcription">
                              <Mic className="size-3 shrink-0 text-[var(--chart-1)]" />
                            </span>
                          )}
                          <p className="truncate text-foreground/80">{preview}</p>
                        </div>
                      </td>
                      {/* Engagement */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2.5 text-muted-foreground">
                          {(doc.likes_count ?? 0) > 0 && (
                            <span className="flex items-center gap-0.5">
                              <Heart className="size-3" />
                              {doc.likes_count!.toLocaleString()}
                            </span>
                          )}
                          {(doc.comments_count ?? 0) > 0 && (
                            <span className="flex items-center gap-0.5">
                              <MessageCircle className="size-3" />
                              {doc.comments_count!.toLocaleString()}
                            </span>
                          )}
                          {(doc.shares_count ?? 0) > 0 && (
                            <span className="flex items-center gap-0.5">
                              <Share2 className="size-3" />
                              {doc.shares_count!.toLocaleString()}
                            </span>
                          )}
                          {(doc.views_count ?? 0) > 0 && (
                            <span className="flex items-center gap-0.5">
                              <Eye className="size-3" />
                              {doc.views_count!.toLocaleString()}
                            </span>
                          )}
                          {!(doc.likes_count ?? 0) && !(doc.comments_count ?? 0) && !(doc.shares_count ?? 0) && !(doc.views_count ?? 0) && (
                            <span>—</span>
                          )}
                        </div>
                      </td>
                      {/* Topics */}
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {topics.slice(0, 2).map((t) => (
                            <Badge key={t} variant="secondary" className="text-[10px] h-4 px-1.5">{t}</Badge>
                          ))}
                          {topics.length === 0 && <span className="text-[10px] text-muted-foreground">—</span>}
                        </div>
                      </td>
                      {/* Sentiment */}
                      <td className="px-4 py-3">
                        <span className={`font-medium ${sentiment > 0.3 ? "text-[var(--chart-3)]" : sentiment < -0.3 ? "text-destructive" : "text-muted-foreground"}`}>
                          {sentiment !== null && sentiment !== undefined ? (
                            sentiment > 0 ? `+${sentiment.toFixed(2)}` : sentiment.toFixed(2)
                          ) : "—"}
                        </span>
                      </td>
                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full w-fit ${cfg.badge}`}>
                          <Icon className="size-2.5" />
                          {doc.status}
                        </span>
                      </td>
                      {/* Collected date */}
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {new Date(doc.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-xs text-muted-foreground">
                      {documents.length === 0 ? "No documents yet. Start collecting!" : "No documents match your filters."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Bottom Pagination */}
          {filtered.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, ((page - 1) * pageSize) + filtered.length)} of {totalCount} documents
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-3 text-xs"
                  onClick={() => setPage(1)}
                  disabled={page === 1 || loading}
                >
                  First
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1 || loading}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="text-xs text-muted-foreground min-w-[80px] text-center">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setPage(p => p + 1)}
                  disabled={documents.length < pageSize || loading}
                >
                  <ChevronRight className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-3 text-xs"
                  onClick={() => setPage(totalPages)}
                  disabled={page >= totalPages || documents.length < pageSize || loading}
                >
                  Last
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Document detail drawer */}
      <DocumentDrawer doc={selected} open={!!selected} onClose={() => setSelected(null)} />
    </div>
  )
}
