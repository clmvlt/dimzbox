# DimzBox

Application web de partage de fichiers, simple et sans inscription. Les utilisateurs sont identifiés automatiquement par leur adresse IP.

## Stack

- **Next.js 16** (App Router, TypeScript)
- **Tailwind CSS v4** + **shadcn/ui**
- **Prisma 7** + **SQLite** (via libsql)
- **Zod** + **React Hook Form** (validation)
- **react-dropzone** (upload)

## Fonctionnalites

- Upload de fichiers (drag & drop ou selection)
- Dashboard avec liste des fichiers et statistiques de stockage
- Liens de partage avec expiration configurable et protection par mot de passe
- Page de telechargement publique avec apercu OpenGraph
- Limite de telechargements par lien
- Detection automatique de mise a jour (polling version)

## Limites par defaut

| Parametre | Valeur |
|---|---|
| Taille max par fichier | 100 Go |
| Stockage max par utilisateur | 500 Go |
| Fichiers max par utilisateur | 1000 |
| Expiration lien par defaut | 7 jours |
| Expiration lien max | 30 jours |

## Installation

```bash
# Installer les dependances
npm install

# Generer le client Prisma
npx prisma generate

# Appliquer les migrations
npx prisma migrate dev

# Lancer le serveur de dev
npm run dev
```

L'application est accessible sur `http://localhost:3000`.

## Variables d'environnement

Creer un fichier `.env` a la racine :

```env
DATABASE_URL="file:./dev.db"
UPLOAD_DIR="./uploads"
```

## Scripts

| Commande | Description |
|---|---|
| `npm run dev` | Serveur de developpement |
| `npm run build` | Build production |
| `npm run start` | Lancer en production |
| `npm run lint` | Linter |
| `npm run version:patch` | Bump version patch |
| `npm run version:minor` | Bump version minor |
| `npm run version:major` | Bump version major |
| `npm run deploy` | Build + deploy SSH |

## Structure du projet

```
src/
  app/
    api/          # Routes API (upload, files, share, download, stats, version)
    d/[token]/    # Page publique de telechargement
  components/
    ui/           # Composants shadcn/ui
    dashboard.tsx, file-list.tsx, file-upload.tsx, share-dialog.tsx ...
  hooks/          # Hooks custom (useVersionCheck)
  lib/            # Utilitaires (prisma, auth, config, format, clipboard, file-icons)
prisma/
  schema.prisma   # Schema de la base de donnees
  migrations/     # Migrations SQL
uploads/          # Fichiers uploades (gitignored)
```
