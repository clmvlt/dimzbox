import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  crossOriginForbidden,
  getClientIp,
  isCrossOrigin,
  isRateLimited,
  tooManyRequests,
} from "@/lib/security";

// HIGH-03: Rate limiting en mémoire par IP (requêtes / minute).
// /api/upload n'est PAS couvert (voir matcher) : le proxy bufferise le body
// en mémoire, ce qui est inacceptable pour des fichiers de plusieurs Go.
// Les routes d'upload font leurs propres vérifications.
const RATE_LIMITS: Record<string, number> = {
  "/api/account": 30,
  "/api/download": 300,
  "/api/files": 240,
  "/api/admin": 240,
};
const DEFAULT_LIMIT = 240;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const matchedRoute = Object.keys(RATE_LIMITS).find((route) =>
    pathname.startsWith(route)
  );
  const limit = matchedRoute ? RATE_LIMITS[matchedRoute] : DEFAULT_LIMIT;
  const bucket = matchedRoute ?? "/api";

  if (isRateLimited(`${getClientIp(request)}:${bucket}`, limit)) {
    return tooManyRequests();
  }

  // MED-01: Protection CSRF - valider l'Origin sur les mutations
  if (
    ["POST", "PUT", "DELETE", "PATCH"].includes(request.method) &&
    isCrossOrigin(request)
  ) {
    return crossOriginForbidden();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/((?!upload).*)"],
};
