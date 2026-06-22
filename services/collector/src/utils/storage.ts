import * as Minio from 'minio'
import { config } from './config'
import { logger } from './logger'

class StorageClient {
  private client: Minio.Client
  private bucket: string

  constructor() {
    this.client = new Minio.Client({
      endPoint: config.minio.endpoint,
      port: config.minio.port,
      useSSL: config.minio.useSSL,
      accessKey: config.minio.accessKey,
      secretKey: config.minio.secretKey
    })
    this.bucket = config.minio.bucket
  }

  async ensureBucket() {
    const exists = await this.client.bucketExists(this.bucket)
    if (!exists) {
      await this.client.makeBucket(this.bucket, 'us-east-1')
      logger.info(`Created bucket: ${this.bucket}`)
    }
  }

  async saveScreenshot(fileName: string, buffer: Buffer): Promise<string> {
    await this.client.putObject(
      this.bucket,
      fileName,
      buffer,
      buffer.length,
      { 'Content-Type': 'image/png' }
    )
    
    const url = `http://${config.minio.endpoint}:${config.minio.port}/${this.bucket}/${fileName}`
    return url
  }

  async saveFile(fileName: string, buffer: Buffer, contentType: string): Promise<string> {
    await this.client.putObject(
      this.bucket,
      fileName,
      buffer,
      buffer.length,
      { 'Content-Type': contentType }
    )
    
    const url = `http://${config.minio.endpoint}:${config.minio.port}/${this.bucket}/${fileName}`
    return url
  }
}

export const storage = new StorageClient()
