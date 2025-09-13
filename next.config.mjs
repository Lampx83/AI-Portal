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
      {
        source: '/api/agents/experts',
        destination: 'http://101.96.66.218:8014/api/v1',
      },
      {
        source: '/api/agents/experts/:path*',
        destination: 'http://101.96.66.218:8014/api/v1/:path*',
      },
      {
        source: '/api/agents/documents',
        destination: 'http://101.96.66.223:8000/api/v1',
      },
      {
        source: '/api/agents/documents/:path*',
        destination: 'http://101.96.66.223:8000/api/v1/:path*',
      },
    ]
  },
}

export default nextConfig
