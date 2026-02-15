#!/bin/sh
set -e
# Đảm bảo /app/data tồn tại và user nodejs (uid 1001) có quyền ghi (cho setup-branding.json, setup-db.json)
if [ "$(id -u)" = "0" ]; then
  mkdir -p /app/data
  chown -R 1001:1001 /app/data
  exec su-exec nodejs "$@"
fi
exec "$@"
