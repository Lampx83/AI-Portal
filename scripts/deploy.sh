#!/bin/bash

# Script để deploy ứng dụng Research lên server sử dụng Docker Compose
# Usage: ./scripts/deploy.sh

set -e

# Màu sắc cho output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting deployment...${NC}"

# Kiểm tra docker và docker-compose
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed!${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed!${NC}"
    exit 1
fi

# Xác định lệnh docker-compose
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
else
    DOCKER_COMPOSE="docker compose"
fi

# Kiểm tra file .env
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file not found!${NC}"
    echo "Please create .env file from .env.example"
    exit 1
fi

# Backup image hiện tại
echo -e "${YELLOW}📦 Backing up current image...${NC}"
docker tag research-app:latest research-app:backup-$(date +%Y%m%d-%H%M%S) 2>/dev/null || true

# Dừng containers cũ
echo -e "${YELLOW}🛑 Stopping old containers...${NC}"
$DOCKER_COMPOSE down || true

# Build image mới
echo -e "${YELLOW}🔨 Building new Docker image...${NC}"
$DOCKER_COMPOSE build --no-cache app

# Khởi động services
echo -e "${YELLOW}🚀 Starting services...${NC}"
$DOCKER_COMPOSE up -d

# Đợi services khởi động
echo -e "${YELLOW}⏳ Waiting for services to be healthy...${NC}"
sleep 15

# Kiểm tra status
echo -e "${GREEN}📊 Service status:${NC}"
$DOCKER_COMPOSE ps

# Kiểm tra health
echo -e "${YELLOW}🏥 Checking application health...${NC}"
sleep 5

APP_STATUS=$($DOCKER_COMPOSE ps app | grep -c "Up" || echo "0")

if [ "$APP_STATUS" -gt 0 ]; then
    echo -e "${GREEN}✅ Application deployed successfully!${NC}"
    
    # Test endpoint
    if curl -f http://localhost:3000 > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Application is responding!${NC}"
    else
        echo -e "${YELLOW}⚠️  Application might still be starting up...${NC}"
    fi
    
    echo -e "${GREEN}📝 Recent logs:${NC}"
    $DOCKER_COMPOSE logs --tail=20 app
else
    echo -e "${RED}❌ Application deployment failed!${NC}"
    echo -e "${RED}📝 Error logs:${NC}"
    $DOCKER_COMPOSE logs app
    exit 1
fi

echo -e "${GREEN}✨ Deployment completed!${NC}"
