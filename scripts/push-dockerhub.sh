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

if [ -z "${APP_VERSION}" ]; then
  APP_VERSION="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
fi
if [ -z "${BUILD_TIME}" ]; then
  BUILD_TIME="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
fi
if [ -z "${FRONTEND_APP_VERSION}" ]; then
  FRONTEND_APP_VERSION="${APP_VERSION}"
fi
if [ -z "${FRONTEND_BUILD_TIME}" ]; then
  FRONTEND_BUILD_TIME="${BUILD_TIME}"
fi

export APP_VERSION BUILD_TIME FRONTEND_APP_VERSION FRONTEND_BUILD_TIME

echo "=== Build backend & frontend (image: ${DOCKERHUB_USER}/ai-portal-*) ==="
echo "Version: ${APP_VERSION}"
echo "Build time: ${BUILD_TIME}"
$COMPOSE build backend frontend

echo "=== Pushing to Docker Hub ==="
$COMPOSE push backend frontend

echo "=== Done. Images pushed: ==="
echo "  ${DOCKERHUB_USER}/ai-portal-backend:latest"
echo "  ${DOCKERHUB_USER}/ai-portal-frontend:latest"
