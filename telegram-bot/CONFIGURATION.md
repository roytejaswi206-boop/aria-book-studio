# ARIA Book Studio Telegram Bot - Configuration Guide

## Development vs Production

### Development Configuration

```env
# .env.development
NODE_ENV=development
BOT_MODE=polling
PORT=3002

# Database (Supabase)
SUPABASE_URL=https://your-dev-project.supabase.co
SUPABASE_SERVICE_KEY=dev_service_key_here

# AWS Bedrock Configuration
AWS_ACCESS_KEY_ID=your_dev_access_key
AWS_SECRET_ACCESS_KEY=your_dev_secret_key
AWS_REGION=us-east-1
MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0

# Telegram
TELEGRAM_BOT_TOKEN=dev_bot_token_here

# Optional: Enable verbose logging
DEBUG=aria:*
```

### Production Configuration

```env
# .env.production
NODE_ENV=production
BOT_MODE=webhook
PORT=3002

# Domain configuration for webhook
TELEGRAM_WEBHOOK_URL=https://your-production-domain.com
TELEGRAM_WEBHOOK_PORT=8443
BOT_WEBHOOK_PATH=/webhook/telegram

# Database (Production Supabase)
SUPABASE_URL=https://your-prod-project.supabase.co
SUPABASE_SERVICE_KEY=prod_service_key_here

# AWS Bedrock (Production Credentials)
AWS_ACCESS_KEY_ID=your_prod_access_key
AWS_SECRET_ACCESS_KEY=your_prod_secret_key
AWS_REGION=us-east-1
MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0

# Telegram
TELEGRAM_BOT_TOKEN=prod_bot_token_here

# Performance settings
MAX_MEMORY_RESTART=500M
```

## Feature Flags

Enable/disable features through environment variables:

```env
# Features
ENABLE_CHAPTER_GENERATION=true
ENABLE_CHARACTER_PROFILES=true
ENABLE_WORLD_BUILDING=true
ENABLE_PDF_EXPORT=true
ENABLE_MARKDOWN_EXPORT=true

# Limits
MAX_BOOKS_PER_USER=100
MAX_CHAPTERS_PER_BOOK=500
MAX_CHARACTERS_PER_BOOK=200
MAX_PDF_SIZE_MB=50
MAX_EXPORT_JOBS_CONCURRENT=3

# Timeouts
AI_REQUEST_TIMEOUT_MS=30000
DATABASE_QUERY_TIMEOUT_MS=10000
SESSION_EXPIRY_HOURS=24
EXPORT_EXPIRY_DAYS=7
```

## Logging Configuration

### Log Levels

```env
# 0 = ERROR, 1 = WARN, 2 = INFO, 3 = DEBUG, 4 = TRACE
LOG_LEVEL=2

# Log output
LOG_TO_FILE=true
LOG_FILE_PATH=./logs/aria-bot.log
LOG_FILE_MAX_SIZE=10M
LOG_FILES_TO_KEEP=10

# Console formatting
LOG_FORMAT=json  # or 'human'
LOG_WITH_TIMESTAMPS=true
LOG_WITH_COLORS=true
```

### View Logs

```bash
# Development
npm run dev

# Production with PM2
pm2 logs aria-bot

# Tail specific log
tail -f logs/aria-bot.log

# Search logs
grep "error" logs/aria-bot.log
grep -i "user_id" logs/aria-bot.log | head -20
```

## Database Connection Options

### Option 1: Supabase (Recommended)

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Benefits:
- ✅ Zero setup
- ✅ Built-in authentication
- ✅ Automatic backups
- ✅ Real-time capabilities
- ✅ Vector support for embeddings

### Option 2: Self-Hosted PostgreSQL

```env
DATABASE_URL=postgresql://user:password@localhost:5432/aria_db
DB_HOST=localhost
DB_PORT=5432
DB_NAME=aria_db
DB_USER=postgres
DB_PASSWORD=your_password
DB_SSL=true
```

Connection string format:
```
postgresql://[user[:password]@][netloc][:port][/dbname][?param1=value1&...]
```

