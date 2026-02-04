/** @type {import('next').NextConfig} */
import postcssImport from 'postcss-import'
// Load .env from parent directory BEFORE Next.js config loads
// This ensures env vars are available when Next.js initializes
import './lib/load-env.js'

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

  // Proxy toàn bộ /api/* sang backend để cookie session (cùng origin) được gửi kèm khi gọi API
  // Dev: localhost:3001. Docker: http://backend:3001 (BACKEND_URL)
  async rewrites() {
    const backend = process.env.BACKEND_URL || 'http://localhost:3001'
    return [
      { source: '/api/:path*', destination: `${backend}/api/:path*` }
    ]
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
