#!/usr/bin/env bash
# Build and push AI Portal (backend + frontend) to Docker Hub.
# Requires: Docker installed and logged in (docker login).
# Usage:
#   export DOCKERHUB_USER=your-username
#   ./push-dockerhub.sh
# Or:
#   DOCKERHUB_USER=your-username ./push-dockerhub.sh

set -e
cd "$(dirname "$0")"

if [ -z "${DOCKERHUB_USER}" ]; then
  echo "Error: DOCKERHUB_USER not set (Docker Hub username)."
  echo "Example: export DOCKERHUB_USER=myuser"
  echo "         ./push-dockerhub.sh"
  exit 1
fi

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.dockerhub.yml"

echo "=== Build backend & frontend (image: ${DOCKERHUB_USER}/ai-portal-*) ==="
$COMPOSE build backend frontend

echo "=== Pushing to Docker Hub ==="
$COMPOSE push backend frontend

echo "=== Done. Images pushed: ==="
echo "  ${DOCKERHUB_USER}/ai-portal-backend:latest"
echo "  ${DOCKERHUB_USER}/ai-portal-frontend:latest"
