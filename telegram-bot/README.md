# ARIA Book Studio Telegram Bot

Production-ready Telegram bot integration for ARIA Book Studio. Write and manage your books directly from Telegram using AI-powered content generation.

## Features

✨ **Book Management**
- Create books directly from Telegram
- List and manage your book library
- Open and edit existing books
- Real-time book tracking

📚 **AI-Powered Content Generation**
- Generate chapter outlines using Claude API
- AI-powered chapter writing assistance
- Character profile development
- Worldbuilding generation
- Full story planning

📤 **Export Options**
- PDF export with professional formatting
- Markdown export for version control
- Plain text export
- Automatic file storage and retrieval

🔐 **Secure Authentication**
- Telegram ID-based user identification
- Automatic user creation on first /start
- Session management and tracking
- User preferences and settings

🔄 **Dual Mode Operation**
- **Polling** - Development mode (no server configuration needed)
- **Webhook** - Production mode (Hostinger deployment)

## Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome and command overview |
| `/newbook` | Create a new book |
| `/books` | View all your books |
| `/openbook` | Open and manage a book |
| `/outline` | Generate chapter outlines |
| `/chapter` | Write or generate chapters |
| `/character` | Create character profiles |
| `/world` | Build story worlds |
| `/export` | Export books (PDF, Markdown, Text) |
| `/help` | View command reference |

## Installation

### 1. Prerequisites

- Node.js 18+ 
- Telegram account
- PostgreSQL database (via Supabase)
- Claude API key (Anthropic)
- Telegram Bot Token (from @BotFather)

### 2. Setup

```bash
cd telegram-bot

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your credentials
nano .env
```

### 3. Environment Variables

```env
# Telegram Configuration
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
TELEGRAM_WEBHOOK_URL=https://your-domain.com
BOT_MODE=polling # Use 'webhook' for production

# Database
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key

# AWS Bedrock (Claude AI)
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_REGION=us-east-1
MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0

# Server
PORT=3002
NODE_ENV=development
```

## Database Setup

### Automatic Migration

```bash
# Run migrations (requires SUPABASE_URL and SUPABASE_SERVICE_KEY in .env)
npm run migrate
```

### Manual Migration

If automated migration fails, run the SQL manually:

1. Open [Supabase Dashboard](https://app.supabase.com)
2. Go to **SQL Editor**
3. Create a new query
4. Copy contents of `migrations/001-create-telegram-users.sql`
5. Click **Run**

The migration creates:
- `users` table with Telegram integration
- `telegram_sessions` table for conversation tracking
- `telegram_export_jobs` table for export management
- All necessary indexes and triggers

## Development

### Start in Polling Mode

```bash
# Terminal 1: Start the bot
npm run dev

# The bot will poll Telegram for updates
# No webhook configuration needed
```

### Test Bot Locally

1. Open Telegram
2. Search for your bot (name you set with @BotFather)
3. Send `/start`
4. Test commands: `/help`, `/newbook`, `/books`, etc.

## Production Deployment

### Option 1: Hostinger VPS

#### Step 1: SSH into Hostinger

```bash
ssh user@your-hostinger-ip
```

#### Step 2: Clone Repository

```bash
git clone https://github.com/your-repo/aria-book-studio.git
cd aria-book-studio/telegram-bot
```

#### Step 3: Install Node.js (if not installed)

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs npm
```

#### Step 4: Setup Environment

```bash
cp .env.example .env

# Edit with your production values
# Especially: TELEGRAM_WEBHOOK_URL and BOT_MODE=webhook
nano .env
```

#### Step 5: Install Dependencies

```bash
npm install --production
npm run migrate
```

#### Step 6: Setup SSL Certificate (for webhook)

Using Let's Encrypt:

```bash
sudo apt-get install -y certbot python3-certbot-nginx

# Get certificate for your domain
sudo certbot certonly --standalone -d your-domain.com
```

#### Step 7: Update .env for Webhook

```env
BOT_MODE=webhook
TELEGRAM_WEBHOOK_URL=https://your-domain.com
TELEGRAM_WEBHOOK_PORT=8443
WEBHOOK_SSL_KEY=/etc/letsencrypt/live/your-domain.com/privkey.pem
WEBHOOK_SSL_CERT=/etc/letsencrypt/live/your-domain.com/fullchain.pem
```

#### Step 8: Run with Process Manager

```bash
# Install PM2
npm install -g pm2

# Start bot
pm2 start src/index.js --name "aria-bot"

# Save PM2 config
pm2 save

# Setup startup on reboot
pm2 startup
```

#### Step 9: Verify Deployment

```bash
# Check bot status
pm2 status

# View logs
pm2 logs aria-bot

# Test health endpoint
curl https://your-domain.com/health
```

### Option 2: Railway / Render / Heroku

These platforms support Node.js out of the box.

**Step 1:** Push your code to GitHub

**Step 2:** Connect your GitHub repo to Railway/Render

**Step 3:** Set environment variables in the platform dashboard

**Step 4:** Deploy - the platform will automatically:
- Install dependencies
- Run migrations (if you set it up)
- Start the bot with `npm start`

## Architecture

```
telegram-bot/
├── src/
│   ├── index.js                 # Main bot entry point
│   ├── services/
│   │   ├── botHandler.js        # Telegram command handlers
│   │   ├── database.js          # Database operations
│   │   ├── aiService.js         # Claude API integration
│   │   └── exportService.js     # PDF/Export generation
│   └── routes/
│       └── webhookRoutes.js     # Express webhook routes
├── migrations/
│   └── 001-create-telegram-users.sql  # Database schema
├── scripts/
│   └── migrate.js               # Migration runner
├── exports/                     # Generated PDFs/exports
├── .env.example                 # Environment template
└── package.json
```

## Database Schema

### Users Table

```sql
users
├── telegram_id (BIGINT, UNIQUE)
├── telegram_username (TEXT)
├── first_name (TEXT)
├── last_name (TEXT)
├── user_id (TEXT, UNIQUE)
├── preferences (JSONB)
├── credits_remaining (DECIMAL)
├── books_created_count (INTEGER)
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)
```

### Sessions Table

```sql
telegram_sessions
├── telegram_id (BIGINT, FK users.telegram_id)
├── current_action (TEXT)
├── context (JSONB)
├── books_in_progress (JSONB[])
└── expires_at (TIMESTAMPTZ)
```

### Export Jobs Table

```sql
telegram_export_jobs
├── telegram_id (BIGINT, FK users.telegram_id)
├── book_id (UUID, FK books.id)
├── export_format (TEXT)
├── status (TEXT: pending|processing|completed|failed)
├── file_path (TEXT)
├── file_size_bytes (INTEGER)
└── created_at (TIMESTAMPTZ)
```

## API Endpoints

### Webhook
- `POST /webhook/telegram` - Receive Telegram updates

### Exports
- `GET /exports/:fileName` - Download exported file
- `GET /api/exports/:telegramId` - List user exports
- `POST /api/export-book` - Trigger export job

### User Data
- `GET /api/user/:telegramId` - Get user info
- `GET /api/user/:telegramId/books` - Get user books

## Conversation Flows

### New Book Flow

```
/newbook
  ↓ User enters title
