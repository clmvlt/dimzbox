import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { files: true, sessions: true } },
      },
    });

    // Récupérer le stockage par user via aggregate
    const storageByUser = await prisma.file.groupBy({
      by: ["userId"],
      _sum: { size: true },
      _count: true,
    });

    const storageMap = new Map(
      storageByUser.map((s) => [s.userId, Number(s._sum.size ?? 0)])
    );

    const result = users.map((u) => ({
      id: u.id,
      username: u.username,
      pseudo: u.pseudo,
      isAnonymous: u.isAnonymous,
      createdAt: u.createdAt,
      lastSeenAt: u.lastSeenAt,
      fileCount: u._count.files,
      sessionCount: u._count.sessions,
      storageUsed: storageMap.get(u.id) ?? 0,
    }));

    return Response.json(result);
  } catch (error) {
    console.error("Admin users error:", error);
    return Response.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
