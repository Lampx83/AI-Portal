/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  env: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'https://research.neu.edu.vn',
  },
  productionBrowserSourceMaps: true, // Bật source map cho build production
  webpack(config) {
    config.devtool = 'source-map'; // Giúp trace ra file gốc khi lỗi
    return config;
  },
}

export default nextConfig