import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker
  output: "standalone",

  // Optimize for production builds
  poweredByHeader: false,

  // Enable experimental features for better performance
  experimental: {
    optimizePackageImports: ["react-hot-toast", "clsx"],
  },

  // Images configuration for containerized deployment
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
