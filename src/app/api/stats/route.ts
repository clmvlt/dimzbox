import { prisma } from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/auth";
import { config } from "@/lib/config";

export async function GET() {
  try {
    const user = await getOrCreateUser();

    const [fileCount, storageAgg, links] = await Promise.all([
      prisma.file.count({ where: { userId: user.id } }),
      prisma.file.aggregate({
        where: { userId: user.id },
        _sum: { size: true },
      }),
      prisma.shareLink.findMany({
        where: { file: { userId: user.id } },
        select: { downloadCount: true, expiresAt: true },
      }),
    ]);

    const storageUsed = Number(storageAgg._sum.size ?? 0);
    const totalDownloads = links.reduce((sum, l) => sum + l.downloadCount, 0);
    const activeLinks = links.filter(
      (l) => !l.expiresAt || l.expiresAt > new Date()
    ).length;

    return Response.json({
      fileCount,
      storageUsed,
      storageMax: config.upload.maxStoragePerUser,
      totalDownloads,
      activeLinks,
    });
  } catch (error) {
    console.error("Stats error:", error);
    return Response.json(
      { error: "Erreur lors de la récupération des stats" },
      { status: 500 }
    );
  }
}
