import { Page } from 'playwright'

export interface Issue {
  type: 'bot_detection' | 'missing_content' | 'js_error' | 'timeout' | 'auth_required'
  severity: 'high' | 'medium' | 'low'
  message: string
}

export interface ScrapedContent {
  title: string
  content: string
  author?: string
  images: string[]
  timestamp?: Date
}

export class IssueDetector {
  async detectIssues(page: Page, content: ScrapedContent): Promise<Issue[]> {
    const issues: Issue[] = []

    // Check for bot detection
    const botDetected = await this.checkBotDetection(page)
    if (botDetected) {
      issues.push({
        type: 'bot_detection',
        severity: 'high',
        message: 'Bot detection mechanism detected (Cloudflare/reCAPTCHA)'
      })
    }

    // Check for missing content
    if (!content.content || content.content.length < 10) {
      issues.push({
        type: 'missing_content',
        severity: 'high',
        message: 'No meaningful content extracted'
      })
    }

    // Check for JavaScript errors
    const jsErrors = await this.checkJavaScriptErrors(page)
    if (jsErrors) {
      issues.push({
        type: 'js_error',
        severity: 'medium',
        message: 'JavaScript errors detected on page'
      })
    }

    return issues
  }

  private async checkBotDetection(page: Page): Promise<boolean> {
    try {
      // Check for Cloudflare challenge
      const cloudflare = await page.locator('text=/cloudflare/i').count()
      if (cloudflare > 0) return true

      // Check for reCAPTCHA
      const recaptcha = await page.locator('.g-recaptcha, iframe[src*="recaptcha"]').count()
      if (recaptcha > 0) return true

      // Check for "Access Denied" messages
      const accessDenied = await page.locator('text=/access denied|blocked|forbidden/i').count()
      if (accessDenied > 0) return true

      return false
    } catch {
      return false
    }
  }

  private async checkJavaScriptErrors(page: Page): Promise<boolean> {
    // This would be set up via page.on('pageerror') in the collector
    // For now, return false
    return false
  }

  shouldSwitchToHeaded(issues: Issue[]): boolean {
    return issues.some(issue => 
      issue.severity === 'high' && 
      ['bot_detection', 'missing_content', 'auth_required'].includes(issue.type)
    )
  }
}
