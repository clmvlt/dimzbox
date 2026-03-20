// BUNDLE-01: Constantes client uniquement — évite de leaker la config serveur dans le bundle
export const CLIENT_CONFIG = {
  maxFileSize: 100 * 1024 * 1024 * 1024, // 100 Go
  maxStoragePerUser: 500 * 1024 * 1024 * 1024, // 500 Go
  blockedExtensions: [] as readonly string[],
} as const;
