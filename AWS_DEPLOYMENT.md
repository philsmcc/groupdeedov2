# GroupDeedo AWS EC2 Deployment Guide

## Quick Start Deployment

### 1. Launch EC2 Instance

```bash
# Choose your instance type based on expected usage:
# - t3.micro: Development/testing (1 vCPU, 1GB RAM) - Free tier eligible
# - t3.small: Light production (2 vCPU, 2GB RAM) - $15-20/month
# - t3.medium: Medium production (2 vCPU, 4GB RAM) - $30-40/month

# Security Group Rules:
# - Port 22 (SSH): Your IP only
# - Port 80 (HTTP): 0.0.0.0/0
# - Port 443 (HTTPS): 0.0.0.0/0
# - Port 3000 (App): 0.0.0.0/0 (temporary, remove after setting up reverse proxy)
```

### 2. Connect and Setup Environment

```bash
# Connect to your instance
ssh -i your-key.pem ec2-user@your-ec2-ip

# Update system and install Docker
sudo yum update -y
sudo yum install -y docker git
sudo service docker start
sudo usermod -a -G docker ec2-user

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Logout and login again to apply docker group
exit
ssh -i your-key.pem ec2-user@your-ec2-ip
```

### 3. Deploy Application

```bash
# Clone the GroupDeedo repository
git clone https://github.com/philsmcc/groupdeedov2.git
cd groupdeedov2

# Run the deployment script
chmod +x deploy.sh
./deploy.sh docker

# Application will be available at:
# http://your-ec2-ip:3000
```

### 4. Domain Setup (groupdedoo.com)

```bash
# Point your domain to your EC2 instance IP in your DNS provider
# A Record: groupdedoo.com -> your-ec2-ip
# A Record: www.groupdedoo.com -> your-ec2-ip

# Install SSL certificate
sudo yum install -y certbot
sudo certbot certonly --standalone -d groupdedoo.com -d www.groupdedoo.com

# Create SSL directory and copy certificates
mkdir -p ssl
sudo cp /etc/letsencrypt/live/groupdedoo.com/fullchain.pem ssl/cert.pem
sudo cp /etc/letsencrypt/live/groupdedoo.com/privkey.pem ssl/key.pem
sudo chown -R ec2-user:ec2-user ssl/

# Deploy with SSL and Nginx reverse proxy
docker-compose --profile with-ssl up -d

# Your app is now available at:
# https://groupdedoo.com
```

### 5. Auto-Renewal SSL Certificate

```bash
# Add to crontab for automatic certificate renewal
sudo crontab -e

# Add this line:
0 12 * * * /usr/bin/certbot renew --quiet && docker-compose --profile with-ssl restart nginx
```

## Management Commands

```bash
# Check application status
docker-compose ps

# View logs
docker-compose logs -f groupdeedo

# Restart application
docker-compose restart

# Update application
git pull
docker-compose up -d --build

# Backup database
cp data/groupdeedo.db backups/groupdeedo-$(date +%Y%m%d).db

# Stop everything
docker-compose down
```

## Cost Estimation

### EC2 Costs (US East)
- **t3.micro**: ~$8/month (Free tier: 750 hours/month for 12 months)
- **t3.small**: ~$15/month 
- **t3.medium**: ~$30/month

### Additional AWS Services (Optional)
- **Elastic Load Balancer**: ~$18/month (for multiple instances)
- **Route 53 DNS**: ~$0.50/month
- **CloudFront CDN**: ~$1-5/month (based on usage)
- **EBS Storage**: ~$2/month per 20GB

### Total Monthly Cost
- **Single t3.micro**: $8-12/month
- **Single t3.small**: $15-20/month  
- **Production setup**: $30-50/month

## Scaling Options

### Vertical Scaling (Single Instance)
```bash
# Stop application
docker-compose down

# Stop EC2 instance, change instance type in AWS console, start instance

# Restart application
docker-compose up -d
```

### Horizontal Scaling (Multiple Instances)
```bash
# Set up Application Load Balancer (ALB)
# Configure target groups for multiple EC2 instances
# Enable sticky sessions for Socket.io compatibility
# Use shared database (RDS) instead of local SQLite
```

## Security Checklist

- [ ] SSH key-based authentication only
- [ ] Security groups configured correctly
- [ ] SSL certificates installed and working
- [ ] Database backups automated
- [ ] System updates scheduled
- [ ] Monitoring and alerting configured
- [ ] Rate limiting implemented (optional)

## Troubleshooting

### Application Not Starting
```bash
# Check Docker status
sudo service docker status

# Check logs
docker-compose logs groupdeedo

# Check database permissions
ls -la data/
```

### SSL Issues
```bash
# Check certificate status
sudo certbot certificates

# Test renewal
sudo certbot renew --dry-run

# Check Nginx config
docker-compose exec nginx nginx -t
```

### Performance Issues
```bash
# Monitor resources
htop
df -h
docker stats

# Check database size
ls -lh data/groupdeedo.db
```

## Support

For issues specific to AWS deployment:
1. Check CloudWatch logs if using AWS services
2. Verify security group rules
3. Check EC2 instance status and health checks
4. Review the main README.md for application-specific issues

For application issues, refer to the main README.md file.

## Repository
GitHub: https://github.com/philsmcc/groupdeedov2