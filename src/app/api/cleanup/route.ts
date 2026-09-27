import { cleanupExpired } from "@/lib/storage";

// LOW-03: Job de nettoyage des fichiers, liens expirés et uploads abandonnés
// Appelable via cron: GET /api/cleanup?secret=...
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  const expectedSecret = process.env.CLEANUP_SECRET;

  if (expectedSecret && secret !== expectedSecret) {
    return Response.json({ error: "Non autorise" }, { status: 403 });
  }

  try {
    return Response.json(await cleanupExpired());
  } catch (error) {
    console.error("Cleanup error:", error);
    return Response.json(
      { error: "Erreur lors du nettoyage" },
      { status: 500 }
    );
  }
}
