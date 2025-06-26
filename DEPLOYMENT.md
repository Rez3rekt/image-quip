# Chirped Production Deployment Guide

This guide covers deploying Chirped to a production server with proper security, monitoring, and process management.

## 🚀 Quick Production Setup

### Prerequisites

- **Ubuntu 20.04+** or **CentOS 8+** server
- **Node.js 16+** and npm
- **Nginx** (recommended) or Apache
- **PM2** for process management
- **SSL certificate** (Let's Encrypt recommended)
- **Domain name** pointing to your server

## 📋 Step-by-Step Deployment

### 1. Server Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18 LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Install Nginx
sudo apt install nginx -y

# Install Git
sudo apt install git -y
```

### 2. Create Deployment User

```bash
# Create dedicated user for the application
sudo adduser deploy
sudo usermod -aG sudo deploy

# Switch to deploy user
sudo su - deploy
```

### 3. Clone and Setup Application

```bash
# Clone repository
git clone https://github.com/yourusername/image-quip.git
cd image-quip

# Install dependencies
npm install

# Install server dependencies
cd server
npm install

# Install development dependencies for nodemon (optional)
npm install --save-dev nodemon

# Go back to root
cd ..
```

### 4. Environment Configuration

```bash
# Copy environment template
cp server/env.example server/.env

# Edit environment variables
nano server/.env
```

**Critical Environment Variables:**

```bash
# Security (REQUIRED - Generate secure values!)
JWT_SECRET=your_super_secure_random_string_here_64_chars_minimum
NODE_ENV=production

# Server Configuration
PORT=3001
HOST=0.0.0.0

# CORS Configuration
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Database
DATABASE_PATH=./data/database.sqlite

# File Upload Configuration
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/app.log
```

**Generate Secure JWT Secret:**
```bash
# Generate a secure JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 5. Build Application

```bash
# Build client for production
npm run build

# Verify build completed
ls -la client/dist/
```

### 6. Setup Directories and Permissions

```bash
# Create necessary directories
mkdir -p server/logs
mkdir -p server/data
mkdir -p server/uploads/cards

# Set proper permissions
chmod 755 server/data
chmod 755 server/uploads
chmod 755 server/logs

# Ensure deploy user owns everything
sudo chown -R deploy:deploy /home/deploy/image-quip
```

### 7. Configure PM2

```bash
# Start application with PM2
cd server
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Follow the instructions provided by the command above

# Verify application is running
pm2 status
pm2 logs imageQuip
```

### 8. Configure Nginx

```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/imageQuip
```

**Nginx Configuration:**

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;
    
    # SSL Configuration (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # SSL Security Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security Headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
    
    # Client file size limit (for image uploads)
    client_max_body_size 10M;
    
    # Serve static client files
    location / {
        root /home/deploy/image-quip/client/dist;
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # Proxy API requests to Node.js server
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Proxy Socket.io connections
    location /socket.io/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket specific timeouts
        proxy_read_timeout 86400;
    }
    
    # Serve uploaded files
    location /uploads/ {
        alias /home/deploy/image-quip/server/uploads/;
        
        # Security: prevent execution of uploaded files
        location ~* \.(php|pl|py|jsp|asp|sh|cgi)$ {
            deny all;
        }
        
        # Cache uploaded images
        expires 30d;
        add_header Cache-Control "public";
    }
}
```

**Enable the site:**

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/imageQuip /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### 9. Setup SSL with Let's Encrypt

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Obtain SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Test automatic renewal
sudo certbot renew --dry-run
```

### 10. Configure Firewall

```bash
# Enable UFW firewall
sudo ufw enable

# Allow SSH, HTTP, and HTTPS
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'

# Check status
sudo ufw status
```

## 🔧 Production Maintenance

### Monitoring Commands

```bash
# Check application status
pm2 status
pm2 monit

# View logs
pm2 logs imageQuip
pm2 logs imageQuip --lines 100

# Check system resources
htop
df -h
free -h

# Check Nginx status
sudo systemctl status nginx
sudo nginx -t
```

### Update Deployment

```bash
# Pull latest changes
cd /home/deploy/image-quip
git pull origin main

# Install any new dependencies
npm install
cd server && npm install && cd ..

# Rebuild client
npm run build

# Restart application
pm2 restart imageQuip

# Check status
pm2 status
```

### Backup Strategy

```bash
# Create backup script
nano /home/deploy/backup.sh
```

**Backup Script:**

```bash
#!/bin/bash
BACKUP_DIR="/home/deploy/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
cp /home/deploy/image-quip/server/data/database.sqlite $BACKUP_DIR/database_$DATE.sqlite

# Backup uploaded files
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz /home/deploy/image-quip/server/uploads/

# Keep only last 7 days of backups
find $BACKUP_DIR -name "*.sqlite" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
```

```bash
# Make executable
chmod +x /home/deploy/backup.sh

# Add to crontab for daily backups
crontab -e
# Add: 0 2 * * * /home/deploy/backup.sh
```

## 🚨 Troubleshooting

### Common Issues

**Application won't start:**
```bash
# Check PM2 logs
pm2 logs imageQuip

# Check environment variables
cat server/.env

# Verify Node.js version
node --version
```

**Database errors:**
```bash
# Check database file permissions
ls -la server/data/

# Verify database directory exists
mkdir -p server/data
```

**File upload issues:**
```bash
# Check uploads directory permissions
ls -la server/uploads/
chmod 755 server/uploads/
```

**Nginx errors:**
```bash
# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log

# Test configuration
sudo nginx -t
```

### Performance Optimization

**Enable PM2 Cluster Mode:**
```bash
# Edit ecosystem.config.js
# Change: instances: 1, exec_mode: 'fork'
# To: instances: 'max', exec_mode: 'cluster'

pm2 restart imageQuip
```

**Database Optimization:**
```bash
# Add database indexes (already included in schema)
# Monitor database size and consider cleanup scripts
```

## 📊 Monitoring Setup

### Basic Monitoring with PM2

```bash
# Install PM2 monitoring
pm2 install pm2-server-monit

# View monitoring dashboard
pm2 monit
```

### Log Rotation

```bash
# Install PM2 log rotate
pm2 install pm2-logrotate

# Configure log rotation
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

## 🔒 Security Checklist

- [ ] Secure JWT_SECRET set (64+ characters)
- [ ] CORS properly configured for your domain
- [ ] SSL certificate installed and working
- [ ] Firewall configured (only necessary ports open)
- [ ] Regular security updates scheduled
- [ ] Database file permissions secured
- [ ] Uploaded files cannot be executed
- [ ] Server logs monitored
- [ ] Backup strategy implemented

## 📞 Support

If you encounter issues during deployment:

1. Check the application logs: `pm2 logs imageQuip`
2. Verify environment variables are set correctly
3. Ensure all dependencies are installed
4. Check Nginx configuration and logs
5. Verify SSL certificate is valid

---

**Your ImageQuip game is now ready for production! 🎉** 