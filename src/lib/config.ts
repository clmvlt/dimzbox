export const config = {
  upload: {
    // Taille max par fichier : 100 Go
    maxFileSize: 100 * 1024 * 1024 * 1024,
    // Stockage max par utilisateur : 500 Go
    maxStoragePerUser: 500 * 1024 * 1024 * 1024,
    // Nombre max de fichiers par utilisateur
    maxFilesPerUser: 1000,
    // Dossier de stockage
    uploadDir: process.env.UPLOAD_DIR || "./uploads",
    // Types MIME autorisés (vide = tout autorisé)
    allowedMimeTypes: [] as string[],
    // Extensions bloquées (vide = tout autorisé)
    blockedExtensions: [] as string[],
  },
  share: {
    // Durée par défaut d'un lien de partage : 7 jours
    defaultExpirationDays: 7,
    // Durée max d'un lien : 30 jours
    maxExpirationDays: 30,
    // Longueur du token de partage
    tokenLength: 12,
  },
  cleanup: {
    // Supprimer les fichiers expirés automatiquement
    deleteExpiredFiles: true,
    // Supprimer les users inactifs après 90 jours
    inactiveUserDays: 90,
  },
} as const;
