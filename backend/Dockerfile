# Backend Node (Express + TypeScript build)
FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Đảm bảo migrations và sample-files tồn tại (repo có thể không có)
RUN mkdir -p migrations sample-files
RUN npm run build

# Runner: chỉ cài production dependencies → image nhỏ hơn (không có typescript, tsx, @types/*)
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache wget curl postgresql-client su-exec
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

COPY --from=builder /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/schema.sql ./
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/sample-files ./sample-files

RUN chown -R nodejs:nodejs /app

EXPOSE 3001
ENV PORT=3001
USER nodejs
CMD ["node", "dist/server.js"]
