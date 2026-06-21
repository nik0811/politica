"use client"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send, Bot, User, Lightbulb, FileText, BookMarked, Users } from "lucide-react"
import { documents, promises, entities } from "@/lib/mock-data"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  sources?: { type: string; title: string }[]
  timestamp: Date
}

const SUGGESTED_QUERIES = [
  "What are AAP's healthcare promises?",
  "Summarize BJP's infrastructure activity in Gujarat",
  "Which party has the most education promises?",
  "What is the sentiment around employment topics?",
  "Show me promises made by Narendra Modi",
]

function generateAnswer(query: string): { content: string; sources: { type: string; title: string }[] } {
  const q = query.toLowerCase()
  const sources: { type: string; title: string }[] = []

  if (q.includes("healthcare") || q.includes("health") || q.includes("clinic")) {
    const relDocs = documents.filter((d) => d.topics.includes("Healthcare"))
    const relProm = promises.filter((p) => p.topic === "Healthcare")
    relDocs.slice(0, 2).forEach((d) => sources.push({ type: "document", title: d.title }))
    relProm.slice(0, 2).forEach((p) => sources.push({ type: "promise", title: p.text.slice(0, 60) + "…" }))
    return {
      content: `**Healthcare Analysis:**\n\nAAP has been the most active party on healthcare, with Arvind Kejriwal's Mohalla Clinic expansion being the flagship promise — 500 new clinics in Delhi by March 2027.\n\nKey insights:\n- AAP healthcare content has an average sentiment of **0.81** — highest among all topics\n- BJP and AAP are directly competing in Delhi on this topic\n- Rural healthcare gaps are identified as the top voter concern nationwide\n- ${relProm.length} healthcare promises tracked with average confidence of 88%\n\nRecent coverage includes the "Mohalla Clinic banner" capturing "Delhi ka Swasthya Kranti" messaging across Telegram channels.`,
      sources,
    }
  }

  if (q.includes("infrastructure") || q.includes("road") || q.includes("gujarat")) {
    const relDocs = documents.filter((d) => d.topics.includes("Infrastructure"))
    relDocs.slice(0, 2).forEach((d) => sources.push({ type: "document", title: d.title }))
    return {
      content: `**Infrastructure Intelligence Report:**\n\nInfrastructure is the **top trending topic** in the dataset, up +22% week-over-week. BJP (Modi & Nitish Kumar) and their allies dominate this narrative.\n\nHighlights:\n- PM Modi's Gujarat rally speech generated 1,240 words of infrastructure content with sentiment **+0.72**\n- Nitish Kumar's Bihar road development plan promises 10,000 km of rural roads over 3 years\n- NHAI and state highway bodies are the most-cited organizations\n- Gujarat shows the highest positive sentiment (0.72) of any state on this topic\n\nPrimary platforms: Instagram (rally visuals) and X (policy threads).`,
      sources,
    }
  }

  if (q.includes("education") || q.includes("school") || q.includes("laptop")) {
    const relProm = promises.filter((p) => p.topic === "Education")
    relProm.forEach((p) => sources.push({ type: "promise", title: p.text.slice(0, 60) + "…" }))
    return {
      content: `**Education Policy Analysis:**\n\nEducation is the second most covered topic with 1,240 documents and strong upward trend (+12% WoW).\n\n**Key Promises Extracted:**\n${relProm.map((p) => `• ${p.entity} (${p.party}): "${p.text.slice(0, 80)}…" — Confidence: ${(p.confidence * 100).toFixed(0)}%`).join("\n")}\n\n**Sentiment:** Average 0.62 — the most positive topic overall.\n\n**Recommendation:** Education-focused messaging in evening hours (6–9 PM) generates 2x engagement compared to morning posts.`,
      sources,
    }
  }

  if (q.includes("modi") || q.includes("bjp")) {
    const relProm = promises.filter((p) => p.party === "BJP")
    relProm.slice(0, 3).forEach((p) => sources.push({ type: "promise", title: p.text.slice(0, 60) + "…" }))
    return {
      content: `**BJP / Narendra Modi Intelligence Brief:**\n\nNarendra Modi is the most mentioned entity with **4,821 mentions** across 312 documents. BJP as an organization has 8,920 mentions in 543 documents.\n\n**Active Promise Areas:**\n${relProm.map((p) => `• **${p.topic}**: ${p.text.slice(0, 80)}… (${p.region})`).join("\n")}\n\n**Sentiment:** Modi's average sentiment is 0.42 — neutral-to-positive. BJP overall is at 0.35.\n\nStrongest messaging performance is in Gujarat (0.72 sentiment) on infrastructure topics.`,
      sources,
    }
  }

  if (q.includes("employment") || q.includes("job") || q.includes("unemployment")) {
    return {
      content: `**Employment Sentiment Analysis:**\n\nEmployment is the only major topic showing a **declining trend (-5% WoW)** with a low sentiment score of **0.18** — indicating largely negative discourse.\n\n**Key Findings:**\n- INDIA Alliance held a press conference directly on unemployment, generating significant negative sentiment\n- BJP's promise of 2 crore new manufacturing jobs by 2028 has 82% AI confidence but limited public uptake\n- UP and Bihar have the highest employment-related political activity\n- Opposition messaging is framing this as a crisis, while ruling coalition uses aspirational framing\n\n**Platform breakdown:** X/Twitter shows the highest negative employment sentiment (30% negative vs 38% positive).`,
      sources: [{ type: "document", title: "Opposition Alliance Press Conference on Unemployment" }],
    }
  }

  // Generic fallback
  const matchedEnts = entities.filter((e) => e.name.toLowerCase().includes(q) || (e.party ?? "").toLowerCase().includes(q))
  if (matchedEnts.length > 0) {
    matchedEnts.slice(0, 2).forEach((e) => sources.push({ type: "entity", title: `${e.name} (${e.type})` }))
    const e = matchedEnts[0]
    return {
      content: `**Entity Profile: ${e.name}**\n\nType: ${e.type} | Party: ${e.party ?? "N/A"} | State: ${e.state}\n\n- **${e.mentions.toLocaleString()} mentions** across ${e.documents} documents\n- Sentiment score: **${e.sentiment.toFixed(2)}** (${e.sentiment > 0.5 ? "positive" : e.sentiment > 0.25 ? "mixed" : "critical"})\n- Role: ${e.role}\n\nUse the Search page for full document retrieval or the Promises page to see commitments by this entity.`,
      sources,
    }
  }

  return {
    content: `I analyzed the query **"${query}"** across the Politica database.\n\nI found limited direct matches. Here are some related resources:\n\n- **Documents:** ${documents.length.toLocaleString()} collected from X, Instagram, Telegram, and News\n- **Promises:** ${promises.length} AI-extracted commitments tracked\n- **Entities:** ${entities.length} key political actors monitored\n\nTry more specific queries like:\n• "What are BJP's infrastructure promises?"\n• "Sentiment analysis for healthcare"\n• "Entities in West Bengal"`,
    sources,
  }
}

