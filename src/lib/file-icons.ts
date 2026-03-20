export interface FileTypeStyle {
  /** Tailwind bg class for the badge background */
  bg: string;
  /** Tailwind text class for the extension label */
  text: string;
  /** Tailwind border class */
  border: string;
  /** Raw hex color for OG image background (with alpha) */
  ogBg: string;
  /** Raw hex color for OG image border */
  ogBorder: string;
  /** Raw hex color for OG image text */
  ogText: string;
  /** Category label */
  label: string;
}

const styles = {
  pdf:          { bg: "bg-red-500/15",     text: "text-red-400",     border: "border-red-500/25",     ogBg: "rgba(239,68,68,0.15)",   ogBorder: "rgba(239,68,68,0.3)",   ogText: "#f87171",  label: "PDF" },
  image:        { bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/25", ogBg: "rgba(16,185,129,0.15)",  ogBorder: "rgba(16,185,129,0.3)",  ogText: "#34d399",  label: "Image" },
  video:        { bg: "bg-violet-500/15",  text: "text-violet-400",  border: "border-violet-500/25",  ogBg: "rgba(139,92,246,0.15)",  ogBorder: "rgba(139,92,246,0.3)",  ogText: "#a78bfa",  label: "Vidéo" },
  audio:        { bg: "bg-pink-500/15",    text: "text-pink-400",    border: "border-pink-500/25",    ogBg: "rgba(236,72,153,0.15)",  ogBorder: "rgba(236,72,153,0.3)",  ogText: "#f472b6",  label: "Audio" },
  archive:      { bg: "bg-amber-500/15",   text: "text-amber-400",   border: "border-amber-500/25",   ogBg: "rgba(245,158,11,0.15)",  ogBorder: "rgba(245,158,11,0.3)",  ogText: "#fbbf24",  label: "Archive" },
  document:     { bg: "bg-blue-500/15",    text: "text-blue-400",    border: "border-blue-500/25",    ogBg: "rgba(59,130,246,0.15)",  ogBorder: "rgba(59,130,246,0.3)",  ogText: "#60a5fa",  label: "Document" },
  spreadsheet:  { bg: "bg-green-500/15",   text: "text-green-400",   border: "border-green-500/25",   ogBg: "rgba(34,197,94,0.15)",   ogBorder: "rgba(34,197,94,0.3)",   ogText: "#4ade80",  label: "Tableur" },
  presentation: { bg: "bg-orange-500/15",  text: "text-orange-400",  border: "border-orange-500/25",  ogBg: "rgba(249,115,22,0.15)",  ogBorder: "rgba(249,115,22,0.3)",  ogText: "#fb923c",  label: "Présentation" },
  code:         { bg: "bg-cyan-500/15",    text: "text-cyan-400",    border: "border-cyan-500/25",    ogBg: "rgba(6,182,212,0.15)",   ogBorder: "rgba(6,182,212,0.3)",   ogText: "#22d3ee",  label: "Code" },
  text:         { bg: "bg-slate-500/15",   text: "text-slate-400",   border: "border-slate-500/25",   ogBg: "rgba(148,163,184,0.15)", ogBorder: "rgba(148,163,184,0.3)", ogText: "#94a3b8",  label: "Texte" },
  font:         { bg: "bg-indigo-500/15",  text: "text-indigo-400",  border: "border-indigo-500/25",  ogBg: "rgba(99,102,241,0.15)",  ogBorder: "rgba(99,102,241,0.3)",  ogText: "#818cf8",  label: "Police" },
  design:       { bg: "bg-fuchsia-500/15", text: "text-fuchsia-400", border: "border-fuchsia-500/25", ogBg: "rgba(217,70,239,0.15)",  ogBorder: "rgba(217,70,239,0.3)",  ogText: "#e879f9",  label: "Design" },
  database:     { bg: "bg-teal-500/15",    text: "text-teal-400",    border: "border-teal-500/25",    ogBg: "rgba(20,184,166,0.15)",  ogBorder: "rgba(20,184,166,0.3)",  ogText: "#2dd4bf",  label: "Base de données" },
  executable:   { bg: "bg-red-600/15",     text: "text-red-500",     border: "border-red-600/25",     ogBg: "rgba(220,38,38,0.15)",   ogBorder: "rgba(220,38,38,0.3)",   ogText: "#ef4444",  label: "Exécutable" },
  default:      { bg: "bg-zinc-500/15",    text: "text-zinc-400",    border: "border-zinc-500/25",    ogBg: "rgba(113,113,122,0.15)", ogBorder: "rgba(113,113,122,0.3)", ogText: "#a1a1aa",  label: "Fichier" },
} as const satisfies Record<string, FileTypeStyle>;

/** Extension → style category */
const extMap: Record<string, keyof typeof styles> = {
  // PDF
  pdf: "pdf",

  // Images
  png: "image", jpg: "image", jpeg: "image", gif: "image", webp: "image",
  svg: "image", bmp: "image", ico: "image", tiff: "image", tif: "image",
  avif: "image", heic: "image", heif: "image", raw: "image",

  // Vidéo
  mp4: "video", avi: "video", mkv: "video", mov: "video", wmv: "video",
  flv: "video", webm: "video", m4v: "video", mpg: "video", mpeg: "video",
  "3gp": "video", mts: "video",

  // Audio
  mp3: "audio", wav: "audio", flac: "audio", ogg: "audio", aac: "audio",
  wma: "audio", m4a: "audio", opus: "audio", aiff: "audio", mid: "audio",
  midi: "audio",

  // Archives
  zip: "archive", rar: "archive", "7z": "archive", tar: "archive",
  gz: "archive", bz2: "archive", xz: "archive", zst: "archive",
  iso: "archive", dmg: "archive",

  // Documents
  doc: "document", docx: "document", odt: "document", rtf: "document",
  pages: "document", epub: "document",

  // Tableurs
  xls: "spreadsheet", xlsx: "spreadsheet", csv: "spreadsheet",
  ods: "spreadsheet", numbers: "spreadsheet", tsv: "spreadsheet",

  // Présentations
  ppt: "presentation", pptx: "presentation", odp: "presentation",
  key: "presentation",

  // Code
  js: "code", jsx: "code", ts: "code", tsx: "code", py: "code",
  java: "code", c: "code", cpp: "code", h: "code", hpp: "code",
  go: "code", rs: "code", rb: "code", php: "code", swift: "code",
  kt: "code", scala: "code", r: "code", lua: "code", dart: "code",
  html: "code", css: "code", scss: "code", less: "code", sass: "code",
  json: "code", xml: "code", yaml: "code", yml: "code", toml: "code",
  sh: "code", bash: "code", zsh: "code", ps1: "code", bat: "code",
  cmd: "code", sql: "code", graphql: "code", proto: "code",
  dockerfile: "code", makefile: "code", cmake: "code",
  vue: "code", svelte: "code", astro: "code",

  // Texte
  txt: "text", md: "text", log: "text", ini: "text", cfg: "text",
  conf: "text", env: "text", nfo: "text",

  // Polices
  ttf: "font", otf: "font", woff: "font", woff2: "font", eot: "font",

  // Design
  psd: "design", ai: "design", sketch: "design", fig: "design",
  xd: "design", blend: "design", fbx: "design", obj: "design",
  stl: "design", step: "design",

  // Base de données
  db: "database", sqlite: "database", mdb: "database", accdb: "database",

  // Exécutables
  exe: "executable", msi: "executable", app: "executable",
  deb: "executable", rpm: "executable", apk: "executable",
  ipa: "executable", appimage: "executable",
};

/** MIME type prefix → fallback category (used when extension is unknown) */
const mimeFallback: Record<string, keyof typeof styles> = {
  "image/": "image",
  "video/": "video",
  "audio/": "audio",
  "text/": "text",
  "font/": "font",
  "application/pdf": "pdf",
  "application/zip": "archive",
  "application/x-rar": "archive",
  "application/x-7z": "archive",
  "application/gzip": "archive",
  "application/x-tar": "archive",
  "application/json": "code",
  "application/xml": "code",
  "application/sql": "database",
  "application/msword": "document",
  "application/vnd.openxmlformats-officedocument.wordprocessingml": "document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml": "spreadsheet",
  "application/vnd.ms-excel": "spreadsheet",
  "application/vnd.openxmlformats-officedocument.presentationml": "presentation",
  "application/vnd.ms-powerpoint": "presentation",
  "application/octet-stream": "default",
};

/**
 * Get style info for a file based on its name and/or MIME type.
 */
export function getFileStyle(fileName: string, mimeType?: string): FileTypeStyle {
  // 1. Try extension
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const category = extMap[ext];
  if (category) return styles[category];

  // 2. Try MIME type
  if (mimeType) {
    for (const [prefix, cat] of Object.entries(mimeFallback)) {
      if (mimeType.startsWith(prefix)) return styles[cat];
    }
  }

  return styles.default;
}
