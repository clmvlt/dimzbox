import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import fs from "node:fs/promises";

export async function POST() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const now = new Date();

    // Supprimer les liens expirés
    const deletedLinks = await prisma.shareLink.deleteMany({
      where: { expiresAt: { lt: now } },
    });

    // Supprimer les fichiers expirés
    const expiredFiles = await prisma.file.findMany({
      where: { expiresAt: { lt: now } },
    });

    let deletedFilesCount = 0;
    for (const file of expiredFiles) {
      try {
        await fs.unlink(file.path);
      } catch {
        // Fichier peut déjà avoir été supprimé
      }
      await prisma.file.delete({ where: { id: file.id } });
      deletedFilesCount++;
    }

    // Supprimer les sessions expirées
    const deletedSessions = await prisma.session.deleteMany({
      where: { expiresAt: { lt: now } },
    });

    // Supprimer les utilisateurs anonymes sans fichiers et sans session active
    const orphanAnonymous = await prisma.user.findMany({
      where: {
        isAnonymous: true,
        files: { none: {} },
        sessions: { none: {} },
      },
      select: { id: true },
    });

    let deletedUsersCount = 0;
    if (orphanAnonymous.length > 0) {
      const result = await prisma.user.deleteMany({
        where: { id: { in: orphanAnonymous.map((u) => u.id) } },
      });
      deletedUsersCount = result.count;
    }

    return Response.json({
      deletedLinks: deletedLinks.count,
      deletedFiles: deletedFilesCount,
      deletedSessions: deletedSessions.count,
      deletedUsers: deletedUsersCount,
    });
  } catch (error) {
    console.error("Admin cleanup error:", error);
    return Response.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
