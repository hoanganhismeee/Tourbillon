import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['framer-motion'],
  allowedDevOrigins: ['*.ngrok-free.app', '*.ngrok-free.dev', '*.ngrok.io'],
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: '*.cloudfront.net', pathname: '/**' },
      { protocol: 'http', hostname: 'localhost', port: '5248', pathname: '/images/**' },
      { protocol: 'http', hostname: 'backend', port: '8080', pathname: '/images/**' },
      { protocol: 'https', hostname: '1000logos.net', pathname: '/**' },
      // Luxury watch brand CDNs for external image URLs
      { protocol: 'https', hostname: 'www.vacheron-constantin.com', pathname: '/dam/**' },
      { protocol: 'https', hostname: 'www.patek.com', pathname: '/**' },
      { protocol: 'https', hostname: 'www.audemarspiguet.com', pathname: '/**' },
      { protocol: 'https', hostname: 'dynamicmedia.audemarspiguet.com', pathname: '/**' },
      { protocol: 'https', hostname: 'www.glashuette-original.com', pathname: '/app/uploads/**' },
      { protocol: 'https', hostname: 'service.glashuette-original.com', pathname: '/storage/**' },
      // New brands (7-15)
      { protocol: 'https', hostname: 'www.alange-soehne.com', pathname: '/**' },
      { protocol: 'https', hostname: 'www.fpjourne.com', pathname: '/**' },
      { protocol: 'https', hostname: 'greubelforsey.com', pathname: '/**' },
      { protocol: 'https', hostname: 'www.greubelforsey.com', pathname: '/**' },
      { protocol: 'https', hostname: 'www.rolex.com', pathname: '/**' },
      { protocol: 'https', hostname: 'www.breguet.com', pathname: '/**' },

      { protocol: 'https', hostname: 'www.omegawatches.com', pathname: '/**' },
      { protocol: 'https', hostname: 'www.grand-seiko.com', pathname: '/**' },
      { protocol: 'https', hostname: 'frederiqueconstant.com', pathname: '/**' },
      { protocol: 'https', hostname: 'www.frederiqueconstant.com', pathname: '/**' },
    ],
    // Increase timeout for external CDN image optimization (default 60s, now 80s)
    minimumCacheTTL: 60,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
};

export default nextConfig;
