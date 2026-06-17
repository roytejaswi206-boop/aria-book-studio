# ARIA Book Studio - Deployment Guide

**Last Updated:** 2026-05-30  
**Status:** Production Ready

---

## TABLE OF CONTENTS

1. [Local Development](#local-development)
2. [GitHub Setup](#github-setup)
3. [Vercel Deployment](#vercel-deployment)
4. [Supabase Integration](#supabase-integration)
5. [Docker Deployment](#docker-deployment)
6. [Environment Variables](#environment-variables)
7. [Monitoring & Observability](#monitoring--observability)
8. [Backup & Recovery](#backup--recovery)
9. [Production Checklist](#production-checklist)
10. [Troubleshooting](#troubleshooting)

---

## Local Development

### Prerequisites
- Node.js v18+ (currently v24.15.0 ✅)
- npm v9+ (currently v11.12.1 ✅)
- PowerShell or Command Prompt

### Quick Start

#### 1. Navigate to Project
```powershell
cd 'C:\Users\Tejaswi\OneDrive\ARIS\aria-book-studio'
```

#### 2. Start Development Server
```powershell
npm run dev
```

Expected output:
```
[ARIA] server started { url: 'http://localhost:3001' }
```

#### 3. Open Application
Open browser and navigate to:
```
http://localhost:3001
```

#### 4. Available Commands
```powershell
npm run dev         # Start development server
npm start          # Start production server
npm run build      # Run full validation
npm run lint       # Code quality check
npm run typecheck  # Node.js syntax validation
npm run test       # Run test suite
```

### Stopping the Server
```powershell
# Press Ctrl+C in terminal
```

---

## GitHub Setup

### Step 1: Initialize Git Repository

#### If Starting Fresh
```powershell
cd 'C:\Users\Tejaswi\OneDrive\ARIS\aria-book-studio'

# Initialize git
git init

# Add all files
git add .

# Create first commit
git commit -m "ARIA Book Studio - Initial production build"

# Set main branch
git branch -M main
```

#### If Already on GitHub
Skip to Step 2.

### Step 2: Create GitHub Repository

1. Go to [GitHub.com](https://github.com)
2. Click **New Repository**
3. Enter repository name: `aria-book-studio`
4. Add description: "ARIA Book Studio - AI-powered autonomous book creation platform"
5. Choose visibility: **Public** (recommended) or **Private**
6. Click **Create Repository**

### Step 3: Connect Local Repository

```powershell
# Replace YOUR_USERNAME with your GitHub username
git remote add origin https://github.com/YOUR_USERNAME/aria-book-studio.git

# Verify remote
git remote -v
```

### Step 4: Push to GitHub

```powershell
# Push code to GitHub
git push -u origin main

# Verify on GitHub
# Navigate to: https://github.com/YOUR_USERNAME/aria-book-studio
```

### Step 5: GitHub Actions CI/CD

The project includes GitHub Actions workflows in `.github/workflows/`

#### To Enable Actions:
1. Go to your GitHub repository
2. Click **Actions** tab
3. Click **I understand my workflows, go ahead and enable them**

#### Available Workflows
- **build.yml** - Runs npm build and validation
- **deploy.yml** - Deploys to Vercel (if configured)

#### Manual Trigger
```powershell
# Trigger workflow via git event
git push origin main
```

---

## Vercel Deployment

### Step 1: Create Vercel Account

1. Go to [Vercel.com](https://vercel.com)
2. Click **Sign Up**
3. Choose **GitHub** authentication
4. Authorize Vercel to access your GitHub account

### Step 2: Create Vercel Project

#### Option A: Import from GitHub (Recommended)
1. In Vercel dashboard, click **New Project**
2. Search for `aria-book-studio` repository
3. Click **Import**
4. Click **Deploy** (uses auto-detected settings)

#### Option B: Manual Configuration
1. Click **Settings** during import
2. Configure build command: `npm run build`
3. Configure output directory: `public`
4. Set environment variables (see below)

### Step 3: Configure Environment Variables in Vercel

In Vercel project **Settings** → **Environment Variables**, add:

```
NODE_ENV = production
PORT = 3000
APP_BASE_URL = your-app.vercel.app
```

### Step 4: Deploy

```powershell
# Option 1: Manual deployment from GitHub
# - Push to main branch
# - Vercel auto-deploys

# Option 2: Using Vercel CLI
npm install -g vercel
vercel

# Follow prompts and accept defaults
```

### Step 5: Custom Domain (Optional)

1. Go to Vercel project **Settings**
2. Click **Domains**
3. Enter your domain
4. Follow DNS configuration instructions

### Verify Deployment

1. Visit your Vercel URL
2. Check server response: `GET /health`
3. Create a test book
4. Export to verify export functionality

---

## Supabase Integration

### Step 1: Create Supabase Project

1. Go to [Supabase.com](https://supabase.com)
2. Click **New Project**
3. Sign in with GitHub (recommended)
4. Configure:
   - Project name: `aria-book-studio`
   - Database password: Generate strong password
   - Region: Select closest region
5. Click **Create New Project**

### Step 2: Get Credentials

Navigate to **Project Settings** → **API**

Copy these values:
- `SUPABASE_URL` - Project URL
- `SUPABASE_ANON_KEY` - Anon Key (public)
- `SUPABASE_SERVICE_KEY` - Service Key (private)

### Step 3: Configure Environment Variables

Create/update `.env` file:

```bash
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Step 4: Initialize Database Schema

Run migrations:
```powershell
# Using Supabase CLI
supabase link
supabase db push
```

Or manually in Supabase SQL Editor:

```sql
-- Create tables
CREATE TABLE books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID REFERENCES books(id),
  chapter_number INTEGER,
  title TEXT NOT NULL,
  content TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Step 5: Update Server Configuration

The server automatically detects Supabase credentials from `.env`

No code changes needed - database operations will sync to Supabase.

---

## Docker Deployment

### Step 1: Build Docker Image

```powershell
cd 'C:\Users\Tejaswi\OneDrive\ARIS\aria-book-studio'

# Build image
docker build -t aria-book-studio:latest .

# Verify image
docker images | grep aria-book-studio
```

### Step 2: Run Container

```powershell
# Run container
docker run -p 3001:3001 aria-book-studio:latest

# With environment variables
docker run `
  -p 3001:3001 `
  -e NODE_ENV=production `
  -e PORT=3001 `
  aria-book-studio:latest
```

### Step 3: Using Docker Compose

```powershell
# Build and start all services
docker compose up --build

# Run in background
docker compose up -d --build

# Stop services
docker compose down

# View logs
docker compose logs -f
```

### Step 4: Verify Container

```powershell
# Check if running
docker ps | grep aria-book-studio

# Test health
curl http://localhost:3001/health

# View logs
docker logs <CONTAINER_ID>
```

### Step 5: Push to Docker Hub (Optional)

```powershell
# Tag image
docker tag aria-book-studio:latest YOUR_DOCKERHUB_USERNAME/aria-book-studio:latest

# Login to Docker Hub
docker login

# Push image
docker push YOUR_DOCKERHUB_USERNAME/aria-book-studio:latest
```

---

## Environment Variables

### Complete Configuration

Create `.env` file at project root:

```bash
# Server Configuration
NODE_ENV=production
PORT=3001
APP_BASE_URL=http://localhost:3001

# ARIA-Specific
ARIA_DATA_DIR=./data
ARIA_GENERATION_YIELD_MS=2
ARIA_JOB_PERSIST_INTERVAL_MS=1500
ARIA_JOB_PERSIST_CHAPTER_INTERVAL=10
ARIA_DISABLE_AUTO_RESUME=0

# GitHub Integration
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_TOKEN=
GITHUB_REPOSITORY=YOUR_USERNAME/aria-book-studio

# Vercel Integration
VERCEL_TOKEN=
VERCEL_PROJECT_ID=
VERCEL_PROJECT_NAME=aria-storyverse
VERCEL_ORG_ID=

# Supabase Integration
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=

# Cloudflare Integration
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_ZONE_ID=

# Observability
SENTRY_DSN=
OTEL_EXPORTER_OTLP_ENDPOINT=
```

### Setting Environment Variables

#### Local (PowerShell)
```powershell
$env:NODE_ENV = "production"
$env:PORT = "3001"
npm run dev
```

#### Local (.env file)
```bash
# .env
NODE_ENV=production
PORT=3001
```

#### Vercel
Dashboard → Project Settings → Environment Variables → Add

#### Docker
```bash
docker run -e NODE_ENV=production aria-book-studio:latest
```

#### Docker Compose
```yaml
environment:
  NODE_ENV: production
  PORT: 3001
```

---

## Monitoring & Observability

### Using Sentry for Error Tracking

1. Create [Sentry.io](https://sentry.io) account
2. Create Node.js project
3. Copy DSN
4. Add to `.env`:
   ```
   SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/123456
   ```

### Using OpenTelemetry

1. Set up OpenTelemetry collector
2. Configure endpoint:
   ```
   OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
   ```

### Logging

Logs are saved to:
- `server.out.log` - Standard output
- `server.err.log` - Errors
- `data/validation-runs/` - Validation reports

### Performance Monitoring

Use built-in validation:
```powershell
npm run build  # Comprehensive validation including performance
```

---

## Backup & Recovery

### Automated Backups

Data is stored in `data/db.json` with atomic writes.

#### Backup Script
```powershell
# Create backup
Copy-Item data/db.json "backups/db.backup.$(Get-Date -f 'yyyyMMdd-HHmmss').json"

# Schedule via Task Scheduler
$action = New-ScheduledTaskAction -Execute 'PowerShell.exe' `
  -Argument "-Command Copy-Item data/db.json backups/db.backup.json"
Register-ScheduledTask -Action $action -Trigger (New-ScheduledTaskTrigger -Daily -At 2am) `
  -TaskName 'ARIA-Backup' -Description 'Daily ARIA database backup'
```

### Manual Backup
```powershell
# Backup before making changes
Copy-Item data/db.json data/db.json.backup

# Restore from backup
Copy-Item data/db.json.backup data/db.json
```

### Cloud Backup (Supabase)

If using Supabase:
1. Data automatically synced to Supabase
2. Access backups in Supabase dashboard
3. Supabase provides automated daily backups

### Recovery Procedure

```powershell
# 1. Stop server
# Ctrl+C

# 2. Restore from backup
Copy-Item data/db.json.backup data/db.json

# 3. Restart server
npm run dev
```

---

## Production Checklist

### Pre-Deployment
- [ ] Environment variables configured
- [ ] Database backup created
- [ ] Tests passing (`npm run build`)
- [ ] Validation successful
- [ ] Security review completed
- [ ] Performance tested
- [ ] Error handling verified
- [ ] Logging enabled

### Deployment
- [ ] Code pushed to main branch
- [ ] GitHub Actions completed successfully
- [ ] Vercel deployment triggered
- [ ] Build completed without errors
- [ ] Environment variables set in Vercel
- [ ] All endpoints responding
- [ ] Database connected
- [ ] Static assets loading

### Post-Deployment
- [ ] Application accessible at deployment URL
- [ ] Health check passing
- [ ] Create test book (verify functionality)
- [ ] Export test book (verify all formats)
- [ ] Check server logs for errors
- [ ] Monitor error tracking (Sentry)
- [ ] Set up monitoring alerts
- [ ] Schedule backup tasks

### Ongoing Maintenance
- [ ] Monitor performance metrics
- [ ] Review logs weekly
- [ ] Update dependencies monthly
- [ ] Security patches applied immediately
- [ ] Backup verified working
- [ ] Recovery procedure tested quarterly

---

## Troubleshooting

### Deployment Issues

#### Build Fails on Vercel
```
Solution:
1. Check Node.js version match
2. Verify npm install succeeds locally
3. Check for environment variable typos
4. Review Vercel build logs for specifics
```

#### Environment Variables Not Loaded
```
Solution:
1. Verify .env file exists locally
2. Check variable names match exactly
3. Restart server after .env changes
4. In Vercel: Settings → Environment Variables → verify listed
```

#### Database Connection Issues
```
Solution:
1. Verify SUPABASE_URL format
2. Check SUPABASE_ANON_KEY validity
3. Test connection with curl:
   curl -H "Authorization: Bearer KEY" SUPABASE_URL/rest/v1/books
4. Check Supabase dashboard for status
```

#### Port Already in Use
```powershell
# Find process using port 3001
netstat -ano | findstr :3001

# Kill process (replace PID)
taskkill /PID <PID> /F

# Or use different port
$env:PORT = "3002"
npm run dev
```

#### Memory Issues
```
Solution:
1. Reduce ARIA_JOB_PERSIST_INTERVAL_MS
2. Increase Node.js memory:
   node --max-old-space-size=4096 server.js
3. Implement paging for large exports
4. Use streaming for file operations
```

---

## Security Best Practices

### Secrets Management
- ✅ Never commit `.env` files
- ✅ Use environment variables for secrets
- ✅ Rotate tokens regularly
- ✅ Use service keys only on backend
- ✅ Limit API key permissions

### CORS Configuration
- ✅ Whitelist specific domains in production
- ✅ Remove wildcard (`*`) origin
- ✅ Enable only necessary methods
- ✅ Restrict headers

### Database Security
- ✅ Use strong passwords
- ✅ Enable SSL connections
- ✅ Regular backups
- ✅ Row-level security (RLS)
- ✅ Audit logging

### API Security
- ✅ Implement rate limiting
- ✅ Validate all inputs
- ✅ Use HTTPS in production
- ✅ Set secure headers
- ✅ Monitor suspicious activity

---

## Performance Optimization

### Server-Side
```bash
# Enable production mode
NODE_ENV=production

# Optimize garbage collection
node --expose-gc server.js

# Monitor memory
node --inspect server.js
```

### Client-Side
- Enable gzip compression
- Minify CSS/JS
- Lazy load images
- Cache static assets
- Use CDN for distribution

### Database
- Add indexes for frequently queried fields
- Archive old data
- Implement query optimization
- Use connection pooling
- Monitor query performance

---

## Support & Resources

### Documentation
- [ARIA_AUDIT_REPORT.md](./ARIA_AUDIT_REPORT.md) - Comprehensive system review
- [FINAL_VERIFICATION_REPORT.md](./FINAL_VERIFICATION_REPORT.md) - Verification results
- [README.md](./README.md) - Project documentation

### External Resources
- [Node.js Docs](https://nodejs.org/docs/)
- [Vercel Docs](https://vercel.com/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Docker Docs](https://docs.docker.com/)

### Getting Help
1. Check troubleshooting section above
2. Review error logs
3. Check GitHub Issues
4. Contact support via project repository

---

## Deployment Summary

### Local Development
```powershell
npm run dev
# Opens http://localhost:3001
```

### Production on Vercel
```powershell
git push origin main
# Auto-deploys via GitHub Actions
# Live at: your-app.vercel.app
```

### Self-Hosted with Docker
```powershell
docker compose up --build
# Running on configured PORT
```

### With Supabase Backend
```bash
# Configure .env
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
# Auto-syncs database to Supabase
```

---

## Next Steps

1. **Choose deployment platform** (Vercel, Docker, Self-hosted)
2. **Configure environment variables** (API keys, credentials)
3. **Run validation** (`npm run build`)
4. **Deploy** (via Vercel, Docker, or manual)
5. **Monitor** (logs, errors, performance)
6. **Backup** (daily automated backups)
7. **Scale** (add resources as needed)

---

**Last Updated:** 2026-05-30  
**Status:** Ready for Deployment  
**Support:** See ARIA_AUDIT_REPORT.md for technical details
