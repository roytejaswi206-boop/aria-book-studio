# 🚀 ARIA Telegram Bot v2.0.0 - Startup Guide

**Latest Version:** 2.0.0  
**Last Updated:** December 18, 2024  
**Status:** ✅ Production Ready

---

## What Changed in v2.0.0?

### ✨ Major Improvements
- **Anthropic API → AWS Bedrock** - Now uses AWS Bedrock for Claude models
- **Simplified Setup** - Removed Hostinger-specific complexity
- **Local Development** - Focused on polling mode (no server config needed)
- **Updated Dependencies** - All packages at latest stable versions
- **Zero Lint Warnings** - Production-grade code quality

### 🔄 What You Need to Update
- Replace `ANTHROPIC_API_KEY` with AWS credentials
- Remove Hostinger deployment files (not needed)
- Update bot configuration in `.env`

---

## Prerequisites

### System Requirements
- **Node.js:** 18.0.0 or higher
- **npm:** 9.0.0 or higher
- **Operating System:** Windows, macOS, or Linux

### Required Accounts
1. **Telegram Account** - For bot testing
2. **Supabase Account** - For PostgreSQL database (free tier available)
3. **AWS Account** - For Bedrock Claude API access

### Ports
- **Local:** Port 3002 (configurable via `PORT` env var)

---

## Step-by-Step Installation

### Step 1: Get Your Telegram Bot Token

1. Open Telegram and search for `@BotFather`
2. Send `/newbot`
3. Follow the prompts to create your bot
4. Copy your bot token (looks like: `1234567890:ABCDEFGHIJKLMNOPQRSTuvwxyz123456789`)

**Save this token!** You'll need it in Step 3.

### Step 2: Setup Supabase Database

