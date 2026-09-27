import { stat } from "node:fs/promises";
import { prisma } from "@/lib/prisma";
import { createFileStream } from "@/lib/file-stream";
import { isInsideUploadDir } from "@/lib/storage";
import { getLinkStatus } from "@/lib/share";
import { addDownloadGrant, hasDownloadGrant } from "@/lib/download-grants";
import { getClientIp } from "@/lib/security";

type Params = { params: Promise<{ token: string }> };

const jsonError = (error: string, status: number) =>
  Response.json({ error }, { status });

function contentDisposition(name: string) {
  const ascii = name.replace(/[^\x20-\x7e]|["\\]/g, "_");
  const encoded = encodeURIComponent(name).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

/** FILE-03: `bytes=a-b`, `bytes=a-` et `bytes=-n`. Multi-plages ignorées (200). */
function parseRange(header: string | null, size: number) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (match[1] === "" && match[2] === "")) return null;

  if (match[1] === "") {
    const suffix = Number(match[2]);
    if (suffix === 0 || size === 0) return "invalid" as const;
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }

  const start = Number(match[1]);
  const end = match[2] === "" ? size - 1 : Math.min(Number(match[2]), size - 1);
  if (start >= size || start > end) return "invalid" as const;
  return { start, end };
}

async function resolveLink(token: string) {
  const link = await prisma.shareLink.findUnique({
    where: { token },
    include: { file: true },
  });
  if (!link) return { error: jsonError("Lien non trouvé", 404) };

  // HIGH-01: le chemin doit rester sous le dossier d'uploads
  if (!isInsideUploadDir(link.file.path)) {
    return { error: jsonError("Accès interdit", 403) };
  }

  let size: number;
  try {
    size = (await stat(link.file.path)).size;
  } catch {
    return { error: jsonError("Fichier introuvable sur le serveur", 404) };
  }

  return { link, size };
}

function baseHeaders(
  link: { file: { id: string; originalName: string; createdAt: Date } },
  size: number
) {
  return {
    // MED-03: jamais interprété par le navigateur
    "Content-Type": "application/octet-stream",
    "Content-Disposition": contentDisposition(link.file.originalName),
    "Accept-Ranges": "bytes",
    ETag: `"${link.file.id}-${size}"`,
    "Last-Modified": link.file.createdAt.toUTCString(),
    "Cache-Control": "private, no-cache",
    "X-Content-Type-Options": "nosniff",
  };
}

/**
 * Compte un nouveau téléchargement. Pour un lien limité, l'incrément est
 * conditionnel et atomique (LOW-02) : false si le quota est déjà atteint.
 */
async function countDownload(link: { id: string; maxDownloads: number | null }) {
  if (link.maxDownloads === null) {
    await prisma.shareLink.update({
      where: { id: link.id },
      data: { downloadCount: { increment: 1 } },
    });
    return true;
  }
  const updated = await prisma.$executeRaw`
    UPDATE "ShareLink" SET "downloadCount" = "downloadCount" + 1
    WHERE "id" = ${link.id} AND "downloadCount" < "maxDownloads"`;
  return updated > 0;
}

// HEAD — métadonnées seules. Sans cette route, Next exécuterait GET et
// chaque HEAD (aperçus de liens, gestionnaires de DL) compterait un téléchargement.
export async function HEAD(request: Request, { params }: Params) {
  try {
    const { token } = await params;
    const resolved = await resolveLink(token);
    if (resolved.error) return new Response(null, { status: resolved.error.status });
    const { link, size } = resolved;

    const status = getLinkStatus(link);
    const granted = hasDownloadGrant(link.id, getClientIp(request));
    if (status.expired || (status.exhausted && !granted)) {
      return new Response(null, { status: 410 });
    }

    return new Response(null, {
      headers: { ...baseHeaders(link, size), "Content-Length": String(size) },
    });
  } catch (error) {
    console.error("Download HEAD error:", error);
    return new Response(null, { status: 500 });
  }
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { token } = await params;
    const resolved = await resolveLink(token);
    if (resolved.error) return resolved.error;
    const { link, size } = resolved;

    if (getLinkStatus(link).expired) {
      return jsonError("Ce lien a expiré", 410);
    }

    const headers = baseHeaders(link, size);

    let range = parseRange(request.headers.get("range"), size);
    const ifRange = request.headers.get("if-range");
    if (ifRange && ifRange !== headers.ETag && ifRange !== headers["Last-Modified"]) {
      range = null; // le fichier a changé : renvoyer le fichier complet
    }
    if (range === "invalid") {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${size}` },
      });
    }

    // Un client déjà compté récemment (reprise, multi-connexions, re-clic)
    // ne consomme pas de téléchargement supplémentaire.
    const ip = getClientIp(request);
    if (!hasDownloadGrant(link.id, ip)) {
      if (!(await countDownload(link))) {
        return jsonError("Nombre maximum de téléchargements atteint", 410);
      }
      addDownloadGrant(link.id, ip);
    }

    if (range) {
      return new Response(createFileStream(link.file.path, range.start, range.end), {
        status: 206,
        headers: {
          ...headers,
          "Content-Length": String(range.end - range.start + 1),
          "Content-Range": `bytes ${range.start}-${range.end}/${size}`,
        },
      });
    }

    return new Response(createFileStream(link.file.path, 0, size - 1), {
      headers: { ...headers, "Content-Length": String(size) },
    });
  } catch (error) {
    console.error("Download error:", error);
    return jsonError("Erreur lors du téléchargement", 500);
  }
}
