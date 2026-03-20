import { prisma } from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/auth";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getOrCreateUser();

    const link = await prisma.shareLink.findUnique({
      where: { id },
      include: { file: { select: { userId: true } } },
    });

    if (!link) {
      return Response.json({ error: "Lien non trouvé" }, { status: 404 });
    }

    if (link.file.userId !== user.id) {
      return Response.json({ error: "Non autorisé" }, { status: 403 });
    }

    await prisma.shareLink.delete({ where: { id } });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Delete share link error:", error);
    return Response.json(
      { error: "Erreur lors de la suppression du lien" },
      { status: 500 }
    );
  }
}
