import { connect, Browser, Page } from 'playwright'
import { logger } from '../utils/logger'

export class HeadedBrowserManager {
  private browser: Browser | null = null
  private page: Page | null = null

  async connect() {
    logger.info('Connecting to headed browser (Selenium)')
    
    // Connect to Selenium standalone chrome with VNC
    this.browser = await connect('http://localhost:4444')
    
    const context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 }
    })
    
    this.page = await context.newPage()
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
