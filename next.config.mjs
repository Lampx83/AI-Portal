/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  images: { unoptimized: true },
  env: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'https://research.neu.edu.vn',
  },
  productionBrowserSourceMaps: true,
  webpack(config) {
    config.devtool = 'source-map'
    return config
  },

  async rewrites() {
    return [
      // map /api/agents/experts -> /api/v1 (không có phần đuôi)
      // {
      //   source: '/api/agents/experts',
      //   destination: 'http://101.96.66.218:8014/api/v1',
      // },
      // // map mọi đường dẫn con, ví dụ /api/agents/experts/metadata
      // {
      //   source: '/api/agents/experts/:path*',
      //   destination: 'http://101.96.66.218:8014/api/v1/:path*',
      // },
    ]
  },
}

export default nextConfig
