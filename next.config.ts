import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const backend = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";
    return {
      afterFiles: [
        { source: "/health", destination: `${backend}/health` },
        { source: "/api/:path((?!wake$).*)", destination: `${backend}/api/:path*` },
      ],
    };
  },
};

export default nextConfig;
