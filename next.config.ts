import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No basePath - nginx will handle the path stripping
  
  // Allow images from the gateway domain in production
  images: {
    domains: ['localhost', 'komunate.com', '104.248.51.150.nip.io'],
  },
  
  // Disable strict mode for development to avoid double renders
  reactStrictMode: false,
  
  // Disable trailing slash enforcement
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
