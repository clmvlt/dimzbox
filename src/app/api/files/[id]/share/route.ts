import { prisma } from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { nanoid } from "nanoid";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getOrCreateUser();

    const file = await prisma.file.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!file || file.userId !== user.id) {
      return Response.json({ error: "Non autorisé" }, { status: 403 });
    }

    const links = await prisma.shareLink.findMany({
      where: { fileId: id },
      orderBy: { createdAt: "desc" },
    });

    return Response.json(links);
  } catch (error) {
    console.error("Share links list error:", error);
    return Response.json(
      { error: "Erreur lors de la récupération des liens" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getOrCreateUser();

    const file = await prisma.file.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!file || file.userId !== user.id) {
      return Response.json({ error: "Non autorisé" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const expirationDays = Math.min(
      Math.max(body.expirationDays ?? config.share.defaultExpirationDays, 1),
      config.share.maxExpirationDays
    );
    const maxDownloads = body.maxDownloads
      ? Math.max(1, Number(body.maxDownloads))
      : null;

    const token = nanoid(config.share.tokenLength);
    const expiresAt = new Date(
      Date.now() + expirationDays * 24 * 60 * 60 * 1000
    );

    const link = await prisma.shareLink.create({
      data: {
        token,
        fileId: id,
        maxDownloads,
        expiresAt,
      },
    });

    return Response.json(link);
  } catch (error) {
    console.error("Share link creation error:", error);
    return Response.json(
      { error: "Erreur lors de la création du lien" },
      { status: 500 }
    );
  }
}
