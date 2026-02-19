# Backend Node (Express + TypeScript build)
FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache wget curl postgresql-client su-exec
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/schema.sql ./
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/sample-files ./sample-files

EXPOSE 3001
ENV PORT=3001
CMD ["node", "dist/server.js"]
