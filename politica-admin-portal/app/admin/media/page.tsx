"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { apiClient } from "@/lib/api-client"
import { ImageIcon, Search, Loader2, ExternalLink, User } from "lucide-react"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

function formatDate(iso: string | null): string {
  if (!iso) return ""
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
  } catch {
    return ""
  }
}

export default function MediaPage() {
  const [mediaItems, setMediaItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [selectedItem, setSelectedItem] = useState<any | null>(null)

  useEffect(() => {
    async function fetchMedia() {
      try {
        setLoading(true)
        const data = await apiClient.getMediaGallery({ limit: 50 })
        setMediaItems(data.items || [])
      } catch (error) {
        console.error("Failed to fetch media:", error)
        setMediaItems([])
      } finally {
        setLoading(false)
      }
    }

    fetchMedia()
  }, [])

  const filtered = mediaItems.filter((item) =>
    item.title?.toLowerCase().includes(search.toLowerCase()) ||
    item.content?.toLowerCase().includes(search.toLowerCase()) ||
    item.author_handle?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Media Gallery</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Screenshots captured from collected posts — visual proof of collection
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, content, or author…"
            className="pl-8 h-9 bg-input border-border text-sm"
          />
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {filtered.filter((i) => i.has_screenshot).length} with screenshot
        </span>
      </div>

      {filtered.length === 0 ? (
        <Card className="border-border bg-card">
          <CardContent className="p-12 text-center">
            <ImageIcon className="size-12 mx-auto mb-4 text-muted-foreground/30" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {mediaItems.length === 0 ? "No Media Yet" : "No Results"}
            </h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {mediaItems.length === 0
                ? "Use the browser extension to collect posts — screenshots will appear here automatically."
                : "No media items match your search."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map((item) => (
              <Card
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="bg-card border-border hover:border-primary/30 transition-colors overflow-hidden cursor-pointer group"
              >
                <div className="h-40 bg-gradient-to-br from-muted to-muted-foreground/10 flex items-center justify-center relative overflow-hidden">
                  {item.screenshot_url ? (
                    <img
                      src={`${API_BASE}${item.screenshot_url}`}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        const target = e.currentTarget
                        target.style.display = "none"
                        target.nextElementSibling?.classList.remove("hidden")
                      }}
                    />
                  ) : null}
                  <ImageIcon className={`size-8 text-muted-foreground/30 ${item.screenshot_url ? "hidden" : ""}`} />
                  <Badge
                    variant="secondary"
                    className="absolute top-2 left-2 text-[10px] capitalize"
                  >
                    {item.platform}
                  </Badge>
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="absolute top-2 right-2 bg-black/50 rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <ExternalLink className="size-3 text-white" />
                    </a>
                  )}
                </div>
                <CardContent className="p-3 flex flex-col gap-1.5">
                  <p className="text-xs font-medium text-foreground truncate">{item.title}</p>
                  {item.author_handle && (
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <User className="size-2.5" />
                      <span className="truncate">@{item.author_handle}</span>
                    </div>
                  )}
                  {item.published_at && (
                    <p className="text-[10px] text-muted-foreground">{formatDate(item.published_at)}</p>
                  )}
                  {item.topics && item.topics.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {item.topics.slice(0, 2).map((topic: string) => (
                        <Badge key={topic} variant="outline" className="text-[9px] h-4">
                          {topic}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Lightbox */}
          {selectedItem && (
            <div
              className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
              onClick={() => setSelectedItem(null)}
            >
              <div
                className="bg-card rounded-lg overflow-hidden max-w-2xl w-full max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                {selectedItem.screenshot_url ? (
                  <img
                    src={`${API_BASE}${selectedItem.screenshot_url}`}
                    alt={selectedItem.title}
                    className="w-full object-contain max-h-[60vh]"
                  />
                ) : (
                  <div className="h-48 bg-muted flex items-center justify-center">
                    <ImageIcon className="size-12 text-muted-foreground/30" />
                  </div>
                )}
                <div className="p-4 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{selectedItem.title}</p>
                    <Badge variant="secondary" className="text-[10px] capitalize shrink-0">
                      {selectedItem.platform}
                    </Badge>
                  </div>
                  {selectedItem.author_handle && (
                    <p className="text-xs text-muted-foreground">@{selectedItem.author_handle}</p>
                  )}
                  {selectedItem.published_at && (
                    <p className="text-xs text-muted-foreground">{formatDate(selectedItem.published_at)}</p>
                  )}
                  {selectedItem.content && (
                    <p className="text-xs text-muted-foreground line-clamp-3">{selectedItem.content}</p>
                  )}
                  {selectedItem.url && (
                    <a
                      href={selectedItem.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1 w-fit"
                    >
                      <ExternalLink className="size-3" /> Open original post
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

