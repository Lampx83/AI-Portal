#!/bin/sh
set -e
mkdir -p /app/data
chown -R nodejs:nodejs /app/data
exec su-exec nodejs "$@"
