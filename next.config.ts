import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // When proxied through nginx, use basePath
  basePath: process.env.PROXIED === 'true' ? '/page-builder' : '',
  
  // Allow images from the gateway domain in production
  images: {
    domains: ['localhost'],
  },
  
  // Ensure trailing slashes are consistent
  trailingSlash: false,
  
  // Disable strict mode for development to avoid double renders
  reactStrictMode: false,
};

export default nextConfig;
