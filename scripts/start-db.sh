#!/bin/bash
# Script để start PostgreSQL database

set -e

echo "🔍 Kiểm tra PostgreSQL..."

# Kiểm tra xem PostgreSQL đã chạy chưa
if nc -z localhost 5432 2>/dev/null; then
    echo "✅ PostgreSQL đã chạy trên port 5432"
    exit 0
fi

echo "📦 Đang khởi động PostgreSQL bằng Docker Compose..."

# Thử start với docker-compose
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
elif command -v docker &> /dev/null && docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    echo "❌ Không tìm thấy docker-compose hoặc docker compose"
    echo "💡 Vui lòng cài đặt Docker hoặc start PostgreSQL thủ công"
    exit 1
fi

# Start chỉ postgres service
cd "$(dirname "$0")/.."
$DOCKER_COMPOSE up -d postgres

echo "⏳ Đợi PostgreSQL khởi động..."
sleep 5

# Kiểm tra lại
if nc -z localhost 5432 2>/dev/null; then
    echo "✅ PostgreSQL đã khởi động thành công!"
else
    echo "⚠️  PostgreSQL có thể vẫn đang khởi động..."
    echo "💡 Chạy: docker-compose logs postgres để xem logs"
fi
