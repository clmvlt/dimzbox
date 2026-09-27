// Logique d'état d'un lien de partage — utilisable côté client et serveur.

export interface LinkLimits {
  expiresAt: Date | string | null;
  maxDownloads: number | null;
  downloadCount: number;
}

export function getLinkStatus(link: LinkLimits, now = new Date()) {
  const expired = !!link.expiresAt && new Date(link.expiresAt) < now;
  const unlimited = link.maxDownloads === null;
  const exhausted = !unlimited && link.downloadCount >= link.maxDownloads!;
  return {
    expired,
    exhausted,
    unlimited,
    active: !expired && !exhausted,
    remaining: unlimited
      ? null
      : Math.max(0, link.maxDownloads! - link.downloadCount),
  };
}

export function shareUrl(origin: string, token: string) {
  return `${origin}/d/${token}`;
}
