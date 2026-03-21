import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const files = await prisma.file.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, username: true, pseudo: true, isAnonymous: true } },
        _count: { select: { shareLinks: true } },
      },
    });

    // Récupérer les downloads par fichier
    const downloadsByFile = await prisma.shareLink.groupBy({
      by: ["fileId"],
      _sum: { downloadCount: true },
    });
    const dlMap = new Map(
      downloadsByFile.map((d) => [d.fileId, d._sum.downloadCount ?? 0])
    );

    const result = files.map((f) => ({
      id: f.id,
      name: f.originalName,
      size: Number(f.size),
      mimeType: f.mimeType,
      createdAt: f.createdAt,
      userId: f.userId,
      userName: f.user.pseudo || f.user.username || (f.user.isAnonymous ? "Anonyme" : "—"),
      linkCount: f._count.shareLinks,
      totalDownloads: dlMap.get(f.id) ?? 0,
    }));

    return Response.json(result);
  } catch (error) {
    console.error("Admin files error:", error);
    return Response.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
