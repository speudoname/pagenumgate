import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use basePath for both assets and routing in production
  basePath: process.env.NODE_ENV === 'production' ? '/page-builder' : '',
  
  // Allow images from the gateway domain in production
  images: {
    domains: ['localhost', 'komunate.com', '104.248.51.150.nip.io'],
  },
  
  // Disable strict mode for development to avoid double renders
  reactStrictMode: false,
  
  // Disable trailing slash enforcement for API routes
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
