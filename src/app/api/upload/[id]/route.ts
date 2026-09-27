import fs from "node:fs";
import { rename, stat } from "node:fs/promises";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import type { Upload } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { serializeFile } from "@/lib/files";
import {
  crossOriginForbidden,
  getClientIp,
  isCrossOrigin,
  isRateLimited,
  tooManyRequests,
} from "@/lib/security";
import {
  isInsideUploadDir,
  removeFileQuietly,
  tryLockUpload,
  unlockUpload,
} from "@/lib/storage";

type Params = { params: Promise<{ id: string }> };

const sessionExpired = () =>
  Response.json(
    { error: "Session expirée, rechargez la page" },
    { status: 401 }
  );
const notFound = () =>
  Response.json({ error: "Upload introuvable" }, { status: 404 });

/** L'offset fait foi sur disque : c'est la taille du fichier partiel. */
async function diskOffset(partPath: string): Promise<number | null> {
  try {
    return (await stat(partPath)).size;
  } catch {
    return null;
  }
}

/** Upload déjà finalisé (ex : réponse du dernier morceau perdue) ? */
async function completedFile(id: string, userId: string) {
  const file = await prisma.file.findUnique({ where: { id } });
  if (!file || file.userId !== userId) return null;
  return Response.json({
    id,
    size: Number(file.size),
    offset: Number(file.size),
    completed: true,
    file: serializeFile(file),
  });
}

async function finalize(upload: Upload) {
  const finalPath = upload.path.replace(/\.part$/, "");
  await rename(upload.path, finalPath);
  try {
    const [file] = await prisma.$transaction([
      prisma.file.create({
        data: {
          id: upload.id,
          name: upload.storedName,
          originalName: upload.originalName,
          size: upload.size,
          mimeType: upload.mimeType,
          path: finalPath,
          userId: upload.userId,
        },
      }),
      prisma.upload.delete({ where: { id: upload.id } }),
    ]);
    return file;
  } catch (error) {
    // Remettre en état pour qu'une nouvelle tentative puisse finaliser
    await rename(finalPath, upload.path).catch(() => {});
    throw error;
  }
}

// GET — état d'un upload (pour reprendre là où on en était)
export async function GET(request: Request, { params }: Params) {
  if (isRateLimited(`upload-status:${getClientIp(request)}`, 600)) {
    return tooManyRequests();
  }
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return sessionExpired();

  const upload = await prisma.upload.findUnique({ where: { id } });
  if (!upload || upload.userId !== user.id) {
    return (await completedFile(id, user.id)) ?? notFound();
  }

  const offset = await diskOffset(upload.path);
  if (offset === null) return notFound();

  return Response.json({
    id,
    size: Number(upload.size),
    offset,
    completed: false,
    maxChunkSize: config.upload.maxChunkSize,
  });
}

// PUT — écrit un morceau à l'offset annoncé dans `Upload-Offset`
export async function PUT(request: Request, { params }: Params) {
  if (isCrossOrigin(request)) return crossOriginForbidden();

  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return sessionExpired();

  const offsetHeader = request.headers.get("upload-offset");
  const offset = Number(offsetHeader);
  if (offsetHeader === null || !Number.isSafeInteger(offset) || offset < 0) {
    return Response.json({ error: "En-tête Upload-Offset invalide" }, { status: 400 });
  }

  // Une requête précédente écrit encore (ex : retry client trop rapide)
  if (!tryLockUpload(id)) {
    return Response.json(
      { error: "Un morceau est déjà en cours d'écriture", busy: true },
      { status: 409 }
    );
  }

  try {
    const upload = await prisma.upload.findUnique({ where: { id } });
    if (!upload || upload.userId !== user.id) {
      return (await completedFile(id, user.id)) ?? notFound();
    }
    if (!isInsideUploadDir(upload.path)) {
      return Response.json({ error: "Accès interdit" }, { status: 403 });
    }

    const size = Number(upload.size);
    const current = await diskOffset(upload.path);
    if (current === null) return notFound();

    // Désynchronisé : le client reprend à l'offset réel
    if (offset !== current) {
      return Response.json(
        { error: "Offset désynchronisé", offset: current },
        { status: 409 }
      );
    }

    const limit = Math.min(size - current, config.upload.maxChunkSize);
    const declared = Number(request.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > limit) {
      return Response.json(
        { error: "Morceau trop grand", maxChunkSize: config.upload.maxChunkSize },
        { status: 413 }
      );
    }

    if (current < size) {
      if (!request.body) {
        return Response.json({ error: "Morceau vide" }, { status: 400 });
      }

      let received = 0;
      const guard = new Transform({
        transform(chunk: Buffer, _enc, callback) {
          received += chunk.length;
          if (received > limit) callback(new Error("CHUNK_TOO_LARGE"));
          else callback(null, chunk);
        },
      });

      try {
        await pipeline(
          Readable.fromWeb(request.body as NodeReadableStream),
          guard,
          fs.createWriteStream(upload.path, { flags: "r+", start: current })
        );
      } catch (error) {
        // Connexion coupée ou morceau trop long : les octets déjà écrits
        // restent valides, le client reprendra à l'offset réel.
        const now = await diskOffset(upload.path);
        const tooLarge = error instanceof Error && error.message === "CHUNK_TOO_LARGE";
        return Response.json(
          { error: tooLarge ? "Morceau trop grand" : "Morceau interrompu", offset: now },
          { status: tooLarge ? 413 : 400 }
        );
      }
    }

    const newOffset = (await diskOffset(upload.path)) ?? current;

    if (newOffset < size) {
      await prisma.upload.update({
        where: { id },
        data: { updatedAt: new Date() },
      });
      return Response.json({ id, size, offset: newOffset, completed: false });
    }

    const file = await finalize(upload);
    return Response.json({
      id,
      size,
      offset: size,
      completed: true,
      file: serializeFile(file),
    });
  } catch (error) {
    console.error("Upload chunk error:", error);
    return Response.json(
      { error: "Erreur serveur pendant l'upload" },
      { status: 500 }
    );
  } finally {
    unlockUpload(id);
  }
}

// DELETE — annule un upload en cours
export async function DELETE(request: Request, { params }: Params) {
  if (isCrossOrigin(request)) return crossOriginForbidden();

  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return sessionExpired();

  if (!tryLockUpload(id)) {
    return Response.json({ error: "Upload occupé", busy: true }, { status: 409 });
  }
  try {
    const upload = await prisma.upload.findUnique({ where: { id } });
    if (!upload || upload.userId !== user.id) {
      return Response.json({ success: true });
    }
    if (isInsideUploadDir(upload.path)) await removeFileQuietly(upload.path);
    await prisma.upload.delete({ where: { id } });
    return Response.json({ success: true });
  } catch (error) {
    console.error("Upload cancel error:", error);
    return Response.json({ error: "Erreur serveur" }, { status: 500 });
  } finally {
    unlockUpload(id);
  }
}
