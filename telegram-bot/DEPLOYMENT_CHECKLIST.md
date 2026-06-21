# 🚀 ARIA Telegram Bot - Development Setup Checklist

Use this checklist to track your progress from initial setup to running the bot locally.

---

## Phase 1: Preparation ✍️

### Prerequisites
- [ ] Have a Telegram account
- [ ] Have Node.js 18+ installed
- [ ] Have a Supabase account
- [ ] Have an AWS account (for Bedrock)

### Initial Setup
- [ ] Create Telegram bot with @BotFather
  - [ ] Message @BotFather on Telegram
  - [ ] Select `/newbot`
  - [ ] Follow instructions
  - [ ] Copy bot token: `TELEGRAM_BOT_TOKEN`
  
- [ ] Setup Supabase project
  - [ ] Go to supabase.com
  - [ ] Create new project
  - [ ] Copy `SUPABASE_URL`
  - [ ] Copy `SUPABASE_SERVICE_KEY`
  
- [ ] Setup AWS Bedrock (Claude AI)
  - [ ] Go to aws.amazon.com and create account
  - [ ] Create IAM user with Bedrock access
  - [ ] Generate access keys
  - [ ] Copy `AWS_ACCESS_KEY_ID`
  - [ ] Copy `AWS_SECRET_ACCESS_KEY`
  - [ ] Set `AWS_REGION=us-east-1`
  - [ ] Enable Claude model access in Bedrock console

---

## Phase 2: Local Development 💻

### Environment Setup
- [ ] Navigate to `telegram-bot` folder
- [ ] Create `.env` file from `.env.example`
  ```bash
  cp .env.example .env
  ```
- [ ] Edit `.env` with your keys
  - [ ] `TELEGRAM_BOT_TOKEN`
  - [ ] `SUPABASE_URL`
  - [ ] `SUPABASE_SERVICE_KEY`
  - [ ] `AWS_ACCESS_KEY_ID`
  - [ ] `AWS_SECRET_ACCESS_KEY`
  - [ ] `AWS_REGION=us-east-1`
  - [ ] `BOT_MODE=polling`
  - [ ] `PORT=3002`

### Install Dependencies
- [ ] Run `npm install`
- [ ] Verify installations:
  ```bash
  npm list | head -20
  ```
- [ ] Check AWS SDK installed:
  ```bash
  npm list @aws-sdk/client-bedrock-runtime
  ```

### Database Setup
- [ ] Run migrations:
  ```bash
  npm run migrate
  ```
- [ ] Verify migration success
- [ ] If migration failed:
  - [ ] Copy SQL from `migrations/001-create-telegram-users.sql`
  - [ ] Paste into Supabase SQL Editor
  - [ ] Run manually

### Local Testing
- [ ] Start bot:
  ```bash
  npm run dev
  ```
- [ ] Verify output includes:
  - [ ] "🚀 Starting ARIA Telegram Bot..."
  - [ ] "✅ Bot handlers registered"
  - [ ] "🤖 ARIA Telegram Bot is ready!"

- [ ] Test on Telegram:
  - [ ] Search for your bot
  - [ ] Send `/start`
  - [ ] Receive welcome message
  - [ ] Test `/help` command
  - [ ] Test `/newbook` flow
  - [ ] Test `/books` command

### Feature Testing
- [ ] `/start` - Welcome message
- [ ] `/help` - Help message
- [ ] `/newbook` - Create a test book
- [ ] `/books` - View created books
- [ ] `/outline` - Generate outline (test AWS Bedrock)
- [ ] `/character` - Create character profile
- [ ] `/world` - Generate worldbuilding
- [ ] `/export` - Export as PDF
- [ ] `/openbook` - Open book details
- [ ] Button clicks and inline keyboards work

### Health Check
- [ ] Run health check:
  ```bash
  curl http://localhost:3002/health
  ```
- [ ] Should return `{"status":"ok"}`

---

## Phase 3: Verify All 10 Commands 📋

Commands to test:

✅ **Tested and Working**
- [ ] `/start` - Welcome message
- [ ] `/help` - Help message  
- [ ] `/newbook` - Create books
- [ ] `/books` - List books
- [ ] `/openbook` - Open a book
- [ ] `/outline` - Generate outlines
- [ ] `/chapter` - Write chapters
- [ ] `/character` - Create characters
- [ ] `/world` - Worldbuilding
- [ ] `/export` - Export books

---

## Phase 4: Code Quality 🔍

### Code Validation
- [ ] Run linter:
  ```bash
  npm run lint
  ```
