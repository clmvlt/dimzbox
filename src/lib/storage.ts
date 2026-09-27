import path from "node:path";
import fs from "node:fs/promises";
import { prisma } from "./prisma";
import { config } from "./config";

export const UPLOAD_ROOT = path.resolve(config.upload.uploadDir);

/** HIGH-01: un chemin stocké en base doit rester sous le dossier d'uploads. */
export function isInsideUploadDir(filePath: string) {
  return path.resolve(filePath).startsWith(UPLOAD_ROOT + path.sep);
}

export function userUploadDir(userId: string) {
  return path.join(UPLOAD_ROOT, userId);
}

export async function removeFileQuietly(filePath: string) {
  try {
    await fs.unlink(filePath);
  } catch {
    // Déjà supprimé
  }
}

/** Espace consommé par un user : fichiers finis + uploads en cours (réservés). */
export async function getUserUsage(userId: string) {
  const [files, uploads] = await Promise.all([
    prisma.file.aggregate({
      where: { userId },
      _sum: { size: true },
      _count: true,
    }),
    prisma.upload.aggregate({
      where: { userId },
      _sum: { size: true },
      _count: true,
    }),
  ]);
  return {
    bytes: Number(files._sum.size ?? 0) + Number(uploads._sum.size ?? 0),
    count: files._count + uploads._count,
  };
}

// --- Verrou par upload -------------------------------------------------
// Un seul morceau écrit à la fois pour un upload donné (process unique pm2).

const store = globalThis as unknown as {
  __dimzboxUploadLocks?: Set<string>;
  __dimzboxLastPurge?: number;
};
const locks = (store.__dimzboxUploadLocks ??= new Set());

export function tryLockUpload(id: string) {
  if (locks.has(id)) return false;
  locks.add(id);
  return true;
}

export function unlockUpload(id: string) {
  locks.delete(id);
}

// --- Nettoyage -----------------------------------------------------------

/** Supprime les uploads inachevés sans activité depuis `staleUploadHours`. */
export async function purgeStaleUploads({ force = false } = {}) {
  const now = Date.now();
  // Au plus une fois par heure quand appelé de façon opportuniste
  if (!force && now - (store.__dimzboxLastPurge ?? 0) < 60 * 60 * 1000) {
    return 0;
  }
  store.__dimzboxLastPurge = now;

  const cutoff = new Date(now - config.upload.staleUploadHours * 60 * 60 * 1000);
  const stale = await prisma.upload.findMany({
    where: { updatedAt: { lt: cutoff } },
    select: { id: true, path: true },
  });

  let purged = 0;
  for (const upload of stale) {
    if (locks.has(upload.id)) continue;
    if (isInsideUploadDir(upload.path)) await removeFileQuietly(upload.path);
    await prisma.upload.delete({ where: { id: upload.id } }).catch(() => {});
    purged++;
  }
  return purged;
}

/** Liens expirés, fichiers expirés et uploads abandonnés. */
export async function cleanupExpired() {
  const now = new Date();

  const deletedLinks = await prisma.shareLink.deleteMany({
    where: { expiresAt: { lt: now } },
  });

  const expiredFiles = await prisma.file.findMany({
    where: { expiresAt: { lt: now } },
    select: { id: true, path: true },
  });
  for (const file of expiredFiles) {
    if (isInsideUploadDir(file.path)) await removeFileQuietly(file.path);
    await prisma.file.delete({ where: { id: file.id } }).catch(() => {});
  }

  const deletedUploads = await purgeStaleUploads({ force: true });

  return {
    deletedLinks: deletedLinks.count,
    deletedFiles: expiredFiles.length,
    deletedUploads,
  };
}
