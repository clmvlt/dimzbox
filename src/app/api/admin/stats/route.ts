import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const [
      totalUsers,
      registeredUsers,
      anonymousUsers,
      totalFiles,
      storageAgg,
      totalLinks,
      activeLinks,
      totalDownloadsAgg,
      totalSessions,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isAnonymous: false } }),
      prisma.user.count({ where: { isAnonymous: true } }),
      prisma.file.count(),
      prisma.file.aggregate({ _sum: { size: true } }),
      prisma.shareLink.count(),
      prisma.shareLink.count({
        where: {
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      }),
      prisma.shareLink.aggregate({ _sum: { downloadCount: true } }),
      prisma.session.count(),
    ]);

    return Response.json({
      totalUsers,
      registeredUsers,
      anonymousUsers,
      totalFiles,
      totalStorage: Number(storageAgg._sum.size ?? 0),
      totalLinks,
      activeLinks,
      expiredLinks: totalLinks - activeLinks,
      totalDownloads: totalDownloadsAgg._sum.downloadCount ?? 0,
      totalSessions,
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    return Response.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
