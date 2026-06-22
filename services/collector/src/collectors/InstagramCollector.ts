import { Page } from 'playwright'
import { ScrapedContent } from '../monitoring/IssueDetector'
import { logger } from '../utils/logger'
import { storage } from '../utils/storage'
import { v4 as uuidv4 } from 'uuid'

export class InstagramCollector {
  async collect(page: Page, url: string): Promise<ScrapedContent> {
    logger.info(`Collecting Instagram post: ${url}`)

    // Navigate to post
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })

    // Wait for main content
    await page.waitForSelector('article', { timeout: 10000 })

    // Extract post data
    const data = await this.extractPostData(page)

    // Expand "Read more" if present
    await this.expandReadMore(page)

    // Expand comments
    await this.expandComments(page)

    // Take screenshot
    const screenshotUrl = await this.takeScreenshot(page, url)
    logger.info(`Screenshot saved: ${screenshotUrl}`)

    // Get images
    const images = await this.extractImages(page)

    return {
      title: data.author ? `Post by ${data.author}` : 'Instagram Post',
      content: data.content,
      author: data.author,
      images: [...images, screenshotUrl],
      timestamp: data.timestamp
    }
  }

  private async extractPostData(page: Page): Promise<{
    content: string
    author?: string
    timestamp?: Date
  }> {
    try {
      // Extract caption/content
      const contentElement = page.locator('article div[class*="Contents"] span, article h1')
      const content = await contentElement.first().textContent() || ''

      // Extract author
      const authorElement = page.locator('article header a[role="link"]')
      const author = await authorElement.first().textContent() || undefined

      // Extract timestamp (if available)
      const timeElement = page.locator('time')
      const datetime = await timeElement.first().getAttribute('datetime')
      const timestamp = datetime ? new Date(datetime) : undefined

      return { content, author, timestamp }
    } catch (error) {
      logger.error('Failed to extract post data', { error })
      return { content: '' }
    }
  }

  private async expandReadMore(page: Page) {
    try {
      const readMoreButton = page.locator('button:has-text("more")')
      const count = await readMoreButton.count()
      
      if (count > 0) {
        await readMoreButton.first().click()
        await page.waitForTimeout(1000)
        logger.info('Expanded "Read more"')
      }
    } catch (error) {
      // Not critical, continue
      logger.debug('No "Read more" button found')
    }
  }

  private async expandComments(page: Page) {
    try {
      // Click "View all comments" if present
      const viewCommentsButton = page.locator('button:has-text("View"), button:has-text("comments")')
      const count = await viewCommentsButton.count()
      
      if (count > 0) {
        await viewCommentsButton.first().click()
        await page.waitForTimeout(2000)
        logger.info('Expanded comments')
      }

      // Scroll to load more comments
      await this.scrollToLoadMore(page)
    } catch (error) {
      logger.debug('Could not expand comments', { error })
    }
  }

  private async scrollToLoadMore(page: Page) {
    try {
      // Scroll down in small increments
      for (let i = 0; i < 3; i++) {
        await page.evaluate('window.scrollBy(0, 500)')
        await page.waitForTimeout(1000)
      }
    } catch (error) {
      logger.debug('Scrolling failed', { error })
    }
  }

  private async extractImages(page: Page): Promise<string[]> {
    try {
      const imageElements = page.locator('article img[src^="https://"]')
      const count = await imageElements.count()
      const images: string[] = []

      for (let i = 0; i < Math.min(count, 10); i++) {
        const src = await imageElements.nth(i).getAttribute('src')
        if (src && !src.includes('profile')) {
          images.push(src)
        }
      }

      return images
    } catch (error) {
      logger.error('Failed to extract images', { error })
      return []
    }
  }

  private async takeScreenshot(page: Page, url: string): Promise<string> {
    try {
      const filename = `instagram_${uuidv4()}.png`
      const screenshot = await page.screenshot({ 
        fullPage: true,
        type: 'png'
      })
      
      const screenshotUrl = await storage.saveScreenshot(filename, screenshot)
      return screenshotUrl
    } catch (error) {
      logger.error('Failed to take screenshot', { error })
      throw error
    }
  }
}
