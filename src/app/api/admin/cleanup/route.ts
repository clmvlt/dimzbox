import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { cleanupExpired } from "@/lib/storage";

export async function POST() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const now = new Date();

    // Liens expirés, fichiers expirés, uploads abandonnés
    const expired = await cleanupExpired();

    // Supprimer les sessions expirées
    const deletedSessions = await prisma.session.deleteMany({
      where: { expiresAt: { lt: now } },
    });

    // Supprimer les utilisateurs anonymes sans fichiers et sans session active
    const orphanAnonymous = await prisma.user.findMany({
      where: {
        isAnonymous: true,
        files: { none: {} },
        uploads: { none: {} },
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
      ...expired,
      deletedSessions: deletedSessions.count,
      deletedUsers: deletedUsersCount,
    });
  } catch (error) {
    console.error("Admin cleanup error:", error);
    return Response.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
