import { chromium, Browser, Page } from 'playwright'
import { logger } from '../utils/logger'

export class HeadedBrowserManager {
  private browser: Browser | null = null
  private page: Page | null = null

  async connect() {
    logger.info('Connecting to headed browser (Selenium)')
    
    // Connect to Selenium standalone chrome with VNC
    this.browser = await chromium.connectOverCDP('http://localhost:4444')
    
    const contexts = this.browser.contexts()
    const context = contexts.length > 0 ? contexts[0] : await this.browser.newContext({
      viewport: { width: 1920, height: 1080 }
    })
    
    this.page = context.pages().length > 0 ? context.pages()[0] : await context.newPage()
    logger.info('Connected to headed browser')
  }

  async getPage(): Promise<Page> {
    if (!this.page) {
      await this.connect()
    }
    return this.page!
  }

  async close() {
    if (this.browser) {
      await this.browser.close()
      logger.info('Headed browser closed')
    }
  }
}
