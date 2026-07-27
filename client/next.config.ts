import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "randomuser.me",
      },
    ],
  },
  turbopack: {
    // Anchor the workspace root to this package's directory so that
    // the stray package-lock.json at /home/r76v/ is not mistakenly
    // treated as the monorepo root, which breaks the React Client Manifest.
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
