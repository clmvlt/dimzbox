# DimzBox

Application web de partage de fichiers, simple et sans inscription obligatoire. Chaque navigateur reçoit automatiquement une session anonyme ; créer un compte permet de retrouver ses fichiers partout.

## Stack

- **Next.js 16** (App Router, TypeScript)
- **Tailwind CSS v4** + **shadcn/ui**
- **Prisma 7** + **SQLite** (via libsql)
- **Zod** (validation)
- **react-dropzone** (dépôt de fichiers)

## Fonctionnalités

- Dépôt de fichiers n'importe où sur la page (ou sélection classique)
- **Envois en parallèle** (3 fichiers à la fois) avec progression, débit et temps restant
- **Upload résumable par morceaux** : coupure réseau, redémarrage du serveur ou
  déploiement → l'envoi attend puis reprend exactement où il s'était arrêté.
  Après un rechargement de page, redéposer le même fichier reprend l'envoi.
- Liens de partage : expiration (1 à 30 jours) et nombre de téléchargements
  (illimité ou limité), copie du lien en un clic
- Téléchargements comptés une seule fois par client : les reprises (Range),
  les gestionnaires multi-connexions et les requêtes HEAD ne consomment pas le quota
- Page de téléchargement publique avec aperçu OpenGraph
- Panel d'administration
- Détection automatique de mise à jour (polling version)

## Limites par défaut

| Paramètre | Valeur |
|---|---|
| Taille max par fichier | 100 Go |
| Stockage max par utilisateur | 500 Go |
| Fichiers max par utilisateur | 1000 |
| Expiration lien par défaut | 7 jours |
| Expiration lien max | 30 jours |
| Uploads inachevés conservés | 48 h sans activité |

## Installation

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

L'application est accessible sur `http://localhost:3000`.

## Variables d'environnement

Créer un fichier `.env` à la racine :

```env
DATABASE_URL="file:./dev.db"
UPLOAD_DIR="./uploads"
```

## Scripts

| Commande | Description |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build production |
| `npm run start` | Lancer en production |
| `npm run lint` | Linter |
| `npm run version:patch` | Bump version patch |
| `npm run version:minor` | Bump version minor |
| `npm run version:major` | Bump version major |
| `npm run deploy` | Build + déploiement SSH |

## Structure du projet

```
src/
  app/
    api/upload/   # Upload résumable (POST init, PUT morceau, GET statut)
    api/          # Autres routes (files, share, download, stats, account, admin)
    d/[token]/    # Page publique de téléchargement
  components/
    ui/           # Composants shadcn/ui
    dashboard.tsx, upload-dropzone.tsx, upload-queue-panel.tsx, file-list.tsx, share-dialog.tsx ...
  hooks/          # useUploadQueue, useVersionCheck
  lib/            # upload-queue (client), storage, security, share, prisma, auth, config…
prisma/
  schema.prisma   # Schéma de la base de données
  migrations/     # Migrations SQL
uploads/          # Fichiers uploadés (gitignored)
```
