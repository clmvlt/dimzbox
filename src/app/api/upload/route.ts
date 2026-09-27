import { NextRequest } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";
import { nanoid } from "nanoid";
import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { getOrCreateUser, getSessionUser } from "@/lib/auth";
import { config } from "@/lib/config";
import {
  crossOriginForbidden,
  getClientIp,
  isCrossOrigin,
  isRateLimited,
  tooManyRequests,
} from "@/lib/security";
import { getUserUsage, purgeStaleUploads, userUploadDir } from "@/lib/storage";
import {
  normalizeMimeType,
  safeExtension,
  sanitizeFileName,
  serializeFile,
} from "@/lib/files";

// Upload résumable en 3 temps :
//   POST /api/upload            → crée la session d'upload (ce fichier)
//   PUT  /api/upload/:id        → envoie un morceau à l'offset `Upload-Offset`
//   GET  /api/upload/:id        → offset courant (reprise après coupure)
// Cette route est exclue du proxy : le body n'est jamais bufferisé en mémoire.

const InitSchema = z.object({
  name: z.string().min(1).max(1024),
  size: z.number().int().min(0),
  type: z.string().max(255).optional(),
  clientKey: z.string().max(1200).optional(),
});

// GET — uploads inachevés de l'utilisateur (pour proposer de les reprendre)
export async function GET(request: NextRequest) {
  if (isRateLimited(`upload-list:${getClientIp(request)}`, 120)) {
    return tooManyRequests();
  }
  const user = await getSessionUser();
  if (!user) return Response.json([]);

  const uploads = await prisma.upload.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
  });

  const result = await Promise.all(
    uploads.map(async (u) => ({
      id: u.id,
      name: u.originalName,
      size: Number(u.size),
      mimeType: u.mimeType,
      clientKey: u.clientKey,
      offset: await fs.stat(u.path).then((s) => s.size, () => 0),
      updatedAt: u.updatedAt,
    }))
  );

  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (isCrossOrigin(request)) return crossOriginForbidden();
  if (isRateLimited(`upload-init:${getClientIp(request)}`, 300)) {
    return tooManyRequests();
  }

  try {
    const parsed = InitSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ error: "Paramètres invalides" }, { status: 400 });
    }

    const name = sanitizeFileName(parsed.data.name);
    const size = parsed.data.size;
    const mimeType = normalizeMimeType(parsed.data.type);

    if (size > config.upload.maxFileSize) {
      return Response.json(
        { error: "Fichier trop volumineux (max 100 Go)" },
        { status: 413 }
      );
    }

    const ext = path.extname(name).toLowerCase();
    if ((config.upload.blockedExtensions as readonly string[]).includes(ext)) {
      return Response.json(
        { error: "Type de fichier non autorisé" },
        { status: 400 }
      );
    }

    const user = await getOrCreateUser();

    // Nettoyage opportuniste des uploads abandonnés (au plus 1x/heure)
    purgeStaleUploads().catch((e) => console.error("Purge uploads:", e));

    const usage = await getUserUsage(user.id);
    if (usage.bytes + size > config.upload.maxStoragePerUser) {
      return Response.json(
        { error: "Quota de stockage dépassé (max 500 Go)" },
        { status: 413 }
      );
    }
    if (usage.count >= config.upload.maxFilesPerUser) {
      return Response.json(
        { error: "Nombre maximum de fichiers atteint" },
        { status: 413 }
      );
    }

    const dir = userUploadDir(user.id);
    await fs.mkdir(dir, { recursive: true });

    const storedName = `${nanoid()}${safeExtension(name)}`;
    const finalPath = path.join(dir, storedName);

    // Fichier vide : rien à envoyer, on le crée directement
    if (size === 0) {
      await fs.writeFile(finalPath, "");
      const file = await prisma.file.create({
        data: {
          name: storedName,
          originalName: name,
          size: BigInt(0),
          mimeType,
          path: finalPath,
          userId: user.id,
        },
      });
      return Response.json({
        id: file.id,
        size: 0,
        offset: 0,
        completed: true,
        file: serializeFile(file),
      });
    }

    const partPath = `${finalPath}.part`;
    await fs.writeFile(partPath, "");

    const upload = await prisma.upload.create({
      data: {
        userId: user.id,
        originalName: name,
        size: BigInt(size),
        mimeType,
        storedName,
        path: partPath,
        clientKey: parsed.data.clientKey ?? null,
      },
    });

    return Response.json({
      id: upload.id,
      size,
      offset: 0,
      completed: false,
      maxChunkSize: config.upload.maxChunkSize,
    });
  } catch (error) {
    console.error("Upload init error:", error);
    return Response.json(
      { error: "Impossible de démarrer l'upload" },
      { status: 500 }
    );
  }
}
