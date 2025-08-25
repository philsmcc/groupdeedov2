#!/bin/bash

# GroupDeedo Deployment Script
# Usage: ./deploy.sh [docker|pm2]

set -e

DEPLOYMENT_TYPE=${1:-docker}
PROJECT_NAME="groupdeedo"

echo "🚀 Starting GroupDeedo deployment..."

# Check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        echo "❌ Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        echo "❌ Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
}

# Check if PM2 is installed
check_pm2() {
    if ! command -v pm2 &> /dev/null; then
        echo "❌ PM2 is not installed. Installing PM2..."
        npm install -g pm2
    fi
}

# Create environment file
create_env_file() {
    if [ ! -f .env ]; then
        echo "📝 Creating environment file..."
        cat > .env << EOF
SESSION_SECRET=$(openssl rand -base64 32 2>/dev/null || echo "groupdeedo-change-this-secret")
NODE_ENV=production
PORT=3000
EOF
        echo "✅ Environment file created"
    else
        echo "✅ Environment file already exists"
    fi
}

# Docker deployment
deploy_docker() {
    echo "🐳 Starting Docker deployment..."
    
    check_docker
    create_env_file
    
    # Build and start services
    echo "📦 Building Docker images..."
    docker-compose build
    
    echo "🚀 Starting services..."
    docker-compose up -d
    
    # Wait for services to be ready
    echo "⏳ Waiting for services to start..."
    sleep 10
    
    # Check if services are running
    if docker-compose ps | grep -q "Up"; then
        echo "✅ Docker deployment successful!"
        echo "📱 Application is running at: http://localhost:3000"
        echo "📊 Check status: docker-compose ps"
        echo "📋 View logs: docker-compose logs -f"
    else
        echo "❌ Docker deployment failed. Check logs:"
        docker-compose logs
        exit 1
    fi
}

# PM2 deployment
deploy_pm2() {
    echo "⚡ Starting PM2 deployment..."
    
    check_pm2
    create_env_file
    
    # Install dependencies
    echo "📦 Installing dependencies..."
    npm install --production
    
    # Create logs directory
    mkdir -p logs
    
    # Start with PM2
    echo "🚀 Starting application with PM2..."
    pm2 start ecosystem.config.js --env production
    
    # Save PM2 configuration
    pm2 save
    
    echo "✅ PM2 deployment successful!"
    echo "📱 Application is running at: http://localhost:3000"
    echo "📊 Check status: pm2 status"
    echo "📋 View logs: pm2 logs $PROJECT_NAME"
}

# Health check
health_check() {
    echo "🏥 Running health check..."
    sleep 5
    
    if curl -f -s http://localhost:3000/ > /dev/null; then
        echo "✅ Health check passed - application is responding"
    else
        echo "⚠️  Health check failed - application may not be ready yet"
        echo "   Please check logs and try again in a few moments"
    fi
}

# Main deployment logic
case $DEPLOYMENT_TYPE in
    docker)
        deploy_docker
        ;;
    pm2)
        deploy_pm2
        ;;
    *)
        echo "❌ Invalid deployment type. Use 'docker' or 'pm2'"
        echo "Usage: $0 [docker|pm2]"
        exit 1
        ;;
esac

# Run health check
health_check

echo ""
echo "🎉 GroupDeedo deployment completed!"
echo ""
echo "📚 Useful commands:"
if [ "$DEPLOYMENT_TYPE" = "docker" ]; then
    echo "  • Stop services: docker-compose down"
    echo "  • View logs: docker-compose logs -f"
    echo "  • Restart: docker-compose restart"
    echo "  • Update: git pull && docker-compose up -d --build"
else
    echo "  • Stop service: pm2 stop $PROJECT_NAME"
    echo "  • View logs: pm2 logs $PROJECT_NAME"
    echo "  • Restart: pm2 restart $PROJECT_NAME"
    echo "  • Update: git pull && pm2 restart $PROJECT_NAME"
fi
echo ""
echo "🌐 Access your app at: http://localhost:3000"
echo "📖 Full documentation: https://github.com/yourusername/groupdeedo"