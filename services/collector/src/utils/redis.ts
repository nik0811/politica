import { createClient } from 'redis'
import { config } from './config'
import { logger } from './logger'

class RedisClient {
  private client: ReturnType<typeof createClient>
  private connected: boolean = false

  constructor() {
    this.client = createClient({ url: config.redisUrl })
    this.client.on('error', (err) => logger.error('Redis error', { error: err }))
  }

  async connect() {
    if (!this.connected) {
      await this.client.connect()
      this.connected = true
      logger.info('Redis connected')
    }
  }

  async set(key: string, value: string, expirySeconds?: number) {
    if (expirySeconds) {
      await this.client.setEx(key, expirySeconds, value)
    } else {
      await this.client.set(key, value)
    }
  }

  async get(key: string): Promise<string | null> {
    return await this.client.get(key)
  }

  async enqueue(queue: string, data: string) {
    await this.client.rPush(queue, data)
  }

  async dequeue(queue: string): Promise<string | null> {
    return await this.client.lPop(queue)
  }

  async close() {
    await this.client.quit()
  }
}

export const redis = new RedisClient()
