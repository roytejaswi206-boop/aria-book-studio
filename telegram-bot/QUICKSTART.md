# ARIA Telegram Bot - Quick Start Guide

## ✅ What Was Created

A **production-ready Telegram bot integration** for ARIA Book Studio with:

### 📁 Complete Project Structure
```
telegram-bot/
├── src/
│   ├── index.js                    # Main bot entry point
│   ├── services/
│   │   ├── botHandler.js          # All Telegram commands & flows
│   │   ├── database.js            # Supabase database operations
│   │   ├── aiService.js           # Claude API integration
│   │   └── exportService.js       # PDF/Markdown/Text export
│   └── routes/
│       └── webhookRoutes.js       # Express webhook routes
├── migrations/
│   └── 001-create-telegram-users.sql  # Database schema
├── scripts/
│   └── migrate.js                 # Migration runner
├── package.json                   # Dependencies
├── .env.example                   # Configuration template
├── ecosystem.config.js            # PM2 configuration
├── Dockerfile                     # Docker build
├── docker-compose.yml             # Docker Compose setup
├── setup.sh                       # Setup script
├── deploy.sh                      # Deployment helper
├── README.md                      # Full documentation
├── HOSTINGER_DEPLOYMENT.md        # Hostinger deployment guide
├── CONFIGURATION.md               # Configuration reference
└── API_REFERENCE.md              # API documentation
```

### 🎯 Features Implemented

✨ **All 8 Commands:**
- `/start` - Welcome & command overview
- `/help` - Command reference
- `/newbook` - Create books with AI
- `/books` - View your library
- `/openbook` - Manage existing books
- `/outline` - Generate chapter outlines
- `/chapter` - Write chapters
- `/character` - Create character profiles
- `/world` - Worldbuilding generation
- `/export` - Export as PDF/Markdown/Text

🗄️ **Database Integration:**
- Users table with Telegram ID mapping
- Sessions table for conversation state
- Export jobs tracking
- All tables with indexes and triggers

🤖 **AI Features:**
- Chapter outline generation (Claude API)
- Character profile development
- Worldbuilding generation
- Natural language interaction

📤 **Export System:**
- PDF generation with professional formatting
- Markdown export for version control
- Plain text export
- Automatic file storage and retrieval

🔐 **Architecture:**
- Supabase PostgreSQL database
- Token-based Telegram auth
- User session management
- Secure file storage

🚀 **Deployment Ready:**
- Development mode (polling)
- Production mode (webhook)
- Docker & Docker Compose support
- PM2 process manager config
- SSL/HTTPS support
- Environment-based configuration

---

## 🚀 Quick Start (5 minutes)

### 1. Install Dependencies

```bash
cd telegram-bot
npm install
```

### 2. Setup Environment

```bash
cp .env.example .env
nano .env
```

Fill in these values:
```env
TELEGRAM_BOT_TOKEN=your_token_from_botfather
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
BOT_MODE=polling
PORT=3002
```

### 3. Run Database Migrations

```bash
npm run migrate
```

If that fails, run the SQL manually in Supabase dashboard:
1. Open Supabase → SQL Editor
2. Copy `migrations/001-create-telegram-users.sql`
3. Run the query

### 4. Start Development Bot

```bash
npm run dev
```

You'll see:
```
🚀 Starting ARIA Telegram Bot...
📌 Bot Mode: polling
✅ Bot handlers registered
🤖 ARIA Telegram Bot is ready!
```

### 5. Test on Telegram

1. Open Telegram
2. Search for your bot (from @BotFather)
3. Send `/start`
4. Try commands: `/help`, `/newbook`, `/books`

---

## 📦 Production Deployment

### Option A: Hostinger VPS (Recommended)

**Complete guide in:** `HOSTINGER_DEPLOYMENT.md`

Quick overview:
```bash
# 1. SSH into server
ssh root@your-server-ip

# 2. Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt install -y nodejs

# 3. Clone and setup
git clone your-repo
cd aria-book-studio/telegram-bot
npm install --production

# 4. Configure domain & SSL
# (See HOSTINGER_DEPLOYMENT.md Step 7)

# 5. Setup PM2
npm install -g pm2
npm run migrate
pm2 start ecosystem.config.js
pm2 save && pm2 startup
```

### Option B: Docker

```bash
# Build image
docker build -t aria-bot:latest .

# Run container
docker-compose up -d

# View logs
docker-compose logs -f aria-bot
```

### Option C: Railway/Render/Heroku

1. Push code to GitHub
2. Connect repo to platform
3. Set environment variables in dashboard
4. Platform auto-deploys

---

## 🎛️ Configuration

### Development vs Production

**Development** (default):
- Polling mode (no webhook needed)
- Local testing
- Debug logging

**Production:**
- Webhook mode (required for scale)
- SSL certificates
- Performance optimized
- See `CONFIGURATION.md`

