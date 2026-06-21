# Telegram Bot Deployment Guide for Hostinger

Complete step-by-step guide to deploy ARIA Telegram Bot to Hostinger VPS.

## Prerequisites

- Hostinger VPS account (or any VPS with root access)
- Domain name (for webhook mode)
- SSH client (built-in on Mac/Linux, PuTTY on Windows)
- Telegram Bot Token (from @BotFather)
- Supabase project credentials
- Claude API key

## Step 1: Connect to Hostinger VPS

### Get Your Server Credentials

1. Log in to [Hostinger Dashboard](https://hpanel.hostinger.com)
2. Go to **VPS**
3. Select your VPS
4. Find **SSH Access** section
5. Note down:
   - SSH Host/IP
   - SSH Port (usually 22)
   - SSH Username
   - SSH Password

### SSH Connection

**Mac/Linux:**
```bash
ssh root@your-server-ip
# Or with custom port:
ssh -p 22 root@your-server-ip
```

**Windows (using PowerShell):**
```powershell
ssh root@your-server-ip
```

## Step 2: Update System

```bash
# Update package manager
apt update && apt upgrade -y

# Install essential tools
apt install -y curl wget git vim nano
```

## Step 3: Install Node.js and npm

```bash
# Download Node.js installer
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -

# Install Node.js (includes npm)
apt install -y nodejs

# Verify installation
node --version  # Should show v18.x.x or higher
npm --version   # Should show 9.x.x or higher
```

## Step 4: Clone Repository

```bash
# Navigate to home directory
cd ~

# Clone the ARIA repository
git clone https://github.com/your-username/aria-book-studio.git
cd aria-book-studio/telegram-bot

# List contents to verify
ls -la
```

If you don't have a GitHub repo yet:

```bash
# Create directory manually
mkdir -p ~/aria-bot
cd ~/aria-bot

# Initialize git
git init

# Copy your telegram-bot files here
# (You can use SCP or other methods)
```

## Step 5: Setup Environment Variables

```bash
# Copy environment template
cp .env.example .env

# Edit with nano (or your preferred editor)
nano .env
```

### Configure .env for Production

```env
# Telegram Bot
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
BOT_MODE=webhook
TELEGRAM_WEBHOOK_URL=https://your-domain.com
TELEGRAM_WEBHOOK_PORT=8443

# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_key_here

# API Keys
ANTHROPIC_API_KEY=your_anthropic_key_here

# Server
PORT=3002
NODE_ENV=production
```

**To save in nano:** Press `Ctrl+X`, then `Y`, then `Enter`

## Step 6: Install Dependencies

```bash
# Install npm packages
npm install --production

# Verify installation
npm list
```

## Step 7: Setup SSL Certificate

### Option A: Using Let's Encrypt (Recommended)

```bash
# Install Certbot
apt install -y certbot python3-certbot-nginx

# Generate certificate (replace with your domain)
certbot certonly --standalone -d your-domain.com -d www.your-domain.com

# Note the certificate path, typically:
# /etc/letsencrypt/live/your-domain.com/
```

### Option B: Using Hostinger's SSL

1. In Hostinger panel, go to **Domains**
2. Select your domain
3. Find **SSL Certificate**
4. Click "Install Certificate"
5. Use the provided certificate path

### Update .env with Certificate Path

```bash
nano .env
```

Add these lines:
```env
WEBHOOK_SSL_KEY=/etc/letsencrypt/live/your-domain.com/privkey.pem
WEBHOOK_SSL_CERT=/etc/letsencrypt/live/your-domain.com/fullchain.pem
```

## Step 8: Configure Domain

### Point Domain to Server IP

1. In Hostinger **Domains** section
2. Go to DNS settings
3. Add/Update A record:
   - **Host:** @ (for root domain)
   - **Type:** A
   - **Value:** Your VPS IP address
   - **TTL:** 3600

4. Also add for www:
   - **Host:** www
   - **Type:** A
   - **Value:** Your VPS IP address

5. Wait 5-30 minutes for DNS propagation

### Verify Domain

```bash
# Check if domain resolves to your IP
nslookup your-domain.com

# Should show your VPS IP address
```

## Step 9: Configure Firewall

```bash
# Check current firewall rules
sudo ufw status

# Allow SSH (important!)
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow webhook port
sudo ufw allow 8443/tcp

# Enable firewall
sudo ufw enable
```

## Step 10: Setup Process Manager (PM2)

### Install PM2

```bash
# Install PM2 globally
npm install -g pm2

# Verify installation
pm2 --version
```

### Create PM2 Config

```bash
# Create ecosystem config
nano ecosystem.config.js
```

Paste this content:

```javascript
module.exports = {
  apps: [
    {
      name: 'aria-bot',
      script: './src/index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'exports'],
      max_memory_restart: '500M',
      max_restarts: 10,
      min_uptime: '10s'
    }
  ]
};
```

### Create Log Directory

```bash
mkdir -p logs
```

## Step 11: Run Database Migration

```bash
# This creates the necessary database tables
npm run migrate
```

Watch for success message:
```
✅ Migrations completed!
```

If it fails, run the SQL manually in Supabase dashboard.

## Step 12: Start Bot with PM2

```bash
# Start using ecosystem config
pm2 start ecosystem.config.js

# Verify it's running
pm2 status

# View logs
pm2 logs aria-bot
```

Expected output in logs:
```
🚀 Starting ARIA Telegram Bot...
📌 Bot Mode: webhook
✅ Webhook set to: https://your-domain.com/webhook/telegram
✅ Server running on port 3002
🤖 ARIA Telegram Bot is ready!
```

## Step 13: Setup Auto-restart on Reboot

```bash
# Generate startup script
pm2 startup

# Save PM2 config
pm2 save
```

Copy the command output and run it:

```bash
# Example (your command will be different):
sudo env PATH=$PATH:/usr/bin /usr/local/lib/node_modules/pm2/bin/pm2 startup systemd -u root --hp /root
```

## Step 14: Setup Reverse Proxy (Optional but Recommended)

Using Nginx to proxy requests:

```bash
# Install Nginx
apt install -y nginx

# Create config
nano /etc/nginx/sites-available/aria-bot
```

Paste this:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name your-domain.com www.your-domain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    # SSL Certificates
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Proxy to Node.js app
    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static files
    location /exports {
        alias /root/aria-bot/exports;
        expires 7d;
    }
}
```

Enable the config:

```bash
# Create symlink
ln -s /etc/nginx/sites-available/aria-bot /etc/nginx/sites-enabled/

