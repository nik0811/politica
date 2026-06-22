import { ScrapedContent } from './IssueDetector'
import { db } from '../utils/database'
import { logger } from '../utils/logger'

export class DataValidator {
  async validate(content: ScrapedContent, url: string): Promise<{
    valid: boolean
    issues: string[]
    shouldRetry: boolean
  }> {
    const issues: string[] = []

    // Check minimum content length
    if (content.content.length < 50) {
      issues.push('Content too short (minimum 50 characters)')
    }

    // Check for placeholder text
    if (this.hasPlaceholderText(content.content)) {
      issues.push('Placeholder text detected (page not fully loaded)')
    }

    // Compare with historical data
    const historicalIssue = await this.compareWithHistory(url, content)
    if (historicalIssue) {
      issues.push(historicalIssue)
    }

    const valid = issues.length === 0
    const shouldRetry = !valid && issues.some(i => i.includes('not fully loaded'))

    return { valid, issues, shouldRetry }
  }

  private hasPlaceholderText(content: string): boolean {
    const placeholders = ['loading...', 'please wait', 'fetching data', '...']
    const lowerContent = content.toLowerCase()
    return placeholders.some(p => lowerContent.includes(p))
  }

  private async compareWithHistory(url: string, content: ScrapedContent): Promise<string | null> {
    try {
      // Get previous scrape count for this URL
      const result = await db.query(
        'SELECT COUNT(*) as count FROM documents WHERE url = $1',
        [url]
      )
      
      const previousCount = parseInt(result.rows[0]?.count || '0')
      
      // If this is first scrape, no comparison needed
      if (previousCount === 0) return null

      // Get average content length from previous scrapes
      const avgResult = await db.query(
        'SELECT AVG(LENGTH(content)) as avg_length FROM documents WHERE url = $1',
        [url]
      )
      
      const avgLength = parseFloat(avgResult.rows[0]?.avg_length || '0')
      
      // If current content is less than 50% of historical average, flag it
      if (avgLength > 0 && content.content.length < avgLength * 0.5) {
        return `Content significantly shorter than historical average (${content.content.length} vs ${avgLength})`
      }

      return null
    } catch (error) {
      logger.error('Error comparing with history', { error, url })
      return null
    }
  }
}
