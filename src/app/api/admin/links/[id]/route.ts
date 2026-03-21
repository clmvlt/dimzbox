import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  try {
    const link = await prisma.shareLink.findUnique({ where: { id } });

    if (!link) {
      return Response.json({ error: "Lien non trouvé" }, { status: 404 });
    }

    await prisma.shareLink.delete({ where: { id } });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Admin delete link error:", error);
    return Response.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
