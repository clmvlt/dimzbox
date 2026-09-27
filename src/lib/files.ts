import path from "node:path";

export function serializeFile(file: {
  id: string;
  originalName: string;
  size: bigint;
  mimeType: string;
  createdAt: Date;
}) {
  return {
    id: file.id,
    name: file.originalName,
    size: Number(file.size),
    mimeType: file.mimeType,
    createdAt: file.createdAt,
  };
}

/** Nom affiché : pas de séparateurs de chemin ni de caractères de contrôle. */
export function sanitizeFileName(name: string) {
  const clean = name
    .replace(/[\\/]/g, "_")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();
  return clean.slice(0, 255) || "fichier";
}

/** Extension pour le nom sur disque : courte et sans caractères exotiques. */
export function safeExtension(name: string) {
  const ext = path.extname(name).toLowerCase();
  return /^\.[a-z0-9]{1,16}$/.test(ext) ? ext : "";
}

export function normalizeMimeType(type: string | undefined) {
  return type && /^[\w.+-]+\/[\w.+-]+$/.test(type)
    ? type
    : "application/octet-stream";
}
