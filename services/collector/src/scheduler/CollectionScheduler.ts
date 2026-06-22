import { redis } from '../utils/redis'
import { logger } from '../utils/logger'

export interface CollectionJob {
  id: string
  url: string
  platform: string
  priority: 'high' | 'medium' | 'low'
  schedule: 'every_5min' | 'hourly' | 'daily'
  enabled: boolean
}

export class CollectionScheduler {
  private jobs: Map<string, CollectionJob> = new Map()
  private intervals: Map<string, NodeJS.Timeout> = new Map()

  async initialize() {
    logger.info('CollectionScheduler initialized')
  }

  addJob(job: CollectionJob) {
    this.jobs.set(job.id, job)
    this.scheduleJob(job)
    logger.info(`Job added: ${job.id} (${job.schedule})`)
  }

  removeJob(jobId: string) {
    const interval = this.intervals.get(jobId)
    if (interval) {
      clearInterval(interval)
      this.intervals.delete(jobId)
    }
    this.jobs.delete(jobId)
    logger.info(`Job removed: ${jobId}`)
  }

  private scheduleJob(job: CollectionJob) {
    if (!job.enabled) return

    const intervalMs = this.getIntervalMs(job.schedule)
    
    // Schedule recurring job
    const interval = setInterval(async () => {
      await this.enqueueJob(job)
    }, intervalMs)

    this.intervals.set(job.id, interval)

    // Enqueue immediately
    this.enqueueJob(job)
  }

  private getIntervalMs(schedule: string): number {
    switch (schedule) {
      case 'every_5min':
        return 5 * 60 * 1000
      case 'hourly':
        return 60 * 60 * 1000
      case 'daily':
        return 24 * 60 * 60 * 1000
      default:
        return 60 * 60 * 1000
    }
  }

  private async enqueueJob(job: CollectionJob) {
    const queue = this.getQueueForPriority(job.priority)
    const jobData = JSON.stringify({
      id: job.id,
      url: job.url,
      platform: job.platform,
      timestamp: new Date().toISOString()
    })
    
    await redis.enqueue(queue, jobData)
    logger.info(`Job enqueued: ${job.id} in ${queue}`)
  }

  private getQueueForPriority(priority: string): string {
    switch (priority) {
      case 'high':
        return 'collection:high'
      case 'medium':
        return 'collection:medium'
      case 'low':
        return 'collection:low'
      default:
        return 'collection:medium'
    }
  }

  stop() {
    this.intervals.forEach(interval => clearInterval(interval))
    this.intervals.clear()
    logger.info('CollectionScheduler stopped')
  }
}
