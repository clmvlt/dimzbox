import { prisma } from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { nanoid } from "nanoid";
import { z } from "zod/v4";

// MED-02: Validation Zod pour le body de création de lien
const ShareSchema = z.object({
  expirationDays: z.number().int().min(1).max(30).default(7),
  maxDownloads: z.number().int().min(1).optional(),
});

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
    const parsed = ShareSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Paramètres invalides", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { expirationDays, maxDownloads } = parsed.data;

    const token = nanoid(config.share.tokenLength);
    const expiresAt = new Date(
      Date.now() + expirationDays * 24 * 60 * 60 * 1000
    );

    const link = await prisma.shareLink.create({
      data: {
        token,
        fileId: id,
        maxDownloads: maxDownloads ?? null,
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
