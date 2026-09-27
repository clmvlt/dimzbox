import type { NextConfig } from "next";
import { readFileSync } from "fs";

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "@libsql/client", "@prisma/adapter-libsql"],
  allowedDevOrigins: ["192.168.1.120"],
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
  // Pas de proxyClientMaxBodySize géant : /api/upload est exclu du proxy
  // (voir src/proxy.ts), les uploads sont streamés directement sur disque.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
