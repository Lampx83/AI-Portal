#!/bin/bash
# Script để dừng process đang sử dụng port 3001 hoặc 3000
# Usage: ./scripts/stop-port.sh [port]

set -e

PORT="${1:-3001}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Đang tìm process sử dụng port ${PORT}...${NC}"

# Tìm process đang sử dụng port
PID=$(lsof -ti :${PORT} 2>/dev/null || echo "")

if [ -z "$PID" ]; then
    echo -e "${YELLOW}⚠️  Không tìm thấy process nào đang sử dụng port ${PORT}${NC}"
    
    # Kiểm tra Docker containers
    echo -e "${BLUE}🔍 Đang kiểm tra Docker containers...${NC}"
    CONTAINERS=$(docker ps --filter "publish=${PORT}" --format "{{.ID}}" 2>/dev/null || echo "")
    
    if [ -z "$CONTAINERS" ]; then
        echo -e "${GREEN}✅ Port ${PORT} đã sẵn sàng${NC}"
        exit 0
    else
        echo -e "${YELLOW}⚠️  Tìm thấy Docker containers sử dụng port ${PORT}${NC}"
        for CONTAINER in $CONTAINERS; do
            echo -e "${BLUE}🛑 Dừng container ${CONTAINER}...${NC}"
            docker stop $CONTAINER 2>/dev/null || true
        done
        echo -e "${GREEN}✅ Đã dừng các containers${NC}"
        exit 0
    fi
else
    echo -e "${YELLOW}⚠️  Tìm thấy process ${PID} đang sử dụng port ${PORT}${NC}"
    echo -e "${BLUE}🛑 Đang dừng process ${PID}...${NC}"
    
    # Thử kill gracefully trước
    kill $PID 2>/dev/null || true
    sleep 2
    
    # Kiểm tra xem process còn chạy không
    if kill -0 $PID 2>/dev/null; then
        echo -e "${RED}⚠️  Process vẫn còn chạy, đang force kill...${NC}"
        kill -9 $PID 2>/dev/null || true
        sleep 1
    fi
    
    # Kiểm tra lại
    if lsof -ti :${PORT} >/dev/null 2>&1; then
        echo -e "${RED}❌ Không thể dừng process trên port ${PORT}${NC}"
        echo -e "${YELLOW}💡 Hãy thử chạy với sudo: sudo ./scripts/stop-port.sh ${PORT}${NC}"
        exit 1
    else
        echo -e "${GREEN}✅ Đã dừng process thành công${NC}"
    fi
fi
