import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    domains: [
      'res.cloudinary.com',
      '1000logos.net',
      'www.vacheron-constantin.com',
      'www.patek.com',
      'www.audemarspiguet.com',
    ],
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'http', hostname: 'localhost', port: '5248', pathname: '/images/**' },
      { protocol: 'https', hostname: '1000logos.net', pathname: '/**' },
      // Luxury watch brand CDNs for external image URLs
      { protocol: 'https', hostname: 'www.vacheron-constantin.com', pathname: '/dam/**' },
      { protocol: 'https', hostname: 'www.patek.com', pathname: '/**' },
      { protocol: 'https', hostname: 'www.audemarspiguet.com', pathname: '/**' },
    ],
    // Increase timeout for external CDN image optimization (default 60s, now 120s)
    minimumCacheTTL: 60,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
};

export default nextConfig;
