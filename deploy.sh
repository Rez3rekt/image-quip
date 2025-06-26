#!/bin/bash

# Chirped Professional Deployment Script
# This script handles the complete deployment process

set -e  # Exit on any error

echo "🚀 Starting Chirped Professional Deployment..."

# Load environment variables
if [ -f .env.production ]; then
    export $(cat .env.production | xargs)
else
    echo "❌ .env.production file not found! Please create it first."
    exit 1
fi

# Verify required environment variables
required_vars=("POSTGRES_PASSWORD" "JWT_SECRET" "FRONTEND_URL" "API_URL")
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Required environment variable $var is not set!"
        exit 1
    fi
done

echo "✅ Environment variables verified"

# Build and start services
echo "🔨 Building Docker images..."
docker-compose -f docker-compose.production.yml build

echo "🗄️ Starting database and running migrations..."
docker-compose -f docker-compose.production.yml up -d postgres redis

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 10

# Run database migrations (if you have them)
# docker-compose -f docker-compose.production.yml exec api npm run migrate

echo "🌐 Starting all services..."
docker-compose -f docker-compose.production.yml up -d

echo "🔍 Checking service health..."
sleep 15

# Check if services are running
if docker-compose -f docker-compose.production.yml ps | grep -q "Up"; then
    echo "✅ Services are running successfully!"
    
    echo ""
    echo "🎉 CHIRPED IS LIVE!"
    echo "Frontend: http://localhost"
    echo "API: http://localhost/api"
    echo ""
    echo "To view logs: docker-compose -f docker-compose.production.yml logs -f"
    echo "To stop: docker-compose -f docker-compose.production.yml down"
    echo ""
else
    echo "❌ Some services failed to start. Check logs:"
    docker-compose -f docker-compose.production.yml logs
    exit 1
fi 