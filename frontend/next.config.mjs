/** @type {import('next').NextConfig} */
import path from 'path'
import { fileURLToPath } from 'url'

// Load root .env when running locally; in Docker, process.env is set by compose — dotenv optional so dev image works without it
const __dirname = path.dirname(fileURLToPath(import.meta.url))
try {
  const dotenv = (await import('dotenv')).default
  dotenv.config({ path: path.join(__dirname, '..', '.env') })
} catch (_) {}

const BASE_PATH = (process.env.BASE_PATH || '').replace(/\/+$/, '')
const hasBasePath = BASE_PATH.length > 0

// Build-time version & time (Docker: set NEXT_PUBLIC_APP_VERSION, NEXT_PUBLIC_BUILD_TIME in Dockerfile)
const nextConfig = {
  typescript: { ignoreBuildErrors: true },
  images: { unoptimized: true },
  output: 'standalone',
  // Next 16: Turbopack is default; we have webpack config for dev — add empty turbopack so build succeeds
  turbopack: {},
  ...(hasBasePath && {
    basePath: BASE_PATH,
    assetPrefix: BASE_PATH,
  }),
  // Allow large body (package upload). If still 413, configure reverse proxy (nginx: client_max_body_size 50m;).
  experimental: {
    serverActions: { bodySizeLimit: '50mb' },
    proxyClientMaxBodySize: '50mb',
  },
  // Cho phép truy cập từ 127.0.0.1:3000 và localhost:3000 → WebSocket HMR và /_next/*
  // Full origin format required when accessing via different host (Docker: host 127.0.0.1:3000 → container :3000)
  allowedDevOrigins: [
    '127.0.0.1', '127.0.0.1:3000', 'localhost', 'localhost:3000',
    'http://127.0.0.1:3000', 'http://localhost:3000',
  ],
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0',
    NEXT_PUBLIC_BUILD_TIME: process.env.NEXT_PUBLIC_BUILD_TIME || '',
    ...(hasBasePath && { NEXT_PUBLIC_BASE_PATH: BASE_PATH }),
  },
  // Tắt source map production để giảm RAM trong container (đã set ở webpack bên dưới: dev ? source-map : false).
  productionBrowserSourceMaps: false,

  // Cache static assets lâu để CDN/browser cache khi nhiều user
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ]
  },

  // Proxy /api/* to backend, EXCEPT /api/auth — auth is proxied by Route Handler so it always returns JSON (avoids CLIENT_FETCH_ERROR)
  async rewrites() {
    const backend =
      process.env.BACKEND_URL ||
      (process.env.NODE_ENV === "development" ? "http://localhost:3001" : "http://backend:3001")
    // 'apps' không dùng rewrite — xử lý bởi app/api/apps/[[...path]]/route.ts để chuyển tiếp Cookie (Surveylab đồng bộ DB theo user).
    const apiPrefixes = [
      'chat', 'orchestrator', 'agents', 'upload', 'central_agent',
      'users', 'admin', 'assistants', 'tools', 'storage',
      'projects', 'feedback', 'site-strings', 'setup'
    ]
    const out = []
    for (const p of apiPrefixes) {
      out.push({ source: `/api/${p}`, destination: `${backend}/api/${p}` })
      out.push({ source: `/api/${p}/:path*`, destination: `${backend}/api/${p}/:path*` })
    }
    // Proxy /embed/* to backend so iframe app (Write) is same-origin and receives session cookies.
    // Assistant embed (central, main) must be served by Next — add pass-through first so they don't 404 on backend.
    const assistantEmbedAliases = ['central', 'main']
    for (const a of assistantEmbedAliases) {
      out.push({ source: `/embed/${a}`, destination: `/embed/${a}` })
      out.push({ source: `/embed/${a}/:path*`, destination: `/embed/${a}/:path*` })
    }
    out.push({ source: '/embed', destination: `${backend}/embed` })
    out.push({ source: '/embed/:path*', destination: `${backend}/embed/:path*` })
    return out
  },
  webpack(config, { dev }) {
    // Chỉ set devtool cho production (tắt source map). Dev để Next.js tự quyết định (tránh warning "Reverting devtool to false").
    if (!dev) config.devtool = false
    // Docker dev: file watching across container boundary cần polling để HMR ổn định
    if (dev) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      }
    }
    return config
  }
}

export default nextConfig