1. Go to [supabase.com](https://supabase.com)
2. Click "Start your project" → Sign up with email
3. Create a new project
4. Wait for project initialization (2-3 minutes)
5. Go to **Settings → API** and copy:
   - `Project URL` → Save as `SUPABASE_URL`
   - `Service Role Key` → Save as `SUPABASE_SERVICE_KEY`

**These are critical!** You'll need them in Step 3.

### Step 3: Setup AWS Bedrock Access

#### 3.1 Create AWS Account (if needed)
1. Go to [aws.amazon.com](https://aws.amazon.com)
2. Click "Create AWS Account"
3. Follow email verification steps
4. Complete identity verification

#### 3.2 Create IAM User with Bedrock Access
1. Go to [IAM Console](https://console.aws.amazon.com/iam/)
2. Click **Users → Create user**
3. Enter username (e.g., "aria-telegram-bot")
4. Click "Create user"
5. Go to **Permissions → Add permissions → Attach policies directly**
6. Search for and select `AmazonBedrockFullAccess`
7. Click "Add permissions"

#### 3.3 Create Access Keys
1. Go back to Users and select your user
2. Click **Security credentials → Create access key**
3. Select "Other" as use case
4. Click "Create access key"
5. Copy and save:
   - `Access Key ID` → Save as `AWS_ACCESS_KEY_ID`
   - `Secret Access Key` → Save as `AWS_SECRET_ACCESS_KEY`

**⚠️ Important:** This secret key won't be shown again! Copy it immediately!

#### 3.4 Enable Bedrock Models
1. Go to [Bedrock Console](https://console.aws.amazon.com/bedrock/)
2. Go to **Model access** (left sidebar)
3. Click "Manage model access"
4. Find "Claude 3.5 Sonnet" and check the box
5. Click "Save changes"

**Wait 5-10 minutes for approval** (usually instant)

### Step 4: Clone and Setup Project

```bash
# Navigate to your projects directory
cd path/to/your/projects

# Clone the repository (if not already done)
git clone https://github.com/your-username/aria-book-studio.git
cd aria-book-studio/telegram-bot

# Or if already in the folder:
cd telegram-bot
```

### Step 5: Configure Environment

```bash
# Copy template
cp .env.example .env

# Edit with your values
# On Windows:
notepad .env

# On macOS/Linux:
nano .env
```

### Step 6: Fill in the .env File

Open `.env` and update these variables:

```env
# Telegram Bot
TELEGRAM_BOT_TOKEN=1234567890:ABCDEFGHIJKLMNOPQRSTuvwxyz123456789

# Supabase Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# AWS Bedrock (Claude AI)
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=wJal...
AWS_REGION=us-east-1
MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0

# Server
PORT=3002
NODE_ENV=development
```

**Check your values:**
- ✅ TELEGRAM_BOT_TOKEN - from @BotFather
- ✅ SUPABASE_URL - from Supabase Settings
- ✅ SUPABASE_SERVICE_KEY - from Supabase Settings
- ✅ AWS_ACCESS_KEY_ID - from AWS IAM
- ✅ AWS_SECRET_ACCESS_KEY - from AWS IAM (secret!)
- ✅ AWS_REGION - same as your AWS account region

### Step 7: Install Dependencies

```bash
# Install all npm packages
npm install

# This should complete in ~30 seconds
```

**Expected output:**
```
added 450 packages in 25s
120 packages are looking for funding
```

### Step 8: Setup Database

```bash
# Run migrations (creates tables)
npm run migrate

# This should complete in ~5 seconds
```

**Expected output:**
```
✅ Migration completed successfully
```

If migration fails:
1. Go to Supabase Dashboard → SQL Editor
2. Copy `migrations/001-create-telegram-users.sql`
3. Run the SQL manually in the editor

### Step 9: Start the Bot

```bash
# Start in development mode with auto-reload
npm run dev
```

**Expected output:**
```
🚀 Starting ARIA Telegram Bot...
📌 Bot Mode: polling
✅ Bot handlers registered
🤖 ARIA Telegram Bot is ready!
```

**If you see this, your bot is running! ✅**

### Step 10: Test Your Bot

1. Open Telegram
2. Search for your bot (use the name from @BotFather)
3. Send `/start`
4. You should see the welcome message!

---

## Testing All Commands

Once the bot is running, test each command:

```
/start          → Welcome message
/help           → Show all commands
/newbook        → Create a test book
/books          → View your books
/outline        → Generate an outline
/character      → Create a character profile
/world          → Generate worldbuilding
/export         → Export your book
/openbook       → Open a book
```

### Test AI Generation (Most Important)
1. Send `/newbook`
2. Fill in: Title, Subtitle, Description
3. Send `/outline`
4. Watch as Claude generates an outline via AWS Bedrock!

If AI generation works, everything is set up correctly. ✅

---

## Common Setup Issues

### "TELEGRAM_BOT_TOKEN is required"
**Problem:** Bot token not in .env  
**Solution:** Check `.env` has `TELEGRAM_BOT_TOKEN=...` set

### "SUPABASE_URL and SUPABASE_SERVICE_KEY are required"
**Problem:** Database credentials missing  
**Solution:** Copy from Supabase Settings → API

### "AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are required"
**Problem:** AWS credentials missing  
**Solution:** Create IAM user with Bedrock access (see Step 3)

### "Cannot find module '@aws-sdk/client-bedrock-runtime'"
**Problem:** Dependencies not installed  
**Solution:** Run `npm install`

### "BedrockRuntime is not available in your region"
**Problem:** Bedrock not available in your AWS region  
**Solution:** Change `AWS_REGION` in `.env`:
- Try: `us-east-1`, `us-west-2`, `eu-central-1`

### "Access denied to Bedrock model"
**Problem:** Claude model access not granted  
**Solution:** 
1. Go to Bedrock console
2. Go to Model access
3. Request access to Claude 3.5 Sonnet
4. Wait 5-10 minutes for approval

### Bot not responding to commands
**Problem:** Bot token incorrect  
**Solution:** 
1. Go back to @BotFather
2. Check your bot token is correct
3. Copy exact token (no spaces)

---

## Stopping the Bot

In your terminal:
```bash
# Press Ctrl+C to stop
# On Windows: Ctrl+C then Y
# On macOS/Linux: Ctrl+C
```

---

## Restarting the Bot

```bash
# Start again with:
npm run dev

# Or in the background (macOS/Linux):
npm run dev &
```

---

## Useful Commands Reference

```bash
# Start development bot
npm run dev

# Start production bot
npm start

# Run database migrations
npm run migrate

# Check code quality
npm run lint

# Check dependencies for issues
npm audit

# Update dependencies
npm update

# Install specific package
npm install package-name
```

---

## Understanding the Logs

### When You Start the Bot

```
🚀 Starting ARIA Telegram Bot...
```
Bot is initializing

```
📌 Bot Mode: polling
```
Running in development mode (polls Telegram)

```
✅ Bot handlers registered
```
All 10 commands are ready

```
🤖 ARIA Telegram Bot is ready!
```
Bot is running and listening for messages!

### Common Log Messages

```
👤 User created: telegram_123456
```
New user registered with the bot

```
📚 Book created: "My Novel"
```
User created a book

```
🤖 Generating outline...
```
AWS Bedrock is generating content

```
✅ Outline generated
```
Generation complete

### Error Messages

```
❌ Error in /start: ...
```
Something went wrong with a command

```
⚠️ Bedrock API Error: ...
```
AWS Bedrock connection issue

---

## Next Steps

### 1. Explore the Bot
- Create a test book
- Generate an outline
- Export as PDF
- Test all commands

### 2. Customize (Optional)
- Edit `src/services/botHandler.js` to change command behavior
- Update prompts in `src/services/aiService.js`
- Modify styles in `src/services/exportService.js`

### 3. Deploy (When Ready)
- See `CONFIGURATION.md` for deployment options
- Can run on any cloud platform (Railway, Render, Heroku)
- Docker support included

### 4. Share with Users
- Set bot username in @BotFather
- Share bot link: `https://t.me/your-bot-username`
- Users can start using immediately

---

## Getting Help

### Documentation Files
- **REFACTORING_REPORT.md** - What changed in v2.0.0
- **CONFIGURATION.md** - Detailed configuration reference
- **README.md** - Full feature documentation
- **API_REFERENCE.md** - All API endpoints

### Quick Troubleshooting
1. Check logs in terminal (bottom of screen)
2. Verify all .env variables are set
3. Try restarting: Ctrl+C then `npm run dev`
4. Check credentials haven't expired

### Still Stuck?
1. Review CONFIGURATION.md for your specific issue
2. Check if all credentials are correct (no typos/spaces)
3. Verify AWS Bedrock access is enabled
4. Make sure Node.js version is 18+

---

## System Information

### What's Installed

| Component | Version | Purpose |
|-----------|---------|---------|
| Node.js | 18+ | Runtime environment |
| Express.js | 4.18+ | Web server |
| Telegram Bot API | 0.67+ | Telegram integration |
| AWS SDK v3 | 3.569+ | Bedrock integration |
| Supabase | 2.44+ | PostgreSQL database |
| PDFKit | 0.14+ | PDF generation |

### Folder Structure
```
telegram-bot/
├── src/                 # Source code
│   ├── index.js        # Main entry point
│   ├── services/       # Business logic
│   └── routes/         # API routes
├── migrations/         # Database schemas
├── scripts/            # Utilities
├── package.json        # Dependencies
├── .env               # Configuration (secret!)
└── .env.example       # Template (no secrets)
```

---

## Success Checklist

- [ ] Node.js 18+ installed
- [ ] Telegram bot token obtained
- [ ] Supabase project created
- [ ] AWS credentials configured
- [ ] AWS Bedrock access granted
- [ ] `.env` file filled in
- [ ] `npm install` completed
- [ ] `npm run migrate` succeeded
- [ ] `npm run dev` shows ready message
- [ ] Bot responds to `/start` on Telegram
- [ ] `/outline` command generates content

**If all checked, you're ready to go! 🎉**

---

## Quick Reference

### Start Bot
```bash
npm run dev
```

### Stop Bot
```bash
Ctrl+C
```

### Restart Bot
```bash
# Stop with Ctrl+C, then:
npm run dev
```

### Check Status
```bash
# Look for: "ARIA Telegram Bot is ready!"
```

### Test Telegram
```
1. Open Telegram
2. Find your bot
3. Send /start
4. Should see welcome message
```

---

**You're all set! Enjoy your ARIA Telegram Bot! 🚀**

For detailed documentation, see:
- Features: `README.md`
- Configuration: `CONFIGURATION.md`
- What's new: `REFACTORING_REPORT.md`

Happy writing! ✍️
