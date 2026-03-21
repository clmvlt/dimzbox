import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import fs from "node:fs/promises";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  try {
    const file = await prisma.file.findUnique({ where: { id } });

    if (!file) {
      return Response.json({ error: "Fichier non trouvé" }, { status: 404 });
    }

    // Supprimer du disque
    try {
      await fs.unlink(file.path);
    } catch {
      // Fichier peut déjà avoir été supprimé
    }

    // Cascade: supprime les shareLinks
    await prisma.file.delete({ where: { id } });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Admin delete file error:", error);
    return Response.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
