import { cookies } from "next/headers";
import { prisma } from "./prisma";
import crypto from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(crypto.scrypt);

const SESSION_COOKIE = "dimzbox_session";
const SESSION_MAX_AGE = 365 * 24 * 60 * 60; // 1 an en secondes
const SESSION_EXPIRY_MS = SESSION_MAX_AGE * 1000;

// --- Password hashing ---

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  const hashVerify = (await scrypt(password, salt, 64)) as Buffer;
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), hashVerify);
}

// --- Session helpers ---

async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

async function getSessionToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value;
}

export async function createSession(userId: string): Promise<string> {
  const token = crypto.randomUUID();
  await prisma.session.create({
    data: {
      token,
      userId,
      expiresAt: new Date(Date.now() + SESSION_EXPIRY_MS),
    },
  });
  await setSessionCookie(token);
  return token;
}

export async function deleteCurrentSession() {
  const token = await getSessionToken();
  if (token) {
    await prisma.session.deleteMany({ where: { token } });
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE);
  }
}

// --- User identification ---

/**
 * Retourne l'utilisateur de la session courante, ou null.
 */
export async function getSessionUser() {
  const token = await getSessionToken();
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await prisma.session.delete({ where: { id: session.id } });
    }
    return null;
  }

  return session.user;
}

/**
 * Retourne l'utilisateur courant. Crée un utilisateur anonyme + session si aucun.
 * Remplace l'ancien getOrCreateUser() basé sur IP.
 */
export async function getOrCreateUser() {
  const existing = await getSessionUser();
  if (existing) {
    // Update lastSeenAt (fire and forget)
    prisma.user
      .update({
        where: { id: existing.id },
        data: { lastSeenAt: new Date() },
      })
      .catch(() => {});
    return existing;
  }

  // Créer un utilisateur anonyme
  const user = await prisma.user.create({
    data: { isAnonymous: true },
  });

  await createSession(user.id);
  return user;
}
