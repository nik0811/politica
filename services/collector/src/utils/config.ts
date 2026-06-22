import dotenv from 'dotenv'

dotenv.config()

export const config = {
  // Node environment
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database
  databaseUrl: process.env.DATABASE_URL || 'postgresql://politica:politica_dev_pass@localhost:5432/politica',
  
  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  
  // MinIO
  minio: {
    endpoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT || '9000'),
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    useSSL: process.env.MINIO_USE_SSL === 'true',
    bucket: 'politica-screenshots'
  },
  
  // Browser settings
  browser: {
    mode: process.env.BROWSER_MODE as 'headless' | 'headed' || 'headless',
    stealthMode: process.env.STEALTH_MODE === 'true',
    maxConcurrent: parseInt(process.env.MAX_CONCURRENT_BROWSERS || '3'),
  },
  
  // Collection settings
  collection: {
    retryAttempts: parseInt(process.env.RETRY_ATTEMPTS || '3'),
    retryDelayMs: parseInt(process.env.RETRY_DELAY_MS || '5000'),
    screenshotQuality: 80,
    timeout: 30000, // 30 seconds
  }
}