## API Integration

### AWS Bedrock Configuration (Claude AI)

AWS Bedrock provides Claude models with managed infrastructure.

```env
# AWS Credentials
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
AWS_REGION=us-east-1

# Model Configuration
MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0
```

#### Getting AWS Credentials

1. **Create AWS Account** (if needed):
   - Visit https://aws.amazon.com
   - Sign up or log in

2. **Create IAM User with Bedrock Access**:
   - Go to IAM → Users → Create user
   - Attach policy: `AmazonBedrockFullAccess`
   - Create access key (security credentials)
   - Copy `Access Key ID` and `Secret Access Key`

3. **Enable Bedrock in Your Region**:
   - Go to Bedrock console
   - Navigate to "Model access"
   - Request access to Claude models

4. **Set Environment Variables**:
   ```bash
   export AWS_ACCESS_KEY_ID="AKIA..."
   export AWS_SECRET_ACCESS_KEY="wJal..."
   export AWS_REGION="us-east-1"
   export MODEL_ID="anthropic.claude-3-5-sonnet-20241022-v2:0"
   ```

#### Available Claude Models via Bedrock

| Model ID | Latest Version |
|----------|---|
| Claude 3.5 Sonnet (Recommended) | `anthropic.claude-3-5-sonnet-20241022-v2:0` |
| Claude 3 Opus | `anthropic.claude-3-opus-20240229-v1:0` |
| Claude 3 Sonnet | `anthropic.claude-3-sonnet-20240229-v1:0` |
| Claude 3 Haiku | `anthropic.claude-3-haiku-20240307-v1:0` |

#### Bedrock Pricing

- **Pay-as-you-go**: Per token basis (recommended for development)
- **Provisioned Throughput**: Fixed cost for consistent usage
- Free tier: Some models have free tier access

#### Cost Estimation

For typical usage (10 books/month with outlines):
- ~50,000 input tokens/month
- ~20,000 output tokens/month
- Estimated cost: **~$0.50-1.50/month**

See: https://aws.amazon.com/bedrock/pricing/

## Telegram Configuration

### Bot Token

Get from @BotFather on Telegram:

1. Search for "BotFather"
2. Send `/newbot`
3. Follow instructions
4. Copy token: `1234567890:ABCDEFGHIJKLMNOPQRSTuvwxyz123456789`

```env
TELEGRAM_BOT_TOKEN=1234567890:ABCDEFGHIJKLMNOPQRSTuvwxyz123456789
```

### Webhook Configuration

For production deployment:

```env
BOT_MODE=webhook
TELEGRAM_WEBHOOK_URL=https://your-domain.com
TELEGRAM_WEBHOOK_PORT=8443
BOT_WEBHOOK_PATH=/webhook/telegram
```

Register webhook:
```bash
curl -X POST https://api.telegram.org/bot<TOKEN>/setWebhook \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"https://your-domain.com/webhook/telegram\"}"
```

### Polling Configuration (Development)

```env
BOT_MODE=polling
# No webhook URL needed
```

## Export Configuration

### Output Directory

```env
PDF_OUTPUT_DIR=./exports
EXPORT_CLEANUP_INTERVAL_HOURS=24  # Auto-cleanup old files
```

### PDF Settings

```env
PDF_PAGE_SIZE=A4              # or Letter
PDF_MARGIN_TOP=50
PDF_MARGIN_RIGHT=50
PDF_MARGIN_BOTTOM=50
PDF_MARGIN_LEFT=50
PDF_FONT_SIZE=11
PDF_LINE_HEIGHT=1.5
```

### Export Formats

```env
ENABLE_PDF_EXPORT=true
ENABLE_MARKDOWN_EXPORT=true
ENABLE_TEXT_EXPORT=true
ENABLE_EPUB_EXPORT=false    # Coming soon
ENABLE_DOCX_EXPORT=false    # Coming soon
```

## Performance Tuning

### Connection Pool

