# ⚡ Quick Commands Reference

## Setup (First Time Only)

```bash
# 1. Install dependencies
npm install

# 2. Copy configuration template
cp .env.example .env

# 3. Edit with your credentials (see STARTUP_GUIDE.md)
# Windows: notepad .env
# macOS/Linux: nano .env

# 4. Setup database (creates tables)
npm run migrate

# 5. Start the bot
npm run dev
```

## Starting the Bot (Regular Use)

```bash
npm run dev
```

## Expected Startup Output

```
🚀 Starting ARIA Telegram Bot...
📌 Bot Mode: polling
✅ Bot handlers registered
🤖 ARIA Telegram Bot is ready!
```

## Stopping the Bot

```
Press Ctrl+C in terminal
```

## Code Quality

```bash
# Check linting
npm run lint

# Check security vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix

# Update dependencies
npm update
```

## Useful Information

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start with auto-reload |
| `npm start` | Start production mode |
| `npm run migrate` | Setup database tables |
| `npm run lint` | Check code quality |
| `npm audit` | Check security |
| `npm list` | Show installed packages |

## Environment Variables Required

```env
TELEGRAM_BOT_TOKEN=your_token_from_botfather
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0
PORT=3002
NODE_ENV=development
BOT_MODE=polling
```

## Bot Testing in Telegram

Once running, test these commands:
- `/start` - Welcome
- `/help` - Command list
- `/newbook` - Create book
- `/books` - List books
- `/outline` - Generate outline
- `/export` - Export book
- See README.md for all 10 commands

## Getting Help

1. **Setup Issues:** See `STARTUP_GUIDE.md`
2. **Configuration:** See `CONFIGURATION.md`
3. **What Changed:** See `REFACTORING_REPORT.md`
4. **Features:** See `README.md`
5. **Complete Summary:** See `REFACTORING_COMPLETE.md`

## Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| Module not found | Run `npm install` |
| Bot doesn't start | Check `.env` file is complete |
| Commands not working | Verify `TELEGRAM_BOT_TOKEN` |
| AI features error | Check AWS credentials |
| Database error | Run `npm run migrate` |
| Linting warnings | Run `npm run lint` |

## Version Info

- **Node.js:** 18+ required
- **npm:** 9+ required
- **Bot Version:** v2.0.0
- **Status:** ✅ Production Ready

---

**For detailed guides, see the documentation files.**
