# Dockerfile cho Next.js application
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
# Use npm install instead of npm ci to handle lock file sync issues
RUN npm install --legacy-peer-deps

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED 1

# Build args: Docker build dùng BACKEND_URL=http://backend:3001 để rewrites proxy /api/* đúng
# NEXTAUTH_URL/NEXT_PUBLIC_* có thể override tại runtime qua docker-compose env
ARG BACKEND_URL=http://backend:3001
ARG NEXTAUTH_URL=http://localhost:3000
ARG NEXTAUTH_SECRET
# Để trống để client gọi same-origin (localhost:3000), rewrites proxy sang backend; cookie session hoạt động
ARG NEXT_PUBLIC_API_BASE_URL=
ARG AZURE_AD_CLIENT_ID
ARG AZURE_AD_TENANT_ID

ENV BACKEND_URL=$BACKEND_URL
ENV NEXTAUTH_URL=$NEXTAUTH_URL
ENV NEXTAUTH_SECRET=$NEXTAUTH_SECRET
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV AZURE_AD_CLIENT_ID=$AZURE_AD_CLIENT_ID
ENV AZURE_AD_TENANT_ID=$AZURE_AD_TENANT_ID

# Build Next.js
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN apk add --no-cache curl wget

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files for Next.js standalone
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Ensure server.js exists (standalone output should include it)
# If server.js is in a subdirectory, adjust the path accordingly

# Set correct permissions
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Next.js standalone output: server.js should be in the root of standalone folder
CMD ["node", "server.js"]
