import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker
  output: "standalone",

  // Optimize for production builds
  poweredByHeader: false,

  // ESLint configuration for build
  eslint: {
    ignoreDuringBuilds: true, // Skip ESLint during build for deployment
  },

  // Webpack configuration for PDF.js compatibility
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Exclude Node.js-specific modules from browser bundle
      config.resolve.fallback = {
        ...config.resolve.fallback,
        canvas: false,
        fs: false,
        path: false,
        os: false,
        crypto: false,
        stream: false,
        http: false,
        https: false,
        zlib: false,
        url: false,
      };
    }

    // Fix for PDF.js canvas module error - prevent webpack from trying to resolve canvas
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
      encoding: false,
    };

    return config;
  },

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
