import { BrowserManager } from './core/BrowserManager'
import { InstagramCollector } from './collectors/InstagramCollector'
import { CollectionScheduler } from './scheduler/CollectionScheduler'
import { redis } from './utils/redis'
import { storage } from './utils/storage'
import { db } from './utils/database'
import { logger } from './utils/logger'

class CollectorService {
  private browserManager: BrowserManager
  private scheduler: CollectionScheduler
  private running: boolean = false

  constructor() {
    this.browserManager = new BrowserManager()
    this.scheduler = new CollectionScheduler()
  }

  async start() {
    logger.info('Starting Politica Collector Service...')

    // Initialize connections
    await redis.connect()
    await storage.ensureBucket()
    await this.browserManager.initialize()
    await this.scheduler.initialize()

    // Add sample jobs
    this.addSampleJobs()

    // Start processing queue
    this.running = true
    this.processQueue()

    logger.info('Collector Service running')
  }

  private addSampleJobs() {
    // High priority - Check every 5 minutes
    this.scheduler.addJob({
      id: 'instagram_breaking_news',
      url: 'https://www.instagram.com/p/sample/',
      platform: 'instagram',
      priority: 'high',
      schedule: 'every_5min',
      enabled: false // Set to true when ready
    })

    // Medium priority - Check hourly
    this.scheduler.addJob({
      id: 'instagram_daily_updates',
      url: 'https://www.instagram.com/p/sample2/',
      platform: 'instagram',
      priority: 'medium',
      schedule: 'hourly',
      enabled: false
    })
  }

  private async processQueue() {
    while (this.running) {
      try {
        // Check high priority queue first
        let jobData = await redis.dequeue('collection:high')
        
        if (!jobData) {
          // Check medium priority
          jobData = await redis.dequeue('collection:medium')
        }
        
        if (!jobData) {
          // Check low priority
          jobData = await redis.dequeue('collection:low')
        }

        if (jobData) {
          const job = JSON.parse(jobData)
          await this.processJob(job)
        } else {
          // No jobs, wait a bit
          await new Promise(resolve => setTimeout(resolve, 5000))
        }
      } catch (error) {
        logger.error('Error processing queue', { error })
        await new Promise(resolve => setTimeout(resolve, 5000))
      }
    }
  }

  private async processJob(job: { url: string; platform: string; id: string }) {
    logger.info(`Processing job: ${job.id}`)

    try {
      if (job.platform === 'instagram') {
        const collector = new InstagramCollector()
        
        const result = await this.browserManager.scrape(
          {
            url: job.url,
            platform: job.platform,
            allowHeadedFallback: true
          },
          (page) => collector.collect(page, job.url)
        )

        if (result.success && result.data) {
          // Save to database
          await db.saveDocument({
            title: result.data.title,
            content: result.data.content,
            url: job.url,
            platform: job.platform,
            language: 'en', // TODO: Detect language
            author: result.data.author
          })

          logger.info(`Job completed successfully: ${job.id}`)
        } else {
          logger.error(`Job failed: ${job.id}`, { issues: result.issues })
        }
      }
    } catch (error) {
      logger.error(`Error processing job ${job.id}`, { error })
    }
  }

  async stop() {
    logger.info('Stopping Collector Service...')
    this.running = false
    this.scheduler.stop()
    await this.browserManager.close()
    await redis.close()
    await db.close()
    logger.info('Collector Service stopped')
  }
}

// Main entry point
const service = new CollectorService()

process.on('SIGTERM', async () => {
  await service.stop()
  process.exit(0)
})

process.on('SIGINT', async () => {
  await service.stop()
  process.exit(0)
})

service.start().catch((error) => {
  logger.error('Failed to start service', { error })
  process.exit(1)
})

export { CollectorService }
