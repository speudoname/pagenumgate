import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No basePath needed - nginx strips the /page-builder prefix
  // basePath: process.env.PROXIED === 'true' ? '/page-builder' : '',
  
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
