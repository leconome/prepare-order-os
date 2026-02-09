import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker production builds
  output: process.env.NODE_ENV === "production" ? "standalone" : undefined,
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
