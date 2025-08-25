# GroupDeedo - Location-Based Chat Application

GroupDeedo is a real-time, location-based chat application designed for mobile devices. Users can see messages posted within a configurable radius of their location, similar to a digital walkie-talkie for texting.

## Features

- **Location-Based Messaging**: See messages from users within 0.5 to 500 miles
- **Real-Time Chat**: Instant messaging using WebSockets (Socket.io)
- **Channel System**: Create private or public channels for filtered conversations
- **Mobile-First Design**: Optimized for mobile browsers with PWA support
- **Session Management**: Long-lasting sessions with configurable timeout
- **No User Accounts**: Session-based, no registration required

## Technology Stack

- **Backend**: Node.js, Express.js, Socket.io
- **Database**: SQLite3 (easily upgradeable to PostgreSQL)
- **Frontend**: Vanilla JavaScript, CSS3 with responsive design
- **Deployment**: Docker, Docker Compose, PM2

## Project Structure

```
groupdeedo/
├── src/
│   ├── server.js          # Main Express server
│   └── database.js        # Database operations
├── public/
│   ├── index.html         # Main HTML file
│   ├── css/styles.css     # Responsive styles
│   ├── js/app.js          # Frontend JavaScript
│   ├── manifest.json      # PWA manifest
│   └── sw.js              # Service worker
├── data/                  # SQLite database directory
├── logs/                  # Application logs
├── Dockerfile             # Docker configuration
├── docker-compose.yml     # Docker Compose setup
├── nginx.conf             # Nginx reverse proxy config
└── ecosystem.config.js    # PM2 configuration
```

## Local Development

### Prerequisites

- Node.js 18+
- npm

### Setup

1. **Clone and install dependencies**:
   ```bash
   git clone <repository-url>
   cd groupdeedo
   npm install
   ```

2. **Start development server**:
   ```bash
   npm run dev
   ```
   
   The app will be available at `http://localhost:3000`

3. **Enable location access** in your browser when prompted

## Production Deployment

### Option 1: Docker Deployment (Recommended)

1. **Build and run with Docker Compose**:
   ```bash
   # Simple deployment
   docker-compose up -d
   
   # With SSL/custom domain (requires SSL certificates)
   docker-compose --profile with-ssl up -d
   ```

2. **Environment variables**:
   Create a `.env` file:
   ```bash
   SESSION_SECRET=your-super-secure-session-secret-here
   NODE_ENV=production
   ```

### Option 2: PM2 Deployment

1. **Install PM2 globally**:
   ```bash
   npm install -g pm2
   ```

2. **Start with PM2**:
   ```bash
   # Production mode
   pm2 start ecosystem.config.js --env production
   
   # Save PM2 configuration
   pm2 save
   pm2 startup
   ```

## AWS EC2 Deployment Guide

### EC2 Instance Setup

1. **Launch EC2 Instance**:
   - AMI: Amazon Linux 2 or Ubuntu 20.04 LTS
   - Instance Type: t3.micro (for testing) or t3.small+ (production)
   - Security Group: Allow ports 22 (SSH), 80 (HTTP), 443 (HTTPS)

2. **Connect to instance**:
   ```bash
   ssh -i your-key.pem ec2-user@your-instance-ip
   ```

3. **Install Docker and Docker Compose**:
   ```bash
   # Amazon Linux 2
   sudo yum update -y
   sudo yum install -y docker
   sudo service docker start
   sudo usermod -a -G docker ec2-user
   
   # Install Docker Compose
   sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   
   # Re-login to apply docker group changes
   exit
   ssh -i your-key.pem ec2-user@your-instance-ip
   ```

4. **Deploy the application**:
   ```bash
   # Clone repository
   git clone <your-repository-url>
   cd groupdeedo
   
   # Create environment file
   cat > .env << EOF
   SESSION_SECRET=$(openssl rand -base64 32)
   NODE_ENV=production
   EOF
   
   # Build and start
   docker-compose up -d
   
   # Check status
   docker-compose ps
   docker-compose logs -f
   ```

### Domain Configuration

1. **Point your domain** (groupdedoo.com) to your EC2 instance IP

2. **SSL Certificate Setup**:
   ```bash
   # Install Certbot
   sudo yum install -y certbot
   
   # Generate certificate
   sudo certbot certonly --standalone -d groupdedoo.com -d www.groupdedoo.com
   
   # Copy certificates to project
   sudo cp /etc/letsencrypt/live/groupdedoo.com/fullchain.pem ./ssl/cert.pem
   sudo cp /etc/letsencrypt/live/groupdedoo.com/privkey.pem ./ssl/key.pem
   sudo chown -R ec2-user:ec2-user ./ssl/
   
   # Start with SSL
   docker-compose --profile with-ssl up -d
   ```

3. **Auto-renewal setup**:
   ```bash
   # Add to crontab
   sudo crontab -e
   
   # Add this line
   0 12 * * * /usr/bin/certbot renew --quiet && docker-compose --profile with-ssl restart nginx
   ```

## Scaling Considerations

### Database Migration (SQLite → PostgreSQL)

For higher traffic, migrate to PostgreSQL:

1. **Update package.json**:
   ```bash
   npm install pg
   npm uninstall sqlite3
   ```

2. **Update database.js** to use PostgreSQL connection

3. **Add PostgreSQL to docker-compose.yml**:
   ```yaml
   postgres:
     image: postgres:15-alpine
     environment:
       POSTGRES_DB: groupdeedo
       POSTGRES_USER: groupdeedo
       POSTGRES_PASSWORD: secure_password
     volumes:
       - postgres_data:/var/lib/postgresql/data
   ```

### Load Balancing

For multiple EC2 instances:

1. **Use Application Load Balancer (ALB)**
2. **Enable sticky sessions** for Socket.io
3. **Use Redis** for session store and Socket.io adapter

## Monitoring and Maintenance

### Health Checks

- **Docker**: Built-in health checks configured
- **Application**: `/` endpoint returns 200 status
- **Database**: Automatic connection testing

### Log Management

```bash
# View logs
docker-compose logs -f groupdeedo

# With PM2
pm2 logs groupdeedo
```

### Backup Strategy

```bash
# Backup SQLite database
cp data/groupdeedo.db backups/groupdeedo-$(date +%Y%m%d).db

# Automated backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
cp data/groupdeedo.db backups/groupdeedo-$DATE.db
find backups/ -name "*.db" -mtime +7 -delete
```

## Security Considerations

1. **Change default session secret** in production
2. **Use HTTPS** in production (SSL certificates)
3. **Rate limiting** (add express-rate-limit middleware)
4. **Input validation** and sanitization
5. **Regular security updates** for dependencies

## API Endpoints

### GET /api/settings
Get current user settings

### POST /api/settings
Update user settings (username, radius, channel)

### POST /api/messages
Get messages within radius and channel

### POST /api/message
Send a new message

### WebSocket Events

- `updateLocation`: Update user location and settings
- `newMessage`: Receive new messages in real-time

## Repository

**GitHub**: https://github.com/philsmcc/groupdeedov2

## Quick Deploy Commands

```bash
# Clone and deploy in one go
git clone https://github.com/philsmcc/groupdeedov2.git
cd groupdeedov2
./deploy.sh docker
```

## License

MIT License

## Support

For issues and questions, please create an issue in the GitHub repository:
https://github.com/philsmcc/groupdeedov2/issues