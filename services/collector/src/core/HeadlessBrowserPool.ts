import { chromium, Browser, Page, BrowserContext } from 'playwright'
import { logger } from '../utils/logger'
import { config } from '../utils/config'

export class HeadlessBrowserPool {
  private browsers: Browser[] = []
  private availablePages: Page[] = []
  private maxConcurrent: number

  constructor(maxConcurrent: number = 3) {
    this.maxConcurrent = maxConcurrent
  }

  async initialize() {
    logger.info(`Initializing headless browser pool with ${this.maxConcurrent} browsers`)
    
    for (let i = 0; i < this.maxConcurrent; i++) {
      const browser = await this.createBrowser()
      this.browsers.push(browser)
      
      const context = await this.createContext(browser)
      const page = await context.newPage()
      this.availablePages.push(page)
    }
    
    logger.info('Headless browser pool ready')
  }

  private async createBrowser(): Promise<Browser> {
    return await chromium.launch({
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu'
      ]
    })
  }

  private async createContext(browser: Browser): Promise<BrowserContext> {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US'
    })

    // Add stealth scripts
    await context.addInitScript(() => {
      // Override webdriver detection
      Object.defineProperty(navigator, 'webdriver', { get: () => false })
      
      // Override plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5]
      })
      
      // Override languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en']
      })
    })

    return context
  }

  async acquirePage(): Promise<Page> {
    if (this.availablePages.length === 0) {
      // Wait for a page to become available
      await new Promise(resolve => setTimeout(resolve, 1000))
      return this.acquirePage()
    }

    const page = this.availablePages.pop()!
    return page
  }

  async releasePage(page: Page) {
    // Reset page state
    await page.goto('about:blank')
    this.availablePages.push(page)
  }

  async close() {
    for (const browser of this.browsers) {
      await browser.close()
    }
    logger.info('Headless browser pool closed')
  }
}
