# Backend Node (Express + TypeScript build)
FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
# --ignore-scripts tránh ETXTBSY khi postinstall esbuild chạy trong BuildKit overlay
RUN npm ci --ignore-scripts && npm rebuild

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Ensure migrations and sample-files exist (repo may not have them)
RUN mkdir -p migrations sample-files
RUN npm run build

# Runner: install production dependencies only → smaller image (no typescript, tsx, @types/*)
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache wget curl postgresql-client su-exec
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

COPY --chown=nodejs:nodejs --from=builder /app/package.json /app/package-lock.json ./
COPY --chown=nodejs:nodejs --from=builder /app/node_modules ./node_modules
RUN npm prune --omit=dev && npm cache clean --force

COPY --chown=nodejs:nodejs --from=builder /app/dist ./dist
COPY --chown=nodejs:nodejs --from=builder /app/schema.sql ./
COPY --chown=nodejs:nodejs --from=builder /app/migrations ./migrations
COPY --chown=nodejs:nodejs --from=builder /app/sample-files ./sample-files

COPY --chown=nodejs:nodejs docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 3001
ENV PORT=3001
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "dist/server.js"]
