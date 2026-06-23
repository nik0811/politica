# Production Deployment Guide

## Prerequisites

- Docker & Docker Compose
- 8GB+ RAM
- 50GB+ Storage
- SSL Certificate (for HTTPS)

## Quick Deploy

### 1. Setup Environment
```bash
# Copy and configure environment
cp .env.production.template .env.production

# Generate secure passwords
openssl rand -base64 32  # For POSTGRES_PASSWORD
openssl rand -base64 32  # For REDIS_PASSWORD  
openssl rand -base64 64  # For API_SECRET_KEY

# Edit .env.production with generated values
nano .env.production
```

### 2. SSL Certificates
```bash
# Place SSL certificates
mkdir -p infrastructure/nginx/ssl
# Copy your SSL cert and key:
# - infrastructure/nginx/ssl/cert.pem
# - infrastructure/nginx/ssl/key.pem
```

### 3. Deploy
```bash
# Start all services
docker-compose -f docker-compose.prod.yml up -d

# Check status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f api
```

### 4. Initialize Database
```bash
# Run migrations
docker exec politica-api-prod python -m alembic upgrade head

# Create admin user
docker exec -it politica-api-prod python scripts/create_admin.py
```

### 5. Verify Deployment
```bash
# Health checks
curl https://your-domain.com/health
curl https://your-domain.com/api/stats

# API Documentation
open https://your-domain.com/docs
```

## Architecture

```
Internet
   ↓
NGINX (SSL, Load Balancer)
   ↓
FastAPI Backend (Port 8000)
   ↓
┌──────────────┬───────────────┬──────────────┐
│  PostgreSQL  │    Redis      │    MinIO     │
│  (Database)  │   (Cache)     │  (Storage)   │
└──────────────┴───────────────┴──────────────┘
        │              │              │
┌───────┴──────────────┴──────────────┴───────┐
│     Qdrant         Elasticsearch            │
│   (Vectors)         (Search)                │
└─────────────────────────────────────────────┘
```

## Services

| Service        | Port  | Purpose                    |
|---------------|-------|----------------------------|
| Nginx         | 80/443| Reverse proxy, SSL         |
| API           | 8000  | FastAPI backend            |
| PostgreSQL    | 5432  | Primary database           |
| Redis         | 6379  | Cache & job queue          |
| MinIO         | 9000  | Object storage             |
| Qdrant        | 6333  | Vector database            |
| Elasticsearch | 9200  | Full-text search           |
| Processor     | -     | Background NLP processing  |
| Collector     | -     | Web scraping daemon        |

## Scaling

### Horizontal Scaling
```yaml
# Scale API instances
docker-compose -f docker-compose.prod.yml up -d --scale api=3

# Scale processor
docker-compose -f docker-compose.prod.yml up -d --scale processor=2
```

### Database Replication
```yaml
# Add read replica
postgres-replica:
  image: postgres:15-alpine
  environment:
    POSTGRES_REPLICATION_MODE: slave
    POSTGRES_MASTER_HOST: postgres
```

## Monitoring

### Logs
```bash
# View all logs
docker-compose -f docker-compose.prod.yml logs

# Specific service
docker-compose -f docker-compose.prod.yml logs -f api

# Export logs
docker-compose -f docker-compose.prod.yml logs > logs.txt
```

### Metrics
```bash
# Database stats
docker exec politica-postgres-prod psql -U politica -d politica -c "SELECT count(*) FROM documents;"

# Redis stats
docker exec politica-redis-prod redis-cli info stats

# Container stats
docker stats
```

## Backup & Recovery

### Database Backup
```bash
# Backup
docker exec politica-postgres-prod pg_dump -U politica politica > backup.sql

# Restore
docker exec -i politica-postgres-prod psql -U politica politica < backup.sql
```

### MinIO Backup
```bash
# Backup MinIO data
docker run --rm -v politica_minio_data:/data -v $(pwd):/backup ubuntu tar czf /backup/minio-backup.tar.gz /data
```

## Security Checklist

- [ ] Strong passwords in .env.production
- [ ] SSL certificates installed
- [ ] Firewall configured (only 80, 443 open)
- [ ] Database not exposed to public
- [ ] Redis password protected
- [ ] MinIO access keys secure
- [ ] API rate limiting enabled
- [ ] Audit logging enabled
- [ ] Backups automated
- [ ] Monitoring alerts configured

## Troubleshooting

### Service Won't Start
```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs service-name

# Check health
docker-compose -f docker-compose.prod.yml ps

# Restart service
docker-compose -f docker-compose.prod.yml restart service-name
```

### Database Connection Failed
```bash
# Check PostgreSQL
docker exec politica-postgres-prod pg_isready -U politica

# Check connectivity from API
docker exec politica-api-prod ping -c 3 postgres
```

### Out of Memory
```bash
# Check memory usage
docker stats

# Restart with more memory
docker-compose -f docker-compose.prod.yml down
# Edit docker-compose.prod.yml to add memory limits
docker-compose -f docker-compose.prod.yml up -d
```

## Maintenance

### Update Application
```bash
# Pull latest code
git pull origin main

# Rebuild containers
docker-compose -f docker-compose.prod.yml build

# Rolling update (zero downtime)
docker-compose -f docker-compose.prod.yml up -d --no-deps --build api
```

### Clean Up
```bash
# Remove unused images
docker image prune -a

# Remove unused volumes (careful!)
docker volume prune

# Full cleanup
docker system prune -a --volumes
```

## Performance Tuning

### PostgreSQL
```sql
-- Increase shared_buffers
ALTER SYSTEM SET shared_buffers = '2GB';
ALTER SYSTEM SET effective_cache_size = '6GB';
```

### Elasticsearch
```yaml
environment:
  - "ES_JAVA_OPTS=-Xms2g -Xmx2g"
```

### Redis
```bash
# Increase max memory
redis-cli CONFIG SET maxmemory 2gb
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

## Support

- Documentation: https://docs.politica.com
- Issues: https://github.com/your-org/politica/issues
- Email: support@politica.com
