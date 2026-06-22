import { Page } from 'playwright'
import { HeadlessBrowserPool } from './HeadlessBrowserPool'
import { HeadedBrowserManager } from './HeadedBrowserManager'
import { IssueDetector, ScrapedContent, Issue } from '../monitoring/IssueDetector'
import { DataValidator } from '../monitoring/DataValidator'
import { logger } from '../utils/logger'
import { db } from '../utils/database'

export interface ScrapeConfig {
  url: string
  platform: string
  allowHeadedFallback?: boolean
}

export interface ScrapeResult {
  success: boolean
  data?: ScrapedContent
  issues: Issue[]
  mode: 'headless' | 'headed'
  sessionId?: string
}

export class BrowserManager {
  private headlessPool: HeadlessBrowserPool
  private headedManager: HeadedBrowserManager
  private issueDetector: IssueDetector
  private validator: DataValidator

  constructor() {
    this.headlessPool = new HeadlessBrowserPool(3)
    this.headedManager = new HeadedBrowserManager()
    this.issueDetector = new IssueDetector()
    this.validator = new DataValidator()
  }

  async initialize() {
    await this.headlessPool.initialize()
    logger.info('BrowserManager initialized')
  }

  async scrape(
    config: ScrapeConfig,
    collectFn: (page: Page) => Promise<ScrapedContent>
  ): Promise<ScrapeResult> {
    // Start with headless
    logger.info(`Starting scrape: ${config.url} (headless mode)`)
    let result = await this.scrapeHeadless(config, collectFn)

    // Check if we should switch to headed
    if (result.issues.length > 0 && config.allowHeadedFallback !== false) {
      const shouldSwitch = this.issueDetector.shouldSwitchToHeaded(result.issues)
      
      if (shouldSwitch) {
        logger.warn(`Switching to headed mode for ${config.url}`, { issues: result.issues })
        result = await this.scrapeHeaded(config, collectFn)
      }
    }

    return result
  }

  private async scrapeHeadless(
    config: ScrapeConfig,
    collectFn: (page: Page) => Promise<ScrapedContent>
  ): Promise<ScrapeResult> {
    const page = await this.headlessPool.acquirePage()
    
    try {
      // Create session
      const session = await db.createSession(config.url, config.platform, 'headless')
      
      // Collect data
      const data = await collectFn(page)
      
      // Detect issues
      const issues = await this.issueDetector.detectIssues(page, data)
      
      // Validate data
      const validation = await this.validator.validate(data, config.url)
      
      if (!validation.valid) {
        validation.issues.forEach(issue => {
          issues.push({
            type: 'missing_content',
            severity: 'high',
            message: issue
          })
        })
      }

      // Update session
      await db.updateSession(session.id, {
        status: issues.length > 0 ? 'completed' : 'completed',
        items_collected: 1,
        completed_at: new Date()
      })

      return {
        success: issues.length === 0,
        data,
        issues,
        mode: 'headless',
        sessionId: session.id
      }
    } catch (error) {
      logger.error('Headless scrape failed', { error, url: config.url })
      return {
        success: false,
        issues: [{
          type: 'timeout',
          severity: 'high',
          message: error instanceof Error ? error.message : 'Unknown error'
        }],
        mode: 'headless'
      }
    } finally {
      await this.headlessPool.releasePage(page)
    }
  }

  private async scrapeHeaded(
    config: ScrapeConfig,
    collectFn: (page: Page) => Promise<ScrapedContent>
  ): Promise<ScrapeResult> {
    const page = await this.headedManager.getPage()
    
    try {
      // Create session
      const session = await db.createSession(config.url, config.platform, 'headed')
      logger.info(`Headed session created: ${session.id} - View at http://localhost:7900`)
      
      // Collect data
      const data = await collectFn(page)
      
      // Detect issues
      const issues = await this.issueDetector.detectIssues(page, data)
      
      // Update session
      await db.updateSession(session.id, {
        status: 'completed',
        items_collected: 1,
        completed_at: new Date()
      })

      return {
        success: issues.length === 0,
        data,
        issues,
        mode: 'headed',
        sessionId: session.id
      }
    } catch (error) {
      logger.error('Headed scrape failed', { error, url: config.url })
      return {
        success: false,
        issues: [{
          type: 'timeout',
          severity: 'high',
          message: error instanceof Error ? error.message : 'Unknown error'
        }],
        mode: 'headed'
      }
    }
  }

  async close() {
    await this.headlessPool.close()
    await this.headedManager.close()
  }
}
