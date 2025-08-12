import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    domains: ['res.cloudinary.com', '1000logos.net'],
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'http', hostname: 'localhost', port: '5248', pathname: '/images/**' },
      { protocol: 'https', hostname: '1000logos.net', pathname: '/**' },
    ],
  },
};

export default nextConfig;
