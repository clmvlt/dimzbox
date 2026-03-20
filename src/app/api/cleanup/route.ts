import { prisma } from "@/lib/prisma";
import fs from "node:fs/promises";

// LOW-03: Job de nettoyage des fichiers et liens expires
// Appelable via cron: GET /api/cleanup?secret=...
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  const expectedSecret = process.env.CLEANUP_SECRET;

  if (expectedSecret && secret !== expectedSecret) {
    return Response.json({ error: "Non autorise" }, { status: 403 });
  }

  try {
    const now = new Date();

    const deletedLinks = await prisma.shareLink.deleteMany({
      where: { expiresAt: { lt: now } },
    });

    const expiredFiles = await prisma.file.findMany({
      where: { expiresAt: { lt: now } },
    });

    let deletedFilesCount = 0;
    for (const file of expiredFiles) {
      try {
        await fs.unlink(file.path);
      } catch {
        // Fichier peut deja avoir ete supprime
      }
      await prisma.file.delete({ where: { id: file.id } });
      deletedFilesCount++;
    }

    return Response.json({
      deletedLinks: deletedLinks.count,
      deletedFiles: deletedFilesCount,
    });
  } catch (error) {
    console.error("Cleanup error:", error);
    return Response.json(
      { error: "Erreur lors du nettoyage" },
      { status: 500 }
    );
  }
}