```env
# Database connections
DB_CONNECTION_POOL_SIZE=20
DB_CONNECTION_IDLE_TIMEOUT=30000  # milliseconds
DB_CONNECTION_MAX_LIFETIME=60000   # milliseconds
```

### Rate Limiting

```env
# Requests per minute
RATE_LIMIT_MESSAGES_PER_MINUTE=30
RATE_LIMIT_EXPORTS_PER_HOUR=10
RATE_LIMIT_API_CALLS_PER_MINUTE=100

# Cache
ENABLE_RESPONSE_CACHE=true
CACHE_TTL_SECONDS=300
```

### Memory Management

```env
# Node.js
NODE_OPTIONS=--max-old-space-size=512

# PM2
MAX_MEMORY_RESTART=500M
```

## Security

### HTTPS/SSL

```env
# Certificate paths
WEBHOOK_SSL_KEY=/etc/letsencrypt/live/your-domain.com/privkey.pem
WEBHOOK_SSL_CERT=/etc/letsencrypt/live/your-domain.com/fullchain.pem

# Or use Let's Encrypt auto-renewal
CERTBOT_EMAIL=admin@your-domain.com
AUTO_RENEW_CERTIFICATES=true
```

### CORS

```env
CORS_ORIGIN=https://your-domain.com,https://www.your-domain.com
CORS_METHODS=GET,POST,OPTIONS
CORS_CREDENTIALS=true
```

### API Security

```env
# API Key for external access
API_KEY=your-secret-api-key-here

# IP Whitelist (comma-separated)
IP_WHITELIST=192.168.1.1,10.0.0.0/8

# Rate limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=60000
```

## Hosting Platform Specific

### Railway

```env
# Railway will set these automatically
DATABASE_URL=...
PORT=3000  # Railway's default

# Add custom vars via dashboard
TELEGRAM_BOT_TOKEN=...
SUPABASE_URL=...
ANTHROPIC_API_KEY=...
```

### Render

```env
# Render .env file
TELEGRAM_BOT_TOKEN=your_token
# Render sets: PORT, NODE_ENV=production
```

### Heroku

```env
# Procfile content:
web: npm start

# Set vars via dashboard or CLI:
heroku config:set TELEGRAM_BOT_TOKEN=your_token
```

### Docker/Kubernetes

```env
# Docker Compose
DOCKER_IMAGE=aria-bot:1.0.0
DOCKER_REGISTRY=your-registry.com
```

## Monitoring & Observability

### Application Insights (Optional)

```env
ENABLE_APM=true
APM_SERVICE_NAME=aria-telegram-bot
APM_SERVER_URL=https://your-apm-server.com

# Or Sentry for error tracking
SENTRY_DSN=https://...
SENTRY_ENVIRONMENT=production
```

### Metrics

```env
# Prometheus metrics
ENABLE_METRICS=true
METRICS_PORT=9090
METRICS_PATH=/metrics

# Health check
HEALTH_CHECK_PORT=3002
HEALTH_CHECK_PATH=/health
```

## Environment File Templates

### Quick Start (Development)

```bash
# Copy template
cp .env.example .env

# Edit
nano .env

# Minimal required values:
TELEGRAM_BOT_TOKEN=your_token
SUPABASE_URL=your_url
SUPABASE_SERVICE_KEY=your_key
ANTHROPIC_API_KEY=your_key
```

### Production Checklist

- [ ] TELEGRAM_BOT_TOKEN set correctly
- [ ] TELEGRAM_WEBHOOK_URL points to domain
- [ ] BOT_MODE=webhook
- [ ] SSL certificates configured
- [ ] SUPABASE_URL uses production project
- [ ] SUPABASE_SERVICE_KEY is production key
- [ ] ANTHROPIC_API_KEY is valid
- [ ] NODE_ENV=production
- [ ] All database migrations run
- [ ] Firewall ports open (80, 443, 8443)
- [ ] Domain DNS configured
- [ ] SSL certificate valid
- [ ] Process manager (PM2) configured
- [ ] Backups configured

---

**For more help, see:**
- README.md
- HOSTINGER_DEPLOYMENT.md
- Troubleshooting section in README
