import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Silence workspace root inference warning by explicitly setting the tracing root to this app
  outputFileTracingRoot: __dirname,
  output: "standalone",
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
    };
    return config;
  },
};

export default nextConfig;
