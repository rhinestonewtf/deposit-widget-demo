import type { NextConfig } from "next";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
const modalDist = "../deposit-modal/dist";

const nextConfig: NextConfig = {
  transpilePackages: ["@rhinestone/deposit-modal"],
  turbopack: {
    resolveAlias: {
      "@rhinestone/deposit-modal/styles.css": `${modalDist}/styles.css`,
      "@rhinestone/deposit-modal": `${modalDist}/index.mjs`,
    },
  },
  webpack: (config) => {
    const modalRoot = join(__dir, "../deposit-modal");
    config.resolve.alias = {
      ...config.resolve.alias,
      "@rhinestone/deposit-modal/styles.css": join(modalRoot, "dist/styles.css"),
      "@rhinestone/deposit-modal": join(modalRoot, "dist/index.mjs"),
    };
    return config;
  },
};

export default nextConfig;