export default function ResearchPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "0",
      role: "assistant",
      content: "Hello! I'm your political intelligence research assistant. I can help you analyze trends, summarize findings, query promises, and explore entity relationships. What would you like to investigate?",
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return
    setInput("")
    setLoading(true)

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text, timestamp: new Date() }
    setMessages((prev) => [...prev, userMsg])

    await new Promise((r) => setTimeout(r, 1200))
    const { content, sources } = generateAnswer(text)
    const assistantMsg: Message = { id: (Date.now() + 1).toString(), role: "assistant", content, sources, timestamp: new Date() }
    setMessages((prev) => [...prev, assistantMsg])
    setLoading(false)
  }

  return (
    <div className="flex flex-col gap-4 max-w-4xl mx-auto h-full">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Chat */}
        <Card className="lg:col-span-3 bg-card border-border flex flex-col" style={{ height: "calc(100vh - 12rem)" }}>
          <CardHeader className="pb-3 border-b border-border shrink-0">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Bot className="size-4 text-primary" /> Research Assistant
              <Badge variant="secondary" className="text-[10px] ml-auto">RAG + Knowledge Graph</Badge>
            </CardTitle>
          </CardHeader>

          <ScrollArea className="flex-1 px-4 py-3">
            <div className="flex flex-col gap-4">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div className={`size-7 rounded-full flex items-center justify-center shrink-0 ${msg.role === "user" ? "bg-primary/20" : "bg-muted"}`}>
                    {msg.role === "user" ? <User className="size-3.5 text-primary" /> : <Bot className="size-3.5 text-muted-foreground" />}
                  </div>
                  <div className={`flex flex-col gap-2 max-w-[85%] ${msg.role === "user" ? "items-end" : ""}`}>
                    <div className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                      {msg.content.split("\n").map((line, i) => {
                        const bold = line.replace(/\*\*(.*?)\*\*/g, (_, m) => `<strong>${m}</strong>`)
                        return line.startsWith("•") || line.startsWith("-")
                          ? <div key={i} className="flex gap-1.5 mt-0.5"><span className="mt-1 size-1.5 rounded-full bg-current shrink-0 opacity-60" /><span dangerouslySetInnerHTML={{ __html: bold.replace(/^[•\-]\s*/, "") }} /></div>
                          : line.startsWith("**") && line.endsWith("**")
                          ? <p key={i} className="font-semibold mt-1" dangerouslySetInnerHTML={{ __html: bold }} />
                          : <p key={i} className={i > 0 ? "mt-0.5" : ""} dangerouslySetInnerHTML={{ __html: bold }} />
                      })}
                    </div>
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {msg.sources.map((s, i) => (
                          <span key={i} className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 border border-border px-2 py-0.5 rounded-full">
                            {s.type === "document" ? <FileText className="size-2.5" /> : s.type === "promise" ? <BookMarked className="size-2.5" /> : <Users className="size-2.5" />}
                            {s.title.slice(0, 35)}{s.title.length > 35 ? "…" : ""}
                          </span>
                        ))}
                      </div>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex gap-3">
                  <div className="size-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <Bot className="size-3.5 text-muted-foreground" />
                  </div>
                  <div className="bg-muted rounded-xl px-4 py-3 flex items-center gap-1.5">
                    {[0, 150, 300].map((d) => (
                      <span key={d} className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          <div className="p-4 border-t border-border shrink-0">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
                placeholder="Ask about trends, promises, entities, sentiment…"
                className="bg-input border-border text-sm h-10"
                disabled={loading}
              />
              <Button onClick={() => sendMessage(input)} disabled={loading || !input.trim()} size="icon" className="size-10 shrink-0">
                <Send className="size-4" />
              </Button>
            </div>
          </div>
        </Card>

        {/* Suggestions panel */}
        <div className="flex flex-col gap-3">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground uppercase tracking-wider">
                <Lightbulb className="size-3.5" /> Suggested Queries
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 pt-0">
              {SUGGESTED_QUERIES.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-left text-xs text-muted-foreground hover:text-foreground bg-muted/40 hover:bg-muted/70 border border-border/50 hover:border-border rounded-lg px-3 py-2 transition-colors leading-relaxed"
                >
                  {q}
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Knowledge Base</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5 pt-0 text-xs">
              {[
                { label: "Documents", value: "14,821" },
                { label: "Promises", value: "2,341" },
                { label: "Entities", value: "8,920" },
                { label: "Topics", value: "47" },
                { label: "Languages", value: "12" },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-1 border-b border-border/50 last:border-0">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium text-foreground">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
