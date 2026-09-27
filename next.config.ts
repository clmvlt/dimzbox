import type { NextConfig } from "next";
import { readFileSync } from "fs";

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));

const nextConfig: NextConfig = {
  // Le déploiement construit dans un dossier séparé (NEXT_DIST_DIR=.next-build)
  // pendant que le serveur continue de tourner sur .next, puis échange les deux :
  // le site (et les uploads en cours) ne subissent qu'un redémarrage de quelques secondes.
  distDir: process.env.NEXT_DIST_DIR || ".next",
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
