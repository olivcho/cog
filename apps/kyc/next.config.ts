import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@internal/platform"],
  serverExternalPackages: ["@prisma/client", ".prisma/client", "prisma"],
};

export default nextConfig;
