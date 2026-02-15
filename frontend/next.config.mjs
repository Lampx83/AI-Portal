/** @type {import('next').NextConfig} */
import postcssImport from 'postcss-import'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

// Load root .env (AI-Portal/.env) when running npm run dev from frontend/ — Docker/build vẫn dùng process.env
const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  images: { unoptimized: true },
  output: 'standalone',
  // NEXTAUTH_URL should be set via environment variables, not hardcoded here
  // This allows different URLs for dev/prod environments
  productionBrowserSourceMaps: true,
  webpack(config) {
    config.devtool = 'source-map'
    return config
  },

  // Proxy /api/* sang backend, TRỪ /api/auth — auth do Route Handler proxy để luôn trả JSON (tránh CLIENT_FETCH_ERROR)
  async rewrites() {
    const backend = process.env.BACKEND_URL || 'http://localhost:3001'
    const apiPrefixes = [
      'chat', 'orchestrator', 'agents', 'upload', 'demo_agent', 'main_agent', 'write_agent',
      'regulations_agent', 'users', 'admin', 'assistants', 'tools', 'storage', 'write-articles',
      'projects', 'feedback', 'site-strings', 'setup', 'shortcuts'
    ]
    const out = []
    for (const p of apiPrefixes) {
      out.push({ source: `/api/${p}`, destination: `${backend}/api/${p}` })
      out.push({ source: `/api/${p}/:path*`, destination: `${backend}/api/${p}/:path*` })
    }
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


  webpack(config) {
    config.devtool = 'source-map'

    // Load CSS của CKEditor (tạo 1 thẻ <style> duy nhất)
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

    // Load SVG icon dạng raw string
    config.module.rules.push({
      test: /ckeditor5-[^/\\]+[/\\]theme[/\\]icons[/\\][^/\\]+\.svg$/,
      use: ['raw-loader']
    })

    return config;
  }
}

export default nextConfig
