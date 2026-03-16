#!/usr/bin/env bash
# Chẩn đoán runaway CPU của aiportal-frontend.
# Chạy trên host (có Docker). In ra thông tin để tìm nguyên nhân gốc (Next.js chunk vs malware).
# Usage: ./scripts/diagnose-frontend-cpu.sh

CONTAINER="${CONTAINER:-aiportal-frontend}"

echo "=== 1. CMD / Entrypoint của container $CONTAINER ==="
docker inspect "$CONTAINER" --format 'Entrypoint: {{.Config.Entrypoint}}' 2>/dev/null || echo "Container not found or not running."
docker inspect "$CONTAINER" --format 'Cmd: {{.Config.Cmd}}' 2>/dev/null || true

echo ""
echo "=== 2. Image ID / Tag ==="
docker inspect "$CONTAINER" --format '{{.Image}}' 2>/dev/null || true
docker images --no-trunc 2>/dev/null | grep -E "aiportal.*frontend|frontend" || true

echo ""
echo "=== 3. File trong /app (container $CONTAINER) ==="
docker exec "$CONTAINER" ls -la /app 2>/dev/null || echo "Cannot exec (container not running?)."

echo ""
echo "=== 4. Process trong container (ps aux) ==="
docker exec "$CONTAINER" ps aux 2>/dev/null || docker top "$CONTAINER" 2>/dev/null || echo "Cannot list processes."

echo ""
echo "=== 5. Loại file cho các process tên hash (thay tên nếu khác) ==="
# Chạy file trên mọi entry trong /app trừ thư mục chuẩn
docker exec "$CONTAINER" sh -c 'for f in /app/*; do [ -f "$f" ] || continue; b=$(basename "$f"); case "$b" in server.js|package.json) ;; *) echo "--- $f ---"; file "$f" ;; esac; done' 2>/dev/null || true

echo ""
echo "=== 6. 200 byte đầu của 1 file hash (nếu có) — kiểm tra JS vs binary ==="
FIRST_HASH=$(docker exec "$CONTAINER" ls /app 2>/dev/null | grep -E '^[A-Za-z0-9]{5,}$' | head -1)
if [ -n "$FIRST_HASH" ]; then
  echo "File: /app/$FIRST_HASH"
  docker exec "$CONTAINER" head -c 200 "/app/$FIRST_HASH" 2>/dev/null | xxd || true
else
  echo "No hash-like filename found in /app."
fi

echo ""
echo "=== 7. package.json (để so phiên bản next) ==="
docker exec "$CONTAINER" cat /app/package.json 2>/dev/null | head -30 || true

echo ""
echo "Done. Lưu output này để so sánh sau khi rebuild hoặc đổi môi trường."
