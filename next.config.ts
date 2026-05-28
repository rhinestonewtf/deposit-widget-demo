import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "github.com",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
    ],
  },
  webpack: (config) => {
    // @wagmi/core's Tempo connector dynamically imports 'accounts' as an
    // optional peer — runtime catches the failure, webpack tries to resolve
    // it statically at build and errors. Stub it.
    config.resolve = config.resolve ?? {};
    config.resolve.fallback = {
      ...(config.resolve.fallback ?? {}),
      accounts: false,
    };
    return config;
  },
};

export default nextConfig;
