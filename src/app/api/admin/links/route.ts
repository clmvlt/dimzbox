import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const links = await prisma.shareLink.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        file: {
          select: {
            id: true,
            originalName: true,
            user: { select: { username: true, pseudo: true, isAnonymous: true } },
          },
        },
      },
    });

    const result = links.map((l) => ({
      id: l.id,
      token: l.token,
      fileId: l.fileId,
      fileName: l.file.originalName,
      userName: l.file.user.pseudo || l.file.user.username || (l.file.user.isAnonymous ? "Anonyme" : "—"),
      downloadCount: l.downloadCount,
      maxDownloads: l.maxDownloads,
      expiresAt: l.expiresAt,
      createdAt: l.createdAt,
      expired: l.expiresAt ? l.expiresAt < new Date() : false,
      maxedOut: l.maxDownloads !== null ? l.downloadCount >= l.maxDownloads : false,
    }));

    return Response.json(result);
  } catch (error) {
    console.error("Admin links error:", error);
    return Response.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
