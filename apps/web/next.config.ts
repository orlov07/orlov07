import type { NextConfig } from "next";

// O monorepo mantém as credenciais no .env da raiz.
process.loadEnvFile("../../.env");

const nextConfig: NextConfig = {
  transpilePackages: ["@setra/scoring-engine"],
};

export default nextConfig;
