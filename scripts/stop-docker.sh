#!/bin/bash
# Script để dừng tất cả Docker containers của project
# Usage: ./scripts/stop-docker.sh

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🛑 Đang dừng Docker containers...${NC}"

# Thử với docker compose down
if docker compose down --remove-orphans 2>/dev/null; then
    echo -e "${GREEN}✅ Đã dừng containers thành công${NC}"
    exit 0
fi

# Nếu không có quyền, thử với sudo
echo -e "${YELLOW}⚠️  Không có quyền, đang thử với sudo...${NC}"
if sudo docker compose down --remove-orphans 2>/dev/null; then
    echo -e "${GREEN}✅ Đã dừng containers thành công (với sudo)${NC}"
    exit 0
fi

# Nếu vẫn không được, thử dừng từng container
echo -e "${YELLOW}⚠️  Đang thử dừng từng container...${NC}"

CONTAINERS=("research_backend" "research_frontend" "research_postgres")

for CONTAINER in "${CONTAINERS[@]}"; do
    if sudo docker ps -a --format "{{.Names}}" | grep -q "^${CONTAINER}$"; then
        echo -e "${BLUE}🛑 Dừng container ${CONTAINER}...${NC}"
        sudo docker stop $CONTAINER 2>/dev/null || true
        sudo docker rm $CONTAINER 2>/dev/null || true
    fi
done

echo -e "${GREEN}✅ Hoàn tất${NC}"
