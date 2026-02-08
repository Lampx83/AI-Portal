#!/bin/bash
# Script để dừng process đang sử dụng port 3001, 3000 (hoặc port tùy chỉnh)
# Usage: ./scripts/stop-port.sh [port1] [port2] ...
# Nếu không truyền port: mặc định giải phóng 3000 và 3001

set -e

if [ $# -eq 0 ]; then
  PORTS="3000 3001"
else
  PORTS="$*"
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

for PORT in $PORTS; do
  echo -e "${BLUE}🔍 Port ${PORT}:${NC}"

  # Hiển thị process đang dùng port
  PIDS=$(lsof -ti :${PORT} 2>/dev/null || echo "")
  if [ -n "$PIDS" ]; then
    echo -e "${YELLOW}   Process(es):${NC}"
    lsof -i :${PORT} 2>/dev/null | tail -n +2 || true
    for PID in $PIDS; do
      echo -e "${BLUE}   🛑 Kill PID ${PID}...${NC}"
      kill $PID 2>/dev/null || true
    done
    sleep 1
    for PID in $PIDS; do
      if kill -0 $PID 2>/dev/null; then
        echo -e "${RED}   Force kill -9 ${PID}${NC}"
        kill -9 $PID 2>/dev/null || true
      fi
    done
    sleep 1
    if lsof -ti :${PORT} >/dev/null 2>&1; then
      echo -e "${RED}   ❌ Vẫn còn process trên ${PORT}. Thử: sudo ./scripts/stop-port.sh ${PORT}${NC}"
    else
      echo -e "${GREEN}   ✅ Đã giải phóng port ${PORT}${NC}"
    fi
  else
    # Kiểm tra Docker
    CONTAINERS=$(docker ps --filter "publish=${PORT}" --format "{{.Names}} ({{.ID}})" 2>/dev/null || echo "")
    if [ -n "$CONTAINERS" ]; then
      echo -e "${YELLOW}   Docker: $CONTAINERS${NC}"
      for CID in $(docker ps --filter "publish=${PORT}" --format "{{.ID}}" 2>/dev/null); do docker stop "$CID" 2>/dev/null || true; done
      echo -e "${GREEN}   ✅ Đã dừng container dùng port ${PORT}${NC}"
    else
      echo -e "${GREEN}   ✅ Không ai dùng port ${PORT}${NC}"
    fi
  fi
  echo ""
done
