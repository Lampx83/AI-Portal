#!/bin/bash
# Script kiểm tra và hướng dẫn khởi động PostgreSQL

set -e

echo "🔍 Kiểm tra PostgreSQL..."

# Kiểm tra port 5432
if nc -z localhost 5432 2>/dev/null; then
    echo "✅ PostgreSQL đang chạy trên port 5432"
    exit 0
fi

echo "❌ PostgreSQL không đang chạy"
echo ""
echo "📋 Các cách khởi động PostgreSQL:"
echo ""
echo "1. Sử dụng Docker Compose (Khuyến nghị):"
echo "   cd /Users/mac/Cursor/Research"
echo "   docker-compose up -d postgres"
echo ""
echo "2. Hoặc khởi động tất cả services:"
echo "   docker-compose up -d"
echo ""
echo "3. Kiểm tra status:"
echo "   docker-compose ps"
echo ""
echo "4. Xem logs nếu có lỗi:"
echo "   docker-compose logs postgres"
echo ""
echo "5. Nếu gặp lỗi permission, thử với sudo:"
echo "   sudo docker-compose up -d postgres"
echo ""
