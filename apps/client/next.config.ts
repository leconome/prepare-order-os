import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // In dev, proxy /api/* requests to the Hono backend so cookies stay same-origin
  // (avoids cross-origin cookie rejection with *.localhost subdomains).
  // In production, the client calls api.prepareos.fr directly.
  async rewrites() {
    if (process.env.NODE_ENV !== "production") {
      return {
        fallback: [
          {
            source: "/api/:path*",
            destination: `http://localhost:${process.env.NEXT_PUBLIC_STORE_API_PORT || "9000"}/api/:path*`,
          },
        ],
      };
    }
    return { fallback: [] };
  },
  images: {
    // In dev, skip the optimization proxy (it blocks localhost/private IPs)
    unoptimized: process.env.NODE_ENV !== "production",
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "9000",
        pathname: "/api/images/**",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
      // Production: add your S3/R2 domain here
      { protocol: "https", hostname: "*" },
    ],
  },
};

export default nextConfig;
