import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import fs from "node:fs/promises";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: admin, error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  // Interdire la suppression de son propre compte admin
  if (id === admin!.id) {
    return Response.json(
      { error: "Impossible de supprimer votre propre compte" },
      { status: 400 }
    );
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      include: { files: true },
    });

    if (!user) {
      return Response.json({ error: "Utilisateur non trouvé" }, { status: 404 });
    }

    // Supprimer les fichiers du disque
    for (const file of user.files) {
      try {
        await fs.unlink(file.path);
      } catch {
        // Fichier peut déjà avoir été supprimé
      }
    }

    // Supprimer le dossier uploads de l'utilisateur
    try {
      const { config } = await import("@/lib/config");
      const path = await import("node:path");
      const userDir = path.join(config.upload.uploadDir, user.id);
      await fs.rm(userDir, { recursive: true, force: true });
    } catch {
      // Dossier peut ne pas exister
    }

    // Cascade: supprime sessions, files, shareLinks
    await prisma.user.delete({ where: { id } });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Admin delete user error:", error);
    return Response.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