Step 2: Enter subtitle (or skip)
  ↓ User enters subtitle
Step 3: Enter description
  ↓ User enters description
✓ Book created and saved to database
```

### Outline Generation Flow

```
/outline
  ↓ User enters book title
Step 2: User enters story description
  ↓ Claude generates outline
✓ Outline displayed with chapter suggestions
```

### Character Creation Flow

```
/character
  ↓ User enters character name
Step 2: User enters character description
  ↓ Claude generates full character profile
✓ Profile displayed with personality, background, arc, etc.
```

## Troubleshooting

### Bot Not Responding

1. Check bot is running: `npm run dev`
2. Verify TELEGRAM_BOT_TOKEN is correct
3. Check console for errors
4. Verify database connectivity

### Database Connection Issues

```bash
# Test Supabase connection
node -e "
import db from './src/services/database.js';
console.log('Testing database...');
db.user.getByTelegramId(123456789)
  .then(() => console.log('✓ Connected'))
  .catch(e => console.error('✗ Error:', e.message));
"
```

### Webhook Not Working

1. Ensure certificate is valid:
   ```bash
   openssl x509 -in /path/to/cert.pem -text -noout
   ```

2. Verify domain DNS points to server IP

3. Check firewall allows port 8443:
   ```bash
   sudo ufw allow 8443/tcp
   ```

4. Test webhook manually:
   ```bash
   curl -X POST https://your-domain.com/webhook/telegram \
     -H "Content-Type: application/json" \
     -d '{"update_id":1}'
   ```

## Performance Tips

1. **Use Webhook in Production** - More efficient than polling
2. **Database Indexing** - All indexes already included
3. **Session Cleanup** - Sessions auto-expire after 24 hours
4. **Export Cleanup** - PDFs expire after 7 days
5. **Connection Pooling** - Handled by Supabase

## Security Considerations

1. ✅ Never commit `.env` file with real tokens
2. ✅ Use environment variables for all secrets
3. ✅ Validate Telegram updates
4. ✅ SQL injection protection (using Supabase)
5. ✅ Rate limiting (can be added via middleware)
6. ✅ HTTPS required for webhooks

## Monitoring & Logs

### Using PM2

```bash
# View logs
pm2 logs aria-bot

# Watch logs in real-time
pm2 logs aria-bot --lines 100

# Clear logs
pm2 flush

# Get metrics
pm2 monit
```

### Using Docker (Optional)

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .

ENV NODE_ENV=production

CMD ["npm", "start"]
```

## Maintenance

### Update Dependencies

```bash
npm update
npm audit fix
```

### Database Backups

Supabase automatically backs up your database. You can also:

1. Export via Supabase dashboard
2. Use pg_dump for manual backups
3. Set up automated backups to S3

## Future Enhancements

- 📱 Mobile app integration
- 🎨 Cover image generation with DALL-E
- 💬 Multi-language support
- 👥 Collaborative book writing
- 🔄 Sync with web app
- 📊 Analytics and insights
- 🎯 Writing goals and streaks
- 📖 E-book publishing integration

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

## License

MIT License - See LICENSE file for details

## Support

- 📧 Email: support@ariabook.studio
- 🤖 Telegram: @ARISStoryForgeBot
- 📚 Documentation: https://docs.ariabook.studio
- 🐛 Issues: https://github.com/your-repo/issues

## Changelog

### v1.0.0
- ✨ Initial release
- 📚 Book management system
- 🤖 AI-powered content generation
- 📤 Export functionality
- 🔐 Secure authentication
- 🚀 Production-ready deployment

---

**Happy writing! 📝**