# Test nginx config
nginx -t

# Restart nginx
systemctl restart nginx
```

## Step 15: Verify Deployment

```bash
# Check bot is running
pm2 status

# View real-time logs
pm2 logs aria-bot

# Test health endpoint
curl https://your-domain.com/health

# Test from another terminal
# It should return: {"status":"ok","mode":"webhook","timestamp":"..."}
```

## Step 16: Test Bot on Telegram

1. Open Telegram
2. Search for your bot (name you set with @BotFather)
3. Send `/start`
4. Test commands: `/help`, `/newbook`, `/books`

## Monitoring & Maintenance

### View Logs

```bash
# Real-time logs
pm2 logs aria-bot

# Last 100 lines
pm2 logs aria-bot --lines 100

# Specific date range
pm2 logs aria-bot --lines 1000 | grep "2024-01"
```

### Monitor Performance

```bash
# Real-time monitoring
pm2 monit

# Show memory/CPU
ps aux | grep node
```

### Restart Bot

```bash
# Graceful restart
pm2 restart aria-bot

# Full reload (zero downtime)
pm2 reload aria-bot

# Stop
pm2 stop aria-bot

# Start
pm2 start aria-bot
```

### Update Code

```bash
cd ~/aria-bot

# Pull latest changes
git pull

# Update dependencies
npm install --production

# Restart bot
pm2 restart aria-bot

# Verify
pm2 logs aria-bot
```

## Troubleshooting

### Bot Not Starting

```bash
# Check logs
pm2 logs aria-bot

# Common issues:
# 1. Missing .env file
# 2. Wrong TELEGRAM_BOT_TOKEN
# 3. Database connection issue

# Verify .env exists
cat .env
```

### Webhook Not Working

```bash
# Test SSL certificate
openssl s_client -connect your-domain.com:8443

# Check if port is open
telnet your-domain.com 8443

# View nginx logs
tail -f /var/log/nginx/error.log
```

### Database Connection Failed

```bash
# Verify environment variables
grep SUPABASE .env

# Test connection
node -e "
import db from './src/services/database.js';
db.user.getByTelegramId(123)
  .then(() => console.log('✓ Connected'))
  .catch(e => console.error('✗ Error:', e.message));
"
```

### SSL Certificate Issues

```bash
# Check certificate expiration
openssl x509 -in /etc/letsencrypt/live/your-domain.com/fullchain.pem -noout -dates

# Renew certificate
certbot renew --dry-run  # Test renewal
certbot renew            # Actual renewal
```

## Backup & Recovery

### Backup Configuration

```bash
# Backup .env and configs
tar -czf aria-bot-backup.tar.gz .env ecosystem.config.js

# Save to another location
cp aria-bot-backup.tar.gz /home/backup/
```

### Database Backup

Supabase automatically backs up. You can also:

1. Go to Supabase dashboard
2. Click **Backups**
3. Click **Download**

## Performance Optimization

### Increase Node.js Memory Limit

```bash
# Edit PM2 config
nano ecosystem.config.js

# Change:
# max_memory_restart: '500M'
```

### Enable Compression

Already included in `exportService.js` for PDFs.

### Database Connection Pooling

Handled automatically by Supabase client.

## Security Hardening

### Update Regularly

```bash
# Update system
apt update && apt upgrade -y

# Update Node.js packages
npm update

# Security audit
npm audit fix
```

### SSH Security

```bash
# Disable root login
nano /etc/ssh/sshd_config
# Change: PermitRootLogin no

# Restart SSH
systemctl restart sshd
```

### Firewall Rules

```bash
# Allow only necessary ports
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 8443/tcp
ufw enable
```

## Support

- Check logs: `pm2 logs aria-bot`
- Check Hostinger documentation: https://support.hostinger.com
- Bot repository: https://github.com/your-repo/aria-book-studio

---

**Deployment complete! 🎉**
