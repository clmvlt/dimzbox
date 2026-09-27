const SIZE_UNITS = ["o", "Ko", "Mo", "Go", "To"];

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 1) return "0 o";
  const k = 1024;
  const i = Math.min(
    SIZE_UNITS.length - 1,
    Math.floor(Math.log(bytes) / Math.log(k))
  );
  const value = bytes / Math.pow(k, i);
  const digits = value >= 100 || i === 0 ? 0 : value >= 10 ? 1 : 2;
  return `${parseFloat(value.toFixed(digits)).toLocaleString("fr-FR")} ${SIZE_UNITS[i]}`;
}

export function formatSpeed(bytesPerSecond: number): string {
  return `${formatFileSize(bytesPerSecond)}/s`;
}

/** Durée courte : "45 s", "3 min", "1 h 20". */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) return rest ? `${hours} h ${String(rest).padStart(2, "0")}` : `${hours} h`;
  const days = Math.floor(hours / 24);
  return `${days} j ${hours % 24} h`;
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatShortDate(date: Date | string): string {
  const d = new Date(date);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: sameYear ? undefined : "numeric",
  });
}

const rtf = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });

/** "dans 3 jours", "il y a 2 heures"… */
export function formatRelative(date: Date | string, now = Date.now()): string {
  const diff = (new Date(date).getTime() - now) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  if (abs < 86400 * 365) return rtf.format(Math.round(diff / (86400 * 30)), "month");
  return rtf.format(Math.round(diff / (86400 * 365)), "year");
}

const mimeLabels: Record<string, string> = {
  "application/pdf": "PDF",
  "application/zip": "Archive ZIP",
  "application/x-zip-compressed": "Archive ZIP",
  "application/x-rar-compressed": "Archive RAR",
  "application/vnd.rar": "Archive RAR",
  "application/x-7z-compressed": "Archive 7Z",
  "application/x-tar": "Archive TAR",
  "application/gzip": "Archive GZ",
  "application/json": "JSON",
  "application/xml": "XML",
  "text/plain": "Texte",
  "text/html": "HTML",
  "text/css": "CSS",
  "text/csv": "CSV",
};

export function getFileTypeLabel(mimeType: string): string {
  if (mimeLabels[mimeType]) return mimeLabels[mimeType];
  if (mimeType.startsWith("image/")) return `Image ${mimeType.split("/")[1].toUpperCase()}`;
  if (mimeType.startsWith("video/")) return `Vidéo ${mimeType.split("/")[1].toUpperCase()}`;
  if (mimeType.startsWith("audio/")) return `Audio ${mimeType.split("/")[1].toUpperCase()}`;
  if (mimeType.startsWith("font/")) return "Police";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "Tableur";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "Présentation";
  if (mimeType.includes("document") || mimeType.includes("word")) return "Document";
  return "Fichier";
}

export function getFileExtension(filename: string): string {
  if (!filename.includes(".")) return "";
  const ext = filename.split(".").pop();
  return ext ? ext.toUpperCase() : "";
}
