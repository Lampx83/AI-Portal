#!/usr/bin/env bash
# Sửa quyền node_modules (thường do từng chạy npm/docker với root) rồi cài dependency.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/frontend"
echo "→ sudo chown (node_modules, .next) — nhập mật khẩu máy nếu được hỏi"
for d in node_modules .next; do
  [[ -d "$d" ]] && sudo chown -R "$(whoami)" "$d"
done
echo "→ npm install"
npm install
echo "→ xong."
