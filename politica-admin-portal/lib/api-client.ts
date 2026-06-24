// API Client for Politica Backend
// Connects frontend to FastAPI backend

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

// Token management
const TOKEN_KEY = "politica_token"

export function getToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string) {
  if (typeof window === "undefined") return
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  if (typeof window === "undefined") return
  localStorage.removeItem(TOKEN_KEY)
}

export function isAuthenticated(): boolean {
  return getToken() !== null
}

export interface Document {
  id: string
  title: string
  content: string
  url: string
  platform: string
  language: string
  author?: string
  author_handle?: string
  published_at?: string
  collected_at?: string
  status: string
  sentiment?: number
  topics?: string[]
  entities?: string[]
  created_at: string
  updated_at: string

  // Video transcription
  transcription?: string | null

  // Engagement metrics
  likes_count?: number
  comments_count?: number
  shares_count?: number
  views_count?: number
  reactions_count?: number
  subscribers_count?: number
  engagement_rate?: number
}

export interface PostComment {
  id: string
  document_id: string
  author?: string
  author_handle?: string
  content: string
  likes_count: number
  replies_count: number
  published_at?: string
  collected_at: string
}

export interface Agent {
  agent_type: string
  name: string
  description: string
  model: string
  default_model: string
  llm_powered: boolean
  provider: string
  status: string
}

export interface CollectionRun {
  id: string
  target_id: string
  target_name: string
  platform: string
  status: string
  items_collected: number
  started_at: string | null
  completed_at: string | null
  duration_minutes: number | null
  sample_content?: { title: string; url: string | null }[]
}

export interface Stats {
  total_documents: number
  processed_today: number
  uptime: string
  storage_used: string
  pending_queue: number
}

export interface TrendData {
  period: string
  count: number
  sentiment_avg: number
}

class APIClient {
  private baseUrl: string

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const token = getToken()
    const headers = {
      "Content-Type": "application/json",
      ...(token && { "Authorization": `Bearer ${token}` }),
      ...options?.headers,
    }

