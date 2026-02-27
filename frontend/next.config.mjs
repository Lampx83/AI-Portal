/** @type {import('next').NextConfig} */
import postcssImport from 'postcss-import'
import path from 'path'
import { fileURLToPath } from 'url'

// Load root .env when running locally; in Docker, process.env is set by compose — dotenv optional so dev image works without it
const __dirname = path.dirname(fileURLToPath(import.meta.url))
try {
  const dotenv = (await import('dotenv')).default
  dotenv.config({ path: path.join(__dirname, '..', '.env') })
} catch (_) {}

// Base path when running under a subpath (e.g. https://ai.neu.edu.vn/tuyen-sinh → BASE_PATH=/tuyen-sinh)
const BASE_PATH = (process.env.BASE_PATH || '').replace(/\/+$/, '')
const hasBasePath = BASE_PATH.length > 0

// Build-time version & time (Docker: set NEXT_PUBLIC_APP_VERSION, NEXT_PUBLIC_BUILD_TIME in Dockerfile)
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  images: { unoptimized: true },
  output: 'standalone',
  ...(hasBasePath && {
    basePath: BASE_PATH,
    assetPrefix: BASE_PATH,
  }),
  // Allow large body (package upload). If still 413, configure reverse proxy (nginx: client_max_body_size 50m;).
  experimental: {
    serverActions: { bodySizeLimit: '50mb' },
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0',
    NEXT_PUBLIC_BUILD_TIME: process.env.NEXT_PUBLIC_BUILD_TIME || '',
    ...(hasBasePath && { NEXT_PUBLIC_BASE_PATH: BASE_PATH }),
  },
  // NEXTAUTH_URL should be set via environment variables, not hardcoded here
  // This allows different URLs for dev/prod environments
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
    const backend = process.env.BACKEND_URL || 'http://localhost:3001'
    const apiPrefixes = [
      'chat', 'orchestrator', 'agents', 'upload', 'central_agent',
      'users', 'admin', 'assistants', 'tools', 'apps', 'storage',
      'projects', 'feedback', 'site-strings', 'setup'
    ]
    const out = []
    for (const p of apiPrefixes) {
      out.push({ source: `/api/${p}`, destination: `${backend}/api/${p}` })
      out.push({ source: `/api/${p}/:path*`, destination: `${backend}/api/${p}/:path*` })
    }
    // Proxy /embed/* to backend so iframe app (Write) is same-origin and receives session cookies
    out.push({ source: '/embed', destination: `${backend}/embed` })
    out.push({ source: '/embed/:path*', destination: `${backend}/embed/:path*` })
    return out
  },
  transpilePackages: [
    '@ckeditor/ckeditor5-react',
    '@ckeditor/ckeditor5-editor-classic',
    '@ckeditor/ckeditor5-essentials',
    '@ckeditor/ckeditor5-paragraph',
    '@ckeditor/ckeditor5-basic-styles',
    '@ckeditor/ckeditor5-heading',
    '@ckeditor/ckeditor5-link',
    '@ckeditor/ckeditor5-list',
    '@ckeditor/ckeditor5-table',
    '@ckeditor/ckeditor5-image',
    '@ckeditor/ckeditor5-upload',
    '@ckeditor/ckeditor5-alignment',
    '@ckeditor/ckeditor5-highlight',
    '@ckeditor/ckeditor5-font',
    '@ckeditor/ckeditor5-code-block',
    '@ckeditor/ckeditor5-horizontal-line',
    '@ckeditor/ckeditor5-indent',
    '@ckeditor/ckeditor5-media-embed',
    '@ckeditor/ckeditor5-paste-from-office',
    '@ckeditor/ckeditor5-markdown-gfm',
    '@ckeditor/ckeditor5-word-count',
    '@ckeditor/ckeditor5-typing',
    '@ckeditor/ckeditor5-theme-lark'
  ],


  webpack(config, { dev }) {
    // Chỉ set devtool cho production (tắt source map). Dev để Next.js tự quyết định (tránh warning "Reverting devtool to false").
    if (!dev) config.devtool = false

    // Load CKEditor CSS (single <style> tag)
    config.module.rules.push({
      test: /ckeditor5-[^/\\]+[/\\]theme[/\\].+\.css$/,
      use: [
        { loader: 'style-loader', options: { injectType: 'singletonStyleTag' } },
        { loader: 'css-loader', options: { importLoaders: 1 } },
        {
          loader: 'postcss-loader',
          options: {
            postcssOptions: {
              plugins: [postcssImport]
            }
          }
        }
      ]
    })

    // Load SVG icons as raw string
    config.module.rules.push({
      test: /ckeditor5-[^/\\]+[/\\]theme[/\\]icons[/\\][^/\\]+\.svg$/,
      use: ['raw-loader']
    })

    return config;
  }
}

export default nextConfig
