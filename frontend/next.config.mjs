/** @type {import('next').NextConfig} */
const nextConfig = {
  // 图片优化配置
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30天缓存
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // 压缩配置
  compress: true,

  // 实验性功能
  experimental: {
    // 优化 CSS
    optimizeCss: false,
    // 优化包体积
    optimizePackageImports: ['framer-motion'],
  },

  // 头部配置（安全与性能）
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // 安全头部
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          // 性能优化头部
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // 动态页面的缓存策略
        source: '/',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=60, stale-while-revalidate=300',
          },
        ],
      },
    ];
  },

  // 重定向配置
  async redirects() {
    return [
      {
        source: '/home',
        destination: '/',
        permanent: true,
      },
    ];
  },

  // 构建输出配置
  output: 'standalone',
  
  // 生产环境配置
  productionBrowserSourceMaps: false,
  
  // 性能分析（仅在需要时启用）
  // bundleAnalyzer: process.env.ANALYZE === 'true',
};

export default nextConfig;
