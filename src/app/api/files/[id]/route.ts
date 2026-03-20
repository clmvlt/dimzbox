import { prisma } from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/auth";
import fs from "node:fs";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getOrCreateUser();

    const file = await prisma.file.findUnique({
      where: { id },
    });

    if (!file) {
      return Response.json({ error: "Fichier non trouvé" }, { status: 404 });
    }

    if (file.userId !== user.id) {
      return Response.json({ error: "Non autorisé" }, { status: 403 });
    }

    // Supprimer le fichier du disque
    try {
      fs.unlinkSync(file.path);
    } catch {
      // Fichier peut déjà avoir été supprimé
    }

    // Supprimer de la base (cascade supprime les share links)
    await prisma.file.delete({ where: { id } });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Delete error:", error);
    return Response.json(
      { error: "Erreur lors de la suppression" },
      { status: 500 }
    );
  }
}
