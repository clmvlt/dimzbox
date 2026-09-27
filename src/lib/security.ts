// Helpers partagés entre le proxy et les routes exclues du proxy (upload).

type RateEntry = { count: number; resetAt: number };

// globalThis : une seule Map même si le module est chargé par plusieurs bundles
const store = globalThis as unknown as {
  __dimzboxRateLimit?: Map<string, RateEntry>;
};
const rateLimitMap = (store.__dimzboxRateLimit ??= new Map());

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "127.0.0.1";
}

/** Fenêtre fixe d'une minute par clé. Retourne true si la limite est dépassée. */
export function isRateLimited(key: string, limit: number, windowMs = 60_000) {
  const now = Date.now();

  // Purge paresseuse pour éviter que la Map grossisse indéfiniment
  if (rateLimitMap.size > 5000) {
    for (const [k, entry] of rateLimitMap) {
      if (now > entry.resetAt) rateLimitMap.delete(k);
    }
  }

  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  entry.count++;
  return entry.count > limit;
}

export function tooManyRequests() {
  return Response.json(
    { error: "Trop de requêtes, veuillez réessayer dans un instant" },
    { status: 429, headers: { "Retry-After": "10" } }
  );
}

/** MED-01: Protection CSRF — une mutation doit venir de notre propre origine. */
export function isCrossOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const hosts = [
    request.headers.get("host"),
    request.headers.get("x-forwarded-host"),
  ].filter(Boolean);
  // Requêtes sans Origin (curl, outils) : autorisées, le cookie SameSite=Lax protège déjà
  if (!origin || hosts.length === 0) return false;
  try {
    return !hosts.includes(new URL(origin).host);
  } catch {
    return true;
  }
}

export function crossOriginForbidden() {
  return Response.json(
    { error: "Requête cross-origin non autorisée" },
    { status: 403 }
  );
}
