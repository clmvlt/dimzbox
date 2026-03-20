import { prisma } from "@/lib/prisma";
import fs from "node:fs";
import { access } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { config } from "@/lib/config";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const link = await prisma.shareLink.findUnique({
      where: { token },
      include: { file: true },
    });

    if (!link) {
      return Response.json({ error: "Lien non trouvé" }, { status: 404 });
    }

    // Vérifier l'expiration
    if (link.expiresAt && link.expiresAt < new Date()) {
      return Response.json({ error: "Ce lien a expiré" }, { status: 410 });
    }

    // Vérifier le nombre max de téléchargements (LOW-02: atomic update)
    if (link.maxDownloads && link.downloadCount >= link.maxDownloads) {
      return Response.json(
        { error: "Nombre maximum de téléchargements atteint" },
        { status: 410 }
      );
    }

    // HIGH-01: Valider que le chemin est bien sous le répertoire d'uploads
    const uploadDir = path.resolve(config.upload.uploadDir);
    const resolvedPath = path.resolve(link.file.path);
    if (!resolvedPath.startsWith(uploadDir)) {
      return Response.json({ error: "Accès interdit" }, { status: 403 });
    }

    // Vérifier que le fichier existe sur le disque (async)
    try {
      await access(resolvedPath);
    } catch {
      return Response.json(
        { error: "Fichier introuvable sur le serveur" },
        { status: 404 }
      );
    }

    // LOW-02: Incrémenter atomiquement avec condition pour éviter la race condition
    if (link.maxDownloads) {
      const result = await prisma.$executeRawUnsafe(
        `UPDATE "ShareLink" SET "downloadCount" = "downloadCount" + 1 WHERE "id" = ? AND "downloadCount" < ?`,
        link.id,
        link.maxDownloads
      );
      if (result === 0) {
        return Response.json(
          { error: "Nombre maximum de téléchargements atteint" },
          { status: 410 }
        );
      }
    } else {
      await prisma.shareLink.update({
        where: { id: link.id },
        data: { downloadCount: { increment: 1 } },
      });
    }

    // FILE-01: Utiliser la taille depuis la DB au lieu de statSync
    const fileSize = Number(link.file.size);

    // Encoder le nom du fichier pour le header Content-Disposition
    const encodedName = encodeURIComponent(link.file.originalName);

    // FILE-03: Support Range requests pour la reprise de téléchargement
    const rangeHeader = request.headers.get("range");

    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        const start = parseInt(match[1], 10);
        const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;

        if (start >= fileSize || end >= fileSize || start > end) {
          return new Response(null, {
            status: 416,
            headers: {
              "Content-Range": `bytes */${fileSize}`,
            },
          });
        }

        const nodeStream = fs.createReadStream(resolvedPath, { start, end });
        const webStream = Readable.toWeb(nodeStream) as ReadableStream;

        return new Response(webStream, {
          status: 206,
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Length": String(end - start + 1),
            "Content-Range": `bytes ${start}-${end}/${fileSize}`,
            "Content-Disposition": `attachment; filename*=UTF-8''${encodedName}`,
            "Accept-Ranges": "bytes",
            "X-Content-Type-Options": "nosniff",
          },
        });
      }
    }

    // Streamer le fichier complet
    const nodeStream = fs.createReadStream(resolvedPath);
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;

    return new Response(webStream, {
      headers: {
        // MED-03: Forcer application/octet-stream pour empêcher l'exécution de contenu
        "Content-Type": "application/octet-stream",
        "Content-Length": String(fileSize),
        "Content-Disposition": `attachment; filename*=UTF-8''${encodedName}`,
        "Accept-Ranges": "bytes",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Download error:", error);
    return Response.json(
      { error: "Erreur lors du téléchargement" },
      { status: 500 }
    );
  }
}
