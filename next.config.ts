import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use basePath in production to serve assets correctly
  basePath: process.env.NODE_ENV === 'production' ? '/page-builder' : '',
  
  // Tell Next.js where assets are served from
  assetPrefix: process.env.NODE_ENV === 'production' ? '/page-builder' : '',
  
  // Allow images from the gateway domain in production
  images: {
    domains: ['localhost', 'komunate.com', '104.248.51.150.nip.io'],
  },
  
  // Ensure trailing slashes are consistent
  trailingSlash: false,
  
  // Disable strict mode for development to avoid double renders
  reactStrictMode: false,
};

export default nextConfig;
