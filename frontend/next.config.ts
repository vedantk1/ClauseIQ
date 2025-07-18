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

  // Enable experimental features for better performance
  experimental: {
    optimizePackageImports: ["react-hot-toast", "clsx"],
  },

  // Turbopack configuration (stable in Next.js 15)
  turbopack: {
    rules: {
      "**/*.worker.js": {
        loaders: ["file-loader"],
      },
      "**/*.worker.min.js": {
        loaders: ["file-loader"],
      },
      "**/*.worker.min.mjs": {
        loaders: ["file-loader"],
      },
    },
  },

  // Images configuration for containerized deployment
  images: {
    unoptimized: true,
  },

  // PDF.js configuration for Next.js 15 compatibility
  webpack: (config, { isServer }) => {
    // Handle PDF.js worker files
    config.module.rules.push({
      test: /\.worker\.(js|mjs)$/,
      type: "asset/resource",
      generator: {
        filename: "static/worker/[hash][ext][query]",
      },
    });

    // Handle PDF.js WebAssembly files
    config.module.rules.push({
      test: /\.wasm$/,
      type: "asset/resource",
      generator: {
        filename: "static/wasm/[hash][ext][query]",
      },
    });

    // Add externals for server-side rendering compatibility
    if (isServer) {
      config.externals = [...(config.externals || []), "canvas", "jsdom"];
    }

    return config;
  },
};

export default nextConfig;