    let response: Response
    try {
      response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
      })
    } catch (error) {
      if (!token) {
        if (typeof window !== "undefined") {
          window.location.href = "/login"
        }
        throw new Error("Not authenticated")
      }
      throw new Error(
        `Network error: Unable to reach the server. Please check your connection.`
      )
    }

    if (response.status === 401) {
      clearToken()
      if (typeof window !== "undefined") {
        window.location.href = "/login"
      }
      // Return empty result instead of throwing to avoid console errors
      return undefined as unknown as T
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "")
      throw new Error(
        `API Error: ${response.status} ${response.statusText}${errorBody ? ` - ${errorBody}` : ""}`
      )
    }

    if (response.status === 204 || response.headers.get("content-length") === "0") {
      return undefined as unknown as T
    }
    const text = await response.text()
    return (text ? JSON.parse(text) : undefined) as T
  }

  // ─── Authentication ─────────────────────────────────────────────────────────

  async login(username: string, password: string): Promise<{ access_token: string; token_type: string }> {
    const result = await this.request<{ access_token: string; token_type: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    })
    setToken(result.access_token)
    return result
  }

  async register(username: string, email: string, password: string, name: string): Promise<{ access_token: string; token_type: string }> {
    const result = await this.request<{ access_token: string; token_type: string }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, email, password, name }),
    })
    setToken(result.access_token)
    return result
  }

  async getCurrentUser(): Promise<any> {
    return this.request<any>("/api/auth/me")
  }

  async refreshToken(): Promise<{ access_token: string; token_type: string }> {
    const result = await this.request<{ access_token: string; token_type: string }>("/api/auth/refresh", {
      method: "POST",
    })
    setToken(result.access_token)
    return result
  }

  logout() {
    clearToken()
    if (typeof window !== "undefined") {
      window.location.href = "/login"
    }
  }

  // ─── Documents ──────────────────────────────────────────────────────────────

  async getDocuments(params?: {
    skip?: number
    limit?: number
    platform?: string
    status?: string
    from_date?: string
    to_date?: string
  }): Promise<Document[]> {
    const queryParams = new URLSearchParams()
    if (params?.skip) queryParams.append("skip", params.skip.toString())
    if (params?.limit) queryParams.append("limit", params.limit.toString())
    if (params?.platform) queryParams.append("platform", params.platform)
    if (params?.status) queryParams.append("status", params.status)
    if (params?.from_date) queryParams.append("from_date", params.from_date)
    if (params?.to_date) queryParams.append("to_date", params.to_date)

    const query = queryParams.toString()
    return this.request<Document[]>(`/api/documents/${query ? `?${query}` : ""}`)
  }

  async getDocument(id: string): Promise<Document> {
    return this.request<Document>(`/api/documents/${id}`)
  }

  async getDocumentComments(
    id: string,
    params?: { skip?: number; limit?: number }
  ): Promise<PostComment[]> {
    const queryParams = new URLSearchParams()
    if (params?.skip) queryParams.append("skip", params.skip.toString())
    if (params?.limit) queryParams.append("limit", params.limit.toString())
    const query = queryParams.toString()
    return this.request<PostComment[]>(`/api/documents/${id}/comments${query ? `?${query}` : ""}`)
  }

  async createDocument(data: Partial<Document>): Promise<Document> {
    return this.request<Document>("/api/documents/", {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  async updateDocument(id: string, data: Partial<Document>): Promise<Document> {
    return this.request<Document>(`/api/documents/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    })
  }

  async deleteDocument(id: string): Promise<void> {
    await this.request<void>(`/api/documents/${id}`, {
      method: "DELETE",
    })
  }

  // ─── Analytics ──────────────────────────────────────────────────────────────

  async getStats(): Promise<Stats> {
    return this.request<Stats>("/api/stats")
  }

  async getTrends(params?: { 
    period?: "day" | "week" | "month"
    topic?: string
    start_date?: string
    end_date?: string
  }): Promise<{
    topics?: any[]
    sentiment_overview?: {
      overall: number
      distribution: {
        positive: number
        neutral: number
        negative: number
      }
    }
    daily_sentiment?: TrendData[]
    date_range?: { start: string | null; end: string | null }
  }> {
    const queryParams = new URLSearchParams()
    if (params?.period) queryParams.append("period", params.period)
    if (params?.topic) queryParams.append("topic", params.topic)
    if (params?.start_date) queryParams.append("start_date", params.start_date)
    if (params?.end_date) queryParams.append("end_date", params.end_date)

    const query = queryParams.toString()
    return this.request(`/api/analytics/trends${query ? `?${query}` : ""}`)
  }

  async getEngagementStats(params?: {
    start_date?: string
    end_date?: string
  }): Promise<{
    top_posts: {
      id: string
      title: string
      platform: string
      author: string | null
      likes: number
      comments: number
      shares: number
      total_engagement: number
      collected_at: string | null
    }[]
    posting_frequency: { date: string; count: number }[]
    averages: { engagement_rate: number | null; likes_per_post: number; comments_per_post: number }
    top_commenters: { handle: string; name: string | null; comment_count: number; total_likes: number }[]
    platform_breakdown: { platform: string; count: number; percentage: number }[]
    sentiment_distribution: { total_processed: number; positive: number; neutral: number; negative: number }
  }> {
    const queryParams = new URLSearchParams()
    if (params?.start_date) queryParams.append("start_date", params.start_date)
    if (params?.end_date) queryParams.append("end_date", params.end_date)
    const query = queryParams.toString()
    return this.request<any>(`/api/analytics/engagement${query ? `?${query}` : ""}`)
  }

  // ─── Topics ───────────────────────────────────────────────────────────────────

  async getTopics(params?: { skip?: number; limit?: number }): Promise<any[]> {
    const queryParams = new URLSearchParams()
    if (params?.skip) queryParams.append("skip", params.skip.toString())
    if (params?.limit) queryParams.append("limit", params.limit.toString())
    const query = queryParams.toString()
    return this.request<any[]>(`/api/topics${query ? `?${query}` : ""}`)
  }

  // ─── Entities ─────────────────────────────────────────────────────────────────

  async getEntities(params?: { skip?: number; limit?: number; type?: string }): Promise<any[]> {
    const queryParams = new URLSearchParams()
    if (params?.skip) queryParams.append("skip", params.skip.toString())
    if (params?.limit) queryParams.append("limit", params.limit.toString())
    if (params?.type) queryParams.append("type", params.type)
    const query = queryParams.toString()
    return this.request<any[]>(`/api/entities${query ? `?${query}` : ""}`)
  }

  // ─── Promises ─────────────────────────────────────────────────────────────────

  async getPromises(params?: { skip?: number; limit?: number; status?: string }): Promise<any[]> {
    const queryParams = new URLSearchParams()
    if (params?.skip) queryParams.append("skip", params.skip.toString())
    if (params?.limit) queryParams.append("limit", params.limit.toString())
    if (params?.status) queryParams.append("status", params.status)
    const query = queryParams.toString()
    return this.request<any[]>(`/api/promises${query ? `?${query}` : ""}`)
  }

  async getTopicsEngagement(): Promise<{
    topics: {
      topic: string
      doc_count: number
      total_engagement: number
      avg_sentiment: number
      sentiment_label: "positive" | "neutral" | "negative"
      top_post_title: string | null
      top_post_snippet: string | null
      top_post_platform: string | null
      top_post_engagement: number
    }[]
  }> {
    return this.request<any>("/api/analytics/topics-engagement")
  }

  async getWeeklyTrends(): Promise<{
    weekly_trends: {
      week: string
      week_start: string
      documents: number
      avg_sentiment: number
      sentiment_label: "positive" | "neutral" | "negative"
    }[]
  }> {
    return this.request<any>("/api/analytics/weekly-trends")
  }

  async getSentimentSegmentation(): Promise<{
    pro_government: { count: number; percentage: number }
    against_government: { count: number; percentage: number }
    neutral: { count: number; percentage: number }
    total_comments: number
  }> {
    return this.request<any>("/api/analytics/sentiment-segmentation")
  }

  // ─── Media ──────────────────────────────────────────────────────────────────

  async getMediaGallery(params?: { 
    skip?: number
    limit?: number
    platform?: string
  }): Promise<any> {
    const queryParams = new URLSearchParams()
    if (params?.skip) queryParams.append("skip", params.skip.toString())
    if (params?.limit) queryParams.append("limit", params.limit.toString())
    if (params?.platform) queryParams.append("platform", params.platform)

    const query = queryParams.toString()
    return this.request<any>(`/api/media/gallery${query ? `?${query}` : ""}`)
  }

  // ─── Research ───────────────────────────────────────────────────────────────

  async researchQuery(query: string): Promise<any> {
    return this.request<any>("/api/research/query", {
      method: "POST",
      body: JSON.stringify({ query, max_results: 5 }),
    })
  }

  async getKnowledgeBaseStats(): Promise<any> {
    return this.request<any>("/api/research/knowledge-base/stats")
  }

  // Conversation management
  async createConversation(title: string): Promise<any> {
    return this.request<any>("/api/research/conversations", {
      method: "POST",
      body: JSON.stringify({ title }),
    })
  }

  async listConversations(): Promise<any[]> {
    return this.request<any[]>("/api/research/conversations")
  }

  async getConversation(conversationId: string): Promise<any> {
    return this.request<any>(`/api/research/conversations/${conversationId}`)
  }

  async addMessage(conversationId: string, message: { content: string; sender: string; sources?: any[] }): Promise<any> {
    return this.request<any>(`/api/research/conversations/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify(message),
    })
  }

  async searchResearch(params: { query: string; max_results?: number; conversation_id?: string }): Promise<any> {
    return this.request<any>("/api/research/query", {
      method: "POST",
      body: JSON.stringify(params),
    })
  }

  async getMessages(conversationId: string): Promise<any[]> {
    return this.request<any[]>(`/api/research/conversations/${conversationId}/messages`)
  }

  async deleteConversation(conversationId: string): Promise<void> {
    return this.request<void>(`/api/research/conversations/${conversationId}`, {
      method: "DELETE",
    })
  }

  async updateConversation(conversationId: string, title: string): Promise<any> {
    return this.request<any>(`/api/research/conversations/${conversationId}`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    })
  }

  // ─── Workspaces ─────────────────────────────────────────────────────────────

  async getWorkspaces(): Promise<any[]> {
    return this.request<any[]>("/api/workspaces/")
  }

  async getWorkspace(id: string): Promise<any> {
    return this.request<any>(`/api/workspaces/${id}`)
  }

  async createWorkspace(data: any): Promise<any> {
    return this.request<any>("/api/workspaces/", {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  async updateWorkspace(id: string, data: any): Promise<any> {
    return this.request<any>(`/api/workspaces/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    })
  }

  async deleteWorkspace(id: string): Promise<void> {
    await this.request<void>(`/api/workspaces/${id}`, {
      method: "DELETE",
    })
  }

  // ─── Logs ───────────────────────────────────────────────────────────────────

  async getLogs(params?: { 
    skip?: number
    limit?: number
    level?: string
    user?: string
  }): Promise<any[]> {
    const queryParams = new URLSearchParams()
    if (params?.skip) queryParams.append("skip", params.skip.toString())
    if (params?.limit) queryParams.append("limit", params.limit.toString())
    if (params?.level) queryParams.append("level", params.level)
    if (params?.user) queryParams.append("user", params.user)

    const query = queryParams.toString()
    return this.request<any[]>(`/api/logs/${query ? `?${query}` : ""}`)
  }

  async createLog(data: any): Promise<any> {
    return this.request<any>("/api/logs/", {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  async getLogStats(): Promise<any> {
    return this.request<any>("/api/logs/stats/")
  }

  // ─── Settings ───────────────────────────────────────────────────────────────

  async getAllSettings(): Promise<any> {
    return this.request<any>("/api/settings/")
  }

  async getSettingsByCategory(category: string): Promise<any> {
    return this.request<any>(`/api/settings/${category}`)
  }

  async updateSetting(category: string, key: string, value: any): Promise<any> {
    return this.request<any>(`/api/settings/${category}/${key}`, {
      method: "PUT",
      body: JSON.stringify({ value }),
    })
  }

  async bulkUpdateSettings(settings: any): Promise<any> {
    return this.request<any>("/api/settings/bulk-update/", {
      method: "POST",
      body: JSON.stringify(settings),
    })
  }

  // ─── Users ──────────────────────────────────────────────────────────────────

  async getUsers(params?: { skip?: number; limit?: number; status?: string }): Promise<any[]> {
    const queryParams = new URLSearchParams()
    if (params?.skip) queryParams.append("skip", params.skip.toString())
    if (params?.limit) queryParams.append("limit", params.limit.toString())
    if (params?.status) queryParams.append("status", params.status)

    const query = queryParams.toString()
    return this.request<any[]>(`/api/users/${query ? `?${query}` : ""}`)
  }

  async getUserStats(): Promise<any> {
    return this.request<any>("/api/users/stats/")
  }

  async getUser(id: string): Promise<any> {
    return this.request<any>(`/api/users/${id}`)
  }

  async createUser(data: any): Promise<any> {
    return this.request<any>("/api/users/", {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  async updateUser(id: string, data: any): Promise<any> {
    return this.request<any>(`/api/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    })
  }

  async deleteUser(id: string): Promise<void> {
    await this.request<void>(`/api/users/${id}`, {
      method: "DELETE",
    })
  }

  // ─── Health ─────────────────────────────────────────────────────────────────

  async healthCheck(): Promise<{ status: string }> {
    return this.request<{ status: string }>("/health")
  }

  // ─── Processing ─────────────────────────────────────────────────────────────

  async processDocument(id: string): Promise<any> {
    return this.request<any>(`/api/documents/${id}/process`, {
      method: "POST",
    })
  }

  async processDocumentBatch(params?: {
    document_ids?: string[] | "pending" | "all"
    concurrency?: number
  }): Promise<{ message: string; total: number; status: string }> {
    return this.request<any>("/api/documents/process-batch", {
      method: "POST",
      body: JSON.stringify({
        document_ids: params?.document_ids ?? "pending",
        concurrency: params?.concurrency ?? 3,
      }),
    })
  }

  // ─── Agents ─────────────────────────────────────────────────────────────────

  async getAgents(): Promise<Agent[]> {
    return this.request<Agent[]>("/api/agents/")
  }

  async getAgentJobs(params?: { skip?: number; limit?: number }): Promise<any[]> {
    const queryParams = new URLSearchParams()
    if (params?.skip) queryParams.append("skip", params.skip.toString())
    if (params?.limit) queryParams.append("limit", params.limit.toString())
    const query = queryParams.toString()
    return this.request<any[]>(`/api/agents/jobs${query ? `?${query}` : ""}`)
  }

  async runAgent(config: { agent_type: string; document_ids: string[] | "all" | "pending"; options?: any }): Promise<any> {
    return this.request<any>("/api/agents/run/", {
      method: "POST",
      body: JSON.stringify(config),
    })
  }

  async getAgentJob(id: string): Promise<any> {
    return this.request<any>(`/api/agents/jobs/${id}`)
  }

  // ─── LLM Provider ────────────────────────────────────────────────────────────

  async getLLMProviderConfig(): Promise<any> {
    return this.request<any>("/api/settings/llm-provider")
  }

  async getLLMModels(): Promise<any> {
    return this.request<any>("/api/agents/llm/models/")
  }

  async testLLM(): Promise<any> {
    return this.request<any>("/api/agents/llm/test/", { method: "POST" })
  }

  // ─── Scheduler ───────────────────────────────────────────────────────────────

  async getSchedulerConfig(): Promise<any> {
    return this.request<any>("/api/agents/scheduler/config/")
  }

  async updateSchedulerConfig(config: { enabled: boolean; hour: number; minute: number }): Promise<any> {
    return this.request<any>("/api/agents/scheduler/config/", {
      method: "POST",
      body: JSON.stringify(config),
    })
  }

  async runDailyAgents(): Promise<any> {
    return this.request<any>("/api/agents/run-daily/", {
      method: "POST",
    })
  }

  async generateApiToken(data: { name: string; description?: string; expires_in_days?: number }): Promise<{
    id: string
    name: string
    description: string | null
    token_prefix: string
    is_active: boolean
    created_at: string
    last_used_at: string | null
    expires_at: string | null
    raw_token: string
  }> {
    return this.request("/api/tokens/generate", {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  async getApiTokens(): Promise<{
    id: string
    name: string
    description: string | null
    token_prefix: string
    is_active: boolean
    created_at: string
    last_used_at: string | null
    expires_at: string | null
  }[]> {
    return this.request("/api/tokens/")
  }

  async updateApiToken(id: string, data: { name?: string; is_active?: boolean }): Promise<any> {
    return this.request(`/api/tokens/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    })
  }

  async deleteApiToken(id: string): Promise<void> {
    await this.request<void>(`/api/tokens/${id}`, { method: "DELETE" })
  }

  // ─── Ingestion (Extension) ──────────────────────────────────────────────────

  async getIngestionStats(): Promise<{
    total_documents: number
    total_comments: number
    by_platform: Record<string, number>
    last_24h: number
    last_7d: number
    posts_today: number
    comments_today: number
    ai_decisions_pending: number
    last_ingestion_at: string | null
  }> {
    return this.request("/api/ingest/stats")
  }

  async getIngestionLogs(params?: {
    platform?: string
    status?: string
    limit?: number
    skip?: number
  }): Promise<{
    id: string
    title: string
    platform: string
    author: string | null
    author_handle: string | null
    url: string | null
    status: string
    collected_at: string | null
    likes_count: number
    comments_count: number
  }[]> {
    const q = new URLSearchParams()
    if (params?.platform) q.append("platform", params.platform)
    if (params?.status) q.append("status", params.status)
    if (params?.limit) q.append("limit", String(params.limit))
    if (params?.skip) q.append("skip", String(params.skip))
    const qs = q.toString()
    return this.request(`/api/ingest/logs${qs ? `?${qs}` : ""}`)
  }

  // ─── AI Assistant ────────────────────────────────────────────────────────

  async analyzeData(): Promise<any> {
    return this.request("/api/assistant/analyze", {
      method: "POST",
    })
  }

  async getRecommendations(limit: number = 10): Promise<any[]> {
    return this.request(`/api/assistant/recommendations?limit=${limit}`)
  }

  async submitRecommendationFeedback(data: {
    recommendation_id: string
    feedback: string
    notes?: string
  }): Promise<any> {
    return this.request("/api/assistant/learn", {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  async getLearningInsights(): Promise<any[]> {
    return this.request("/api/assistant/insights")
  }

  // ─── Feedback ────────────────────────────────────────────────────────────

  async submitFeedback(feedback: {
    message_id: string
    rating?: number
    feedback_type: string
    comment?: string
    suggested_improvement?: string
  }): Promise<any> {
    return this.request<any>("/api/research/feedback", {
      method: "POST",
      body: JSON.stringify(feedback),
    })
  }

  async getFeedbackStats(): Promise<any> {
    return this.request<any>("/api/research/feedback/stats")
  }

  async getImprovementSuggestions(): Promise<any> {
    return this.request<any>("/api/research/feedback/improvements")
  }
}

// Export singleton instance
export const apiClient = new APIClient()

// Export class for testing
export default APIClient
