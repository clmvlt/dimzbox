import { prisma } from "@/lib/prisma";
import fs from "node:fs";
import { Readable } from "node:stream";

export async function GET(
  _request: Request,
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

    // Vérifier le nombre max de téléchargements
    if (link.maxDownloads && link.downloadCount >= link.maxDownloads) {
      return Response.json(
        { error: "Nombre maximum de téléchargements atteint" },
        { status: 410 }
      );
    }

    // Vérifier que le fichier existe sur le disque
    if (!fs.existsSync(link.file.path)) {
      return Response.json(
        { error: "Fichier introuvable sur le serveur" },
        { status: 404 }
      );
    }

    // Incrémenter le compteur de téléchargements
    await prisma.shareLink.update({
      where: { id: link.id },
      data: { downloadCount: { increment: 1 } },
    });

    // Streamer le fichier
    const stat = fs.statSync(link.file.path);
    const nodeStream = fs.createReadStream(link.file.path);
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;

    // Encoder le nom du fichier pour le header Content-Disposition
    const encodedName = encodeURIComponent(link.file.originalName);

    return new Response(webStream, {
      headers: {
        "Content-Type": link.file.mimeType,
        "Content-Length": String(stat.size),
        "Content-Disposition": `attachment; filename*=UTF-8''${encodedName}`,
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
