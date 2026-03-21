import { getSessionUser } from "./auth";

const ADMIN_USERNAME = "dimz";

/**
 * Vérifie que l'utilisateur courant est admin (username === "dimz").
 * Retourne l'utilisateur si admin, null sinon.
 */
export async function getAdminUser() {
  const user = await getSessionUser();
  if (!user || user.username !== ADMIN_USERNAME) return null;
  return user;
}

/**
 * Retourne une 403 JSON si l'utilisateur n'est pas admin.
 * Utilisé dans les routes API admin.
 */
export async function requireAdmin() {
  const user = await getAdminUser();
  if (!user) {
    return { user: null, error: Response.json({ error: "Accès refusé" }, { status: 403 }) };
  }
  return { user, error: null };
}
