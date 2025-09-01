// /** @type {import('next').NextConfig} */
// const nextConfig = {
//   eslint: {
//     ignoreDuringBuilds: true,
//   },
//   typescript: {
//     ignoreBuildErrors: true,
//   },
//   images: {
//     unoptimized: true,
//   },
//   env: {
//     NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'https://research.neu.edu.vn',
//   },
//   productionBrowserSourceMaps: true, // Bật source map cho build production
//   webpack(config) {
//     config.devtool = 'source-map'; // Giúp trace ra file gốc khi lỗi
//     return config;
//   },
// }

// export default nextConfig

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  images: { unoptimized: true },
  env: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || "https://research.neu.edu.vn",
  },
  productionBrowserSourceMaps: true,
  webpack(config, { dev }) {
    if (!dev) config.devtool = "source-map"
    return config
  },
  async rewrites() {
    return [
      {
        source: "/api/agents/experts/:path*",
        destination: "http://101.96.66.218:8014/api/v1/:path*",
      },
    ]
  },
  async headers() {
    return [
      {
        source: "/api/agents/experts/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "no-referrer-when-downgrade" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ]
  },
}
module.exports = nextConfig
