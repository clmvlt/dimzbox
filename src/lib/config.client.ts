// BUNDLE-01: Constantes client uniquement — évite de leaker la config serveur dans le bundle
export const CLIENT_CONFIG = {
  maxFileSize: 100 * 1024 * 1024 * 1024, // 100 Go
  maxStoragePerUser: 500 * 1024 * 1024 * 1024, // 500 Go
  blockedExtensions: [] as readonly string[],
  // Nombre de fichiers envoyés en même temps
  parallelUploads: 3,
  // Taille initiale d'un morceau (réduite automatiquement si le serveur refuse)
  chunkSize: 8 * 1024 * 1024,
  minChunkSize: 1024 * 1024,
  maxExpirationDays: 30,
  defaultExpirationDays: 7,
} as const;