- [ ] Fix any linting errors
- [ ] Verify no console errors

### Dependency Audit
- [ ] Run audit:
  ```bash
  npm audit
  ```
- [ ] Review vulnerabilities
- [ ] Run fixes if needed:
  ```bash
  npm audit fix
  ```

### Import Verification
- [ ] Verify no missing imports
- [ ] Check all dependencies resolved
- [ ] Verify AWS SDK imports work

---

## Phase 5: AWS Bedrock Configuration 🔧

### Test Bedrock Connection
- [ ] Create test file `test-bedrock.js`:
  ```javascript
  import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
  
  const client = new BedrockRuntimeClient({
    region: 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  })
  
  const response = await client.send(new InvokeModelCommand({
    modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    body: JSON.stringify({
      model: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Say hello' }]
    }),
    contentType: 'application/json',
    accept: 'application/json'
  }))
  
  console.log('✅ Bedrock connection successful')
  ```
- [ ] Run test: `node test-bedrock.js`
- [ ] Verify "✅ Bedrock connection successful"
- [ ] Delete test file after verification

### Verify Model Access
- [ ] Go to AWS Bedrock console
- [ ] Check "Model access" section
- [ ] Verify Claude models are available
- [ ] Request access if needed

---

## Phase 6: Troubleshooting 🐛

If bot is not working, check:

- [ ] `.env` file exists and has correct values
- [ ] `TELEGRAM_BOT_TOKEN` is correct
- [ ] Supabase credentials are correct
- [ ] AWS credentials are correct
- [ ] AWS Bedrock is enabled in your region
- [ ] Database migrations ran successfully
- [ ] Bot is running (`npm run dev`)
- [ ] Logs show no errors
- [ ] Health endpoint responds
- [ ] All dependencies installed (`npm install`)

### Common Issues

**"SUPABASE_URL and SUPABASE_SERVICE_KEY are required"**
- [ ] Check `.env` file exists
- [ ] Verify Supabase credentials are set
- [ ] Verify no typos in variable names

**"AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are required"**
- [ ] Verify AWS credentials in `.env`
- [ ] Check access key hasn't expired
- [ ] Verify credentials have Bedrock permissions

**"Bot not responding to commands"**
- [ ] Check Telegram bot token is correct
- [ ] Verify bot is running (`npm run dev`)
- [ ] Check logs for errors
- [ ] Verify database is accessible

**"Outline generation fails"**
- [ ] Check AWS Bedrock is enabled in your region
- [ ] Verify Claude model access is granted
- [ ] Check AWS credentials have Bedrock permissions
- [ ] Review CloudWatch logs for errors

---

## Phase 7: Success Criteria ✅

Your ARIA Telegram Bot is ready when:

✅ Bot responds to `/start` on Telegram
✅ All 10 commands work correctly
✅ Books can be created and saved
✅ AWS Bedrock generates content (outlines, characters, worlds)
✅ PDFs export without errors
✅ Database operations are reliable
✅ No errors in console logs
✅ Health check returns `"status":"ok"`
✅ npm audit shows no critical vulnerabilities

---

## Phase 8: Ongoing Development 🔧

### Monitor and Maintain
- [ ] Check logs regularly: `npm run dev`
- [ ] Monitor Telegram for user reports
- [ ] Keep dependencies updated:
  ```bash
  npm update
  npm audit fix
  ```
- [ ] Review Bedrock usage/costs monthly

### Version Control
- [ ] Commit changes: `git add . && git commit -m "message"`
- [ ] Keep `.env` out of git (use `.gitignore`)
- [ ] Document any changes to setup process

---

## Next Steps

Once everything is working:

1. **Share with users**: Announce bot to test group
2. **Gather feedback**: Listen for issues/suggestions
3. **Plan enhancements**: Document feature requests
4. **Deploy**: Move to production when ready

---

## Support Resources

Check these files for help:

| Problem | File |
|---------|------|
| Getting started | This file |
| Features overview | README.md |
| Configuration help | CONFIGURATION.md |
| All available commands | Type `/help` in Telegram |
| API reference | API_REFERENCE.md |

---

## Sign-Off

- [ ] All commands tested
- [ ] All 10 telegram commands working
- [ ] AWS Bedrock connected
- [ ] Database operational
- [ ] No errors in logs
- [ ] Bot ready for use

**Date Setup:** _______________
**Setup By:** _______________
**Notes:** _______________

---

**🎉 Congratulations! Your ARIA Telegram Bot is ready!**

Start using it on Telegram to create books with AI assistance.

Good luck! 🚀
