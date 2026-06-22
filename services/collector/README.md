# Politica Collector Service

Browser automation service for collecting data from social media platforms.

## Features

- **Hybrid Browser Automation**: Headless (production) + Headed (debugging with VNC)
- **Automatic Mode Switching**: Falls back to headed mode when issues detected
- **Issue Detection**: Bot detection, missing content, JavaScript errors
- **Data Validation**: Quality checks and historical comparison
- **Priority-based Scheduling**: High (5 min), Medium (hourly), Low (daily)
- **Screenshot Capture**: Automatic screenshot storage in MinIO
- **Connection Pooling**: Reusable browser instances for efficiency

## Quick Start

### Install Dependencies

```bash
cd services/collector
npm install
```

### Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

### Run Development

```bash
npm run dev
```

### Run Production

```bash
npm run build
npm start
```

## Architecture

```
src/
├── core/
│   ├── BrowserManager.ts          # Orchestrates headless/headed
│   ├── HeadlessBrowserPool.ts     # Pool of headless browsers
│   └── HeadedBrowserManager.ts    # Connects to Selenium+VNC
├── collectors/
│   └── InstagramCollector.ts      # Instagram-specific scraping
├── monitoring/
│   ├── IssueDetector.ts           # Detect bot detection, errors
│   └── DataValidator.ts           # Validate scraped data quality
├── scheduler/
│   └── CollectionScheduler.ts     # Priority-based job scheduling
└── utils/
    ├── config.ts                  # Configuration
    ├── logger.ts                  # Winston logging
    ├── database.ts                # PostgreSQL client
    ├── redis.ts                   # Redis queue client
    └── storage.ts                 # MinIO storage client
```

## Usage Examples

### Add a Collection Job

```typescript
scheduler.addJob({
  id: 'instagram_politician_page',
  url: 'https://www.instagram.com/p/example/',
  platform: 'instagram',
  priority: 'high',      // high, medium, low
  schedule: 'every_5min', // every_5min, hourly, daily
  enabled: true
})
```

### Scrape Manually

```typescript
const browserManager = new BrowserManager()
await browserManager.initialize()

const collector = new InstagramCollector()
const result = await browserManager.scrape(
  {
    url: 'https://www.instagram.com/p/example/',
    platform: 'instagram'
  },
  (page) => collector.collect(page, url)
)

console.log(result)
```

## How It Works

1. **Scheduler** adds jobs to Redis queue based on priority
2. **Service** dequeues jobs (high → medium → low priority)
3. **BrowserManager** tries headless mode first
4. **IssueDetector** checks for bot detection, missing content, errors
5. If issues found, **switches to headed mode** (viewable via VNC)
6. **DataValidator** compares with historical data
7. **Screenshots** saved to MinIO
8. **Documents** saved to PostgreSQL

## Monitoring

### View Headed Browser (VNC)

When headed mode is triggered, view at:
- **Web**: http://localhost:7900
- **VNC Client**: localhost:5900

### Logs

```bash
# Real-time logs
docker-compose logs -f collector-headless

# Error logs
cat services/collector/logs/error.log
```

### Queue Status

```bash
# Check Redis queues
docker-compose exec redis redis-cli
> LLEN collection:high
> LLEN collection:medium
> LLEN collection:low
```

## Supported Platforms

- ✅ Instagram (implemented)
- 🚧 X/Twitter (coming soon)
- 🚧 Telegram (coming soon)
- 🚧 News sites (coming soon)

## Testing

```bash
npm test
```

## Troubleshooting

### Browser Not Starting

- Ensure Playwright browsers are installed: `npx playwright install`
- Check Docker has enough memory (recommended 4GB+)

### Bot Detection Issues

- Service automatically switches to headed mode
- Check VNC view at http://localhost:7900
- May need to add cookies/login credentials

### Missing Content

- Increase timeout in `config.ts`
- Check page selectors in collector
- Enable debug logging: `LOG_LEVEL=debug npm run dev`