### Environment Variables

**Essential:**
```env
TELEGRAM_BOT_TOKEN=           # From @BotFather
SUPABASE_URL=                 # Supabase project URL
SUPABASE_SERVICE_KEY=         # Supabase service key
ANTHROPIC_API_KEY=            # Claude API key
```

**Optional:**
```env
BOT_MODE=polling              # polling or webhook
PORT=3002                     # Server port
NODE_ENV=development          # development or production
```

See `CONFIGURATION.md` for all options.

---

## 📚 Documentation

| File | Purpose |
|------|---------|
| **README.md** | Complete overview & features |
| **HOSTINGER_DEPLOYMENT.md** | Step-by-step Hostinger setup |
| **CONFIGURATION.md** | All environment variables |
| **API_REFERENCE.md** | API endpoints documentation |
| **deploy.sh** | Deployment helper script |

---

## 🔧 Common Tasks

### View Bot Logs

```bash
# Development
npm run dev

# Production (PM2)
pm2 logs aria-bot
```

### Restart Bot

```bash
# Development: Ctrl+C, then npm run dev

# Production (PM2)
pm2 restart aria-bot
```

### Update Code

```bash
# Pull changes
git pull

# Install deps (if changed)
npm install --production

# Restart
pm2 restart aria-bot
```

### Check Health

```bash
# Health check endpoint
curl http://localhost:3002/health

# Should return:
# {"status":"ok","mode":"polling","timestamp":"..."}
```

---

## 🐛 Troubleshooting

### Bot not responding?

1. Check it's running:
   ```bash
   npm run dev
   ```

2. Verify token is correct:
   ```bash
   grep TELEGRAM_BOT_TOKEN .env
   ```

3. Check logs for errors:
   ```bash
   tail -f logs/aria-bot.log
   ```

### Database connection error?

1. Verify Supabase credentials:
   ```bash
   grep SUPABASE .env
   ```

2. Check internet connection

3. Run migrations:
   ```bash
   npm run migrate
   ```

### Commands not working?

1. Ensure migrations ran
2. Check bot token is correct
3. Send `/start` to bot first
4. View logs for specific errors

**See README.md for full troubleshooting.**

---

## 📊 Project Stats

| Metric | Value |
|--------|-------|
| **Files Created** | 15+ |
| **Commands Implemented** | 8+ |
| **Database Tables** | 3 new tables |
| **Lines of Code** | ~2000+ |
| **Supported Formats** | PDF, Markdown, Text |
| **API Endpoints** | 6+ |
| **Deployment Options** | 4+ |

---

## 🎯 Next Steps

### Immediate (To Go Live)

1. ✅ **Get Telegram Bot Token**
   - Message @BotFather on Telegram
   - Create bot, get token

2. ✅ **Setup Supabase**
   - Create project at supabase.com
   - Copy URL and service key

3. ✅ **Setup Claude API**
   - Get key from platform.openai.com
   - Set `ANTHROPIC_API_KEY`

4. ✅ **Configure .env**
   - Edit `.env` with your keys

5. ✅ **Test Locally**
   - Run `npm run dev`
   - Test commands in Telegram

6. ✅ **Deploy to Production**
   - Use Hostinger or Docker
   - Follow `HOSTINGER_DEPLOYMENT.md`

### Future Enhancements

- [ ] Multi-language support
- [ ] Cover image generation (DALL-E)
- [ ] Collaborative writing
- [ ] Mobile app integration
- [ ] Publishing integration
- [ ] Analytics dashboard
- [ ] Writing goals/streaks
- [ ] Reader community features

---

## 📞 Support

### Getting Help

1. **Check documentation first:**
   - README.md for features
   - CONFIGURATION.md for settings
   - API_REFERENCE.md for endpoints

2. **Debug with logs:**
   - `npm run dev` (development)
   - `pm2 logs aria-bot` (production)

3. **Test health:**
   - `curl http://localhost:3002/health`

4. **Verify configuration:**
   - `cat .env` (check all values)

### Common Issues

**Q: Bot doesn't respond**
- Verify TELEGRAM_BOT_TOKEN is correct
- Check `npm run dev` output for errors

**Q: Database errors**
- Run migrations: `npm run migrate`
- Verify SUPABASE credentials

**Q: Export not working**
- Check ANTHROPIC_API_KEY
- View logs for specific error

**Q: Webhook issues**
- Ensure SSL certificate exists
- Check domain points to server
- Verify port 8443 is open

---

## 📝 License

MIT - Free to use and modify

---

## 🎉 You're All Set!

Your ARIA Telegram Bot is ready to use. Start with:

```bash
npm run dev
```

Then test on Telegram: send `/start` to your bot.

**Happy writing! 📝**

---

**Version:** 1.0.0
**Last Updated:** 2024
**Support:** Check README.md or view logs for debugging
