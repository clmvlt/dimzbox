import { copyToClipboard } from "./clipboard";
import { CLIENT_CONFIG } from "./config.client";
import { getLinkStatus, shareUrl } from "./share";

export interface ShareLinkItem {
  id: string;
  token: string;
  downloadCount: number;
  maxDownloads: number | null;
  expiresAt: string | null;
  createdAt: string;
}

export async function createShareLink(
  fileId: string,
  options: { expirationDays: number; maxDownloads: number | null }
): Promise<ShareLinkItem> {
  const res = await fetch(`/api/files/${fileId}/share`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || "Impossible de créer le lien");
  return data;
}

/**
 * Copie un lien de partage actif du fichier, ou en crée un avec les
 * réglages par défaut (7 jours, téléchargements illimités).
 */
export async function copyQuickLink(fileId: string, existing: ShareLinkItem[]) {
  let link = [...existing]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .find((l) => getLinkStatus(l).active);
  const created = !link;

  link ??= await createShareLink(fileId, {
    expirationDays: CLIENT_CONFIG.defaultExpirationDays,
    maxDownloads: null,
  });

  const copied = await copyToClipboard(shareUrl(window.location.origin, link.token));
  return { link, created, copied };
}
