#!/bin/sh
set -e
mkdir -p /app/data
# Khi /app/data là bind mount (./backend/data), chown có thể Permission denied trên host FS — không thoát, vẫn chạy app
chown -R nodejs:nodejs /app/data 2>/dev/null || true
exec su-exec nodejs "$@"
