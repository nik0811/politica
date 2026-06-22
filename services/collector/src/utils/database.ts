import { Pool } from 'pg'
import { config } from './config'
import { logger } from './logger'

class DatabaseClient {
  private pool: Pool

  constructor() {
    this.pool = new Pool({ connectionString: config.databaseUrl })
  }

  async query(text: string, params?: any[]) {
    try {
      const result = await this.pool.query(text, params)
      return result
    } catch (error) {
      logger.error('Database query failed', { error, query: text })
      throw error
    }
  }

  async createSession(url: string, platform: string, mode: string) {
    const result = await this.query(
      `INSERT INTO browser_sessions (url, platform, mode, status, started_at)
       VALUES ($1, $2, $3, 'running', NOW())
       RETURNING *`,
      [url, platform, mode]
    )
    return result.rows[0]
  }

  async updateSession(sessionId: string, updates: { 
    status?: string
    progress?: number
    items_collected?: number
    completed_at?: Date
  }) {
    const fields: string[] = []
    const values: any[] = []
    let paramCount = 1

    Object.entries(updates).forEach(([key, value]) => {
      fields.push(`${key} = $${paramCount}`)
      values.push(value)
      paramCount++
    })

    values.push(sessionId)
    
    const result = await this.query(
      `UPDATE browser_sessions 
       SET ${fields.join(', ')}
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    )
    return result.rows[0]
  }

  async saveDocument(doc: {
    title: string
    content: string
    url: string
    platform: string
    language: string
    author?: string
  }) {
    const result = await this.query(
      `INSERT INTO documents (title, content, url, platform, language, author, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW())
       RETURNING *`,
      [doc.title, doc.content, doc.url, doc.platform, doc.language, doc.author]
    )
    return result.rows[0]
  }

  async close() {
    await this.pool.end()
  }
}

export const db = new DatabaseClient()
