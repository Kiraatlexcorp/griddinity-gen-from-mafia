import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev server binds 0.0.0.0; without this, Next 16 blocks /_next/hmr from 127.0.0.1 and the page never hydrates.
  allowedDevOrigins: ["127.0.0.1", "0.0.0.0"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
