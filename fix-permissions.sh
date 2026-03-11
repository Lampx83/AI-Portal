#!/usr/bin/env bash
# Chạy MỘT LẦN để sửa quyền sau khi từng chạy "sudo npm run dev".
# Sau khi chạy xong, không bao giờ cần sudo để chạy AI Portal nữa.
set -e
ME=$(whoami)
ROOT="$(cd "$(dirname "$0")" && pwd)"
echo "Sửa quyền sở hữu cho user: $ME"
sudo chown -R "$ME:staff" "$ROOT/frontend"
sudo chown -R "$ME:staff" "$ROOT/backend"
echo "Xong. Từ giờ chạy: npm run dev (không cần sudo)."
