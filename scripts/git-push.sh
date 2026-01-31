#!/bin/bash

# Script để add, commit và push code lên GitHub
# Usage: ./scripts/git-push.sh [commit message]

set -e

# Màu sắc cho output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Lấy commit message từ argument hoặc prompt
COMMIT_MSG="${1:-}"

# Nếu không có commit message, hỏi user
if [ -z "$COMMIT_MSG" ]; then
    echo -e "${BLUE}📝 Nhập commit message:${NC}"
    read -r COMMIT_MSG
    if [ -z "$COMMIT_MSG" ]; then
        echo -e "${RED}❌ Commit message không được để trống!${NC}"
        exit 1
    fi
fi

# Kiểm tra xem có thay đổi nào không
if [ -z "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}⚠️  Không có thay đổi nào để commit${NC}"
    exit 0
fi

# Hiển thị status
echo -e "${BLUE}📋 Git status:${NC}"
git status --short

# Xác nhận với user
echo ""
echo -e "${YELLOW}⚠️  Bạn có muốn commit và push với message:${NC}"
echo -e "${GREEN}   \"$COMMIT_MSG\"${NC}"
echo -e "${YELLOW}   (y/n):${NC} "
read -r CONFIRM

if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo -e "${RED}❌ Đã hủy${NC}"
    exit 0
fi

# Add tất cả thay đổi
echo ""
echo -e "${BLUE}📦 Đang add files...${NC}"
git add .

# Commit
echo -e "${BLUE}💾 Đang commit...${NC}"
git commit -m "$COMMIT_MSG"

# Lấy branch hiện tại
CURRENT_BRANCH=$(git branch --show-current)
echo -e "${BLUE}🌿 Branch hiện tại: ${GREEN}$CURRENT_BRANCH${NC}"

# Push
echo -e "${BLUE}🚀 Đang push lên GitHub...${NC}"
git push origin "$CURRENT_BRANCH"

echo ""
echo -e "${GREEN}✅ Hoàn thành! Code đã được push lên GitHub${NC}"
