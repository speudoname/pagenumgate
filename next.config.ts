import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No basePath - nginx strips the prefix for routing
  // Only use assetPrefix to serve static assets from correct path
  assetPrefix: process.env.NODE_ENV === 'production' ? '/page-builder' : '',
  
  // Allow images from the gateway domain in production
  images: {
    domains: ['localhost', 'komunate.com', '104.248.51.150.nip.io'],
  },
  
  // Ensure trailing slashes are consistent
  trailingSlash: false,
  
  // Disable strict mode for development to avoid double renders
  reactStrictMode: false,
  
  // Public runtime config for client-side path handling
  publicRuntimeConfig: {
    basePath: process.env.NODE_ENV === 'production' ? '/page-builder' : '',
  },
};

export default nextConfig;
