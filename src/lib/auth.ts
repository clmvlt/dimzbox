import { headers } from "next/headers";
import { prisma } from "./prisma";

/**
 * Récupère l'adresse IP du client depuis les headers de la requête.
 */
export async function getClientIp(): Promise<string> {
  const h = await headers();

  // Headers classiques de proxy/reverse proxy
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  const realIp = h.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  return "127.0.0.1";
}

/**
 * Identifie ou crée un utilisateur à partir de son IP.
 * Met à jour lastSeenAt à chaque appel.
 */
export async function getOrCreateUser() {
  const ip = await getClientIp();

  const user = await prisma.user.upsert({
    where: { ipAddress: ip },
    update: { lastSeenAt: new Date() },
    create: { ipAddress: ip },
  });

  return user;
}
