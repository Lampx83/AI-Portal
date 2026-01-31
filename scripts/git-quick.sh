#!/bin/bash

# Script nhanh để commit và push (không hỏi xác nhận)
# Usage: ./scripts/git-quick.sh [commit message]

set -e

# Màu sắc
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

COMMIT_MSG="${1:-Update}"

# Kiểm tra có thay đổi không
if [ -z "$(git status --porcelain)" ]; then
    echo -e "${RED}❌ Không có thay đổi nào${NC}"
    exit 0
fi

echo -e "${BLUE}📦 Add → Commit → Push...${NC}"
git add .
git commit -m "$COMMIT_MSG"
git push origin "$(git branch --show-current)"

echo -e "${GREEN}✅ Done!${NC}"
