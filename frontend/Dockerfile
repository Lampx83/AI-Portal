# Frontend Next.js (standalone)
FROM node:20-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1

# Build-time: rewrites và NEXT_PUBLIC_* (runtime override qua docker-compose env)
# Để chạy dưới subpath (vd. https://ai.neu.edu.vn/tuyen-sinh): BASE_PATH=/tuyen-sinh, NEXT_PUBLIC_API_BASE_URL=https://ai.neu.edu.vn/tuyen-sinh
ARG BACKEND_URL=http://backend:3001
ARG NEXTAUTH_URL=http://localhost:3000
ARG NEXT_PUBLIC_API_BASE_URL=
ARG BASE_PATH=
ARG AZURE_AD_CLIENT_ID=
ARG AZURE_AD_TENANT_ID=
ARG NEXT_PUBLIC_APP_VERSION=0.1.0
ARG NEXT_PUBLIC_BUILD_TIME=
ENV BACKEND_URL=$BACKEND_URL
ENV NEXTAUTH_URL=$NEXTAUTH_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV BASE_PATH=$BASE_PATH
ENV AZURE_AD_CLIENT_ID=$AZURE_AD_CLIENT_ID
ENV AZURE_AD_TENANT_ID=$AZURE_AD_TENANT_ID
ENV NEXT_PUBLIC_APP_VERSION=$NEXT_PUBLIC_APP_VERSION
ENV NEXT_PUBLIC_BUILD_TIME=$NEXT_PUBLIC_BUILD_TIME

# Avoid SIGBUS/OOM during next build in Docker (increase Node heap)
ENV NODE_OPTIONS="--max-old-space-size=4096"

RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache curl wget
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
RUN chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Giới hạn heap khi chạy trong container (tránh FATAL ERROR: JavaScript heap out of memory).
# Có thể override khi chạy: -e NODE_OPTIONS=--max-old-space-size=2048 hoặc qua docker-compose.
ENV NODE_OPTIONS="--max-old-space-size=1024"
CMD ["node", "server.js"]
