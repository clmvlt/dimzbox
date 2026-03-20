import { prisma } from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/auth";
import { config } from "@/lib/config";

export async function GET() {
  try {
    const user = await getOrCreateUser();

    // DB-02: Utiliser count/aggregate au lieu de charger tous les enregistrements
    const [fileCount, storageAgg, totalDownloadsAgg, activeLinks] =
      await Promise.all([
        prisma.file.count({ where: { userId: user.id } }),
        prisma.file.aggregate({
          where: { userId: user.id },
          _sum: { size: true },
        }),
        prisma.shareLink.aggregate({
          where: { file: { userId: user.id } },
          _sum: { downloadCount: true },
        }),
        prisma.shareLink.count({
          where: {
            file: { userId: user.id },
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
        }),
      ]);

    const storageUsed = Number(storageAgg._sum.size ?? 0);
    const totalDownloads = totalDownloadsAgg._sum.downloadCount ?? 0;

    return new Response(
      JSON.stringify({
        fileCount,
        storageUsed,
        storageMax: config.upload.maxStoragePerUser,
        totalDownloads,
        activeLinks,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          // CACHE-02: Cache court pour éviter les requêtes DB à chaque rechargement
          "Cache-Control": "private, max-age=5, stale-while-revalidate=10",
        },
      }
    );
  } catch (error) {
    console.error("Stats error:", error);
    return Response.json(
      { error: "Erreur lors de la récupération des stats" },
      { status: 500 }
    );
  }
}
