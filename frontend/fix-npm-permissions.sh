#!/bin/bash
# Chạy script này MỘT LẦN để sửa quyền (cần nhập mật khẩu sudo).
# Sau đó có thể chạy npm i / npm run dev bình thường không cần sudo.

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
USER="$(whoami)"

echo "Sửa quyền thư mục npm cache và node_modules cho user: $USER"
sudo chown -R "$USER" "$HOME/.npm" 2>/dev/null || true
sudo chown -R "$USER" "$ROOT/node_modules" 2>/dev/null || true
sudo chown -R "$USER" "$ROOT/../backend/node_modules" 2>/dev/null || true

echo "Xong. Đang xóa node_modules cũ và cài lại..."
cd "$ROOT"
rm -rf node_modules
npm i

echo "Hoàn tất. Từ giờ chạy npm không cần sudo."
