import { prisma } from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getOrCreateUser();

    const files = await prisma.file.findMany({
      where: { userId: user.id },
      include: {
        shareLinks: {
          select: {
            id: true,
            token: true,
            downloadCount: true,
            maxDownloads: true,
            expiresAt: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const serialized = files.map((f) => ({
      id: f.id,
      name: f.originalName,
      size: Number(f.size),
      mimeType: f.mimeType,
      createdAt: f.createdAt,
      shareLinks: f.shareLinks,
      totalDownloads: f.shareLinks.reduce((sum, l) => sum + l.downloadCount, 0),
    }));

    return Response.json(serialized);
  } catch (error) {
    console.error("Files list error:", error);
    return Response.json(
      { error: "Erreur lors de la récupération des fichiers" },
      { status: 500 }
    );
  }
}
