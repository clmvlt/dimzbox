import { config } from "./config";

// Un "grant" mémorise qu'un client (IP) a déjà été compté pour un lien.
// Les reprises (Range), les connexions multiples d'un gestionnaire de
// téléchargement ou un simple re-clic ne consomment donc pas de quota.
// En mémoire : un redémarrage serveur fait au pire compter une reprise de plus.

const GRANT_MS = config.share.downloadGrantHours * 60 * 60 * 1000;

const store = globalThis as unknown as {
  __dimzboxDownloadGrants?: Map<string, number>;
};
const grants = (store.__dimzboxDownloadGrants ??= new Map());

function key(linkId: string, ip: string) {
  return `${linkId}:${ip}`;
}

export function hasDownloadGrant(linkId: string, ip: string): boolean {
  const expiresAt = grants.get(key(linkId, ip));
  if (!expiresAt) return false;
  if (Date.now() > expiresAt) {
    grants.delete(key(linkId, ip));
    return false;
  }
  return true;
}

export function addDownloadGrant(linkId: string, ip: string) {
  const now = Date.now();
  if (grants.size > 10_000) {
    for (const [k, exp] of grants) if (now > exp) grants.delete(k);
  }
  grants.set(key(linkId, ip), now + GRANT_MS);
}
