import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@libsql/client"],
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/@libsql/**/*",
      "./node_modules/libsql/**/*",
    ],
  },
};

export default nextConfig;
