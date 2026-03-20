export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 o";
  const k = 1024;
  const sizes = ["o", "Ko", "Mo", "Go", "To"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
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

const mimeLabels: Record<string, string> = {
  "application/pdf": "PDF",
  "application/zip": "Archive ZIP",
  "application/x-rar-compressed": "Archive RAR",
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
  const ext = filename.split(".").pop();
  return ext ? ext.toUpperCase() : "";
}
