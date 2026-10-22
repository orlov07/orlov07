import type { NextConfig } from "next";

// O monorepo mantém as credenciais no .env da raiz.
process.loadEnvFile("../../.env");

const nextConfig: NextConfig = {
  transpilePackages: ["@setra/scoring-engine"],
  turbopack: {
    resolveAlias: {
      fs: { browser: "./lib/browser-empty.ts" },
      path: { browser: "./lib/browser-empty.ts" },
      crypto: { browser: "./lib/browser-empty.ts" },
    },
  },
};

export default nextConfig;
