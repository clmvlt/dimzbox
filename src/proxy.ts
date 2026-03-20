import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// HIGH-03: Rate limiting en mémoire par IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60_000; // 1 minute

const RATE_LIMITS: Record<string, number> = {
  "/api/upload": 10,
  "/api/download": 100,
  "/api/files": 50,
};

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "127.0.0.1";
}

function isRateLimited(ip: string, route: string, limit: number): boolean {
  const now = Date.now();
  const key = `${ip}:${route}`;
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return false;
  }

  entry.count++;
  return entry.count > limit;
}

// Nettoyage periodique pour eviter les fuites memoire
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  }
}, RATE_LIMIT_WINDOW);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rate limiting sur les routes API
  if (pathname.startsWith("/api/")) {
    const ip = getClientIp(request);

    // Trouver la limite applicable
    const matchedRoute = Object.keys(RATE_LIMITS).find((route) =>
      pathname.startsWith(route)
    );
    const limit = matchedRoute ? RATE_LIMITS[matchedRoute] : 50;

    if (isRateLimited(ip, matchedRoute ?? "/api", limit)) {
      return Response.json(
        { error: "Trop de requêtes, veuillez réessayer plus tard" },
        { status: 429 }
      );
    }
  }

  // MED-01: Protection CSRF - valider l'Origin sur les mutations
  if (
    pathname.startsWith("/api/") &&
    ["POST", "PUT", "DELETE", "PATCH"].includes(request.method)
  ) {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");

    // En développement, autoriser les requêtes sans Origin (ex: curl, Postman)
    if (origin && host) {
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        return Response.json(
          { error: "Requête cross-origin non autorisée" },
          { status: 403 }
        );
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
