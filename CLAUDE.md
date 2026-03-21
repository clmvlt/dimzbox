@AGENTS.md

# DimzBox

Site web de partage de fichiers.

## Stack

- Next.js 16 (App Router, TypeScript)
- Tailwind CSS v4
- shadcn/ui (composants dans src/components/ui/)
- Prisma 7 + SQLite (via @prisma/adapter-libsql)
- Zod + React Hook Form (validation/formulaires)
- react-dropzone (upload de fichiers)

## Auth

- Session par cookie httpOnly (dimzbox_session)
- Utilisateurs anonymes créés automatiquement (cookie-based, pas d'IP)
- Inscription simple : identifiant + pseudo + mot de passe (src/lib/auth.ts)
- Login transfère les fichiers de la session anonyme vers le compte
- Inscription "upgrade" l'utilisateur anonyme courant en compte
- Mots de passe hashés avec scrypt (Node.js crypto natif)
- Route unique /api/account (GET: user courant, POST: login/register/logout)

## Config partage

- Max 100 Go par fichier
- Max 500 Go de stockage par user
- Liens de partage avec expiration (7j par défaut, 30j max)
- Voir src/lib/config.ts pour tous les paramètres

## Structure

- src/app/ — pages et API routes
- src/app/d/[token]/ — page publique de téléchargement
- src/components/ — composants métier (dashboard, file-list, etc.)
- src/components/ui/ — composants shadcn/ui
- src/hooks/ — hooks custom (useVersionCheck, etc.)
- src/lib/ — utilitaires (prisma, auth, config, file-icons, clipboard, format)
- prisma/ — schéma et migrations
- uploads/ — fichiers uploadés

## Commandes

- npm run dev — serveur de dev (webpack)
- npm run build — build production
- npm run start — lancer en production
- npm run lint — linter

## Versioning & Deploy

- npm run version:patch — bumper 0.0.1 → 0.0.2
- npm run version:minor — bumper 0.0.x → 0.1.0
- npm run version:major — bumper 0.x.x → 1.0.0
- npm run deploy — build + upload SSH + install sur le serveur
- La version est injectée au build via NEXT_PUBLIC_APP_VERSION
- Le client poll /api/version toutes les 30s et affiche une bannière si mise à jour dispo
- Config deploy dans .env.deploy (gitignored)

## Prisma

- npx prisma migrate dev — appliquer les migrations (dev)
- npx prisma migrate deploy — appliquer les migrations (prod)
- npx prisma studio — interface DB
- npx prisma generate — régénérer le client
