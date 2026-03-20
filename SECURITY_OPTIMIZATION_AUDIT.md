# DimzBox — Audit Sécurité & Optimisation

**Date** : 2026-03-20
**Version analysée** : 0.1.3
**Scope** : Analyse complète de tout le code source, dépendances, configuration et architecture

---

## Table des matières

- [PARTIE 1 — SÉCURITÉ](#partie-1--sécurité)
  - [1.1 Vulnérabilités critiques](#11-vulnérabilités-critiques)
  - [1.2 Vulnérabilités hautes](#12-vulnérabilités-hautes)
  - [1.3 Vulnérabilités moyennes](#13-vulnérabilités-moyennes)
  - [1.4 Vulnérabilités basses](#14-vulnérabilités-basses)
  - [1.5 Problèmes architecturaux](#15-problèmes-architecturaux)
  - [1.6 Points positifs](#16-points-positifs)
- [PARTIE 2 — OPTIMISATION](#partie-2--optimisation)
  - [2.1 Base de données](#21-base-de-données)
  - [2.2 Gestion des fichiers](#22-gestion-des-fichiers)
  - [2.3 API & Cache](#23-api--cache)
  - [2.4 Bundle & Client](#24-bundle--client)
  - [2.5 Next.js](#25-nextjs)
  - [2.6 Fuites mémoire & qualité](#26-fuites-mémoire--qualité)
  - [2.7 Fonctionnalités manquantes](#27-fonctionnalités-manquantes)
  - [2.8 Dépendances](#28-dépendances)
  - [2.9 Quick wins](#29-quick-wins)
- [RÉSUMÉ GLOBAL](#résumé-global)

---

# PARTIE 1 — SÉCURITÉ

## 1.1 Vulnérabilités critiques

### CRIT-02 : Champ `password` sur ShareLink non implémenté

| | |
|---|---|
| **Fichier** | `prisma/schema.prisma` ligne 37, `src/app/api/download/[token]/route.ts` |
| **Sévérité** | CRITIQUE (faux sentiment de sécurité) |

**Problème** : Le schéma Prisma définit un champ `password` sur le modèle `ShareLink`, mais aucune vérification de mot de passe n'est effectuée dans la route de téléchargement. Si un développeur set un password via Prisma Studio, il ne sera jamais vérifié.

**Impact** : Liens de partage potentiellement considérés comme protégés par mot de passe alors qu'ils ne le sont pas.

**Recommandation** :
- Implémenter la vérification du mot de passe dans `/api/download/[token]`
- OU supprimer le champ `password` du schéma jusqu'à implémentation réelle

---

## 1.2 Vulnérabilités hautes

### HIGH-01 : Risque de traversée de répertoire via le chemin stocké en DB

| | |
|---|---|
| **Fichier** | `src/app/api/download/[token]/route.ts` lignes 35, 50 |
| **Sévérité** | HAUTE |

**Problème** : Le chemin du fichier est lu directement depuis la base de données et passé à `fs.createReadStream()` sans validation. Si la DB est compromise ou manipulée, un chemin malveillant (`../../../etc/passwd`) pourrait donner accès à n'importe quel fichier du serveur.

```typescript
if (!fs.existsSync(link.file.path)) { ... }
const nodeStream = fs.createReadStream(link.file.path); // ← Path non validé
```

**Recommandation** :
- Valider que le chemin commence par le répertoire d'uploads configuré
- Utiliser `path.resolve()` puis vérifier que le résultat est sous `UPLOAD_DIR`

```typescript
const resolvedPath = path.resolve(link.file.path);
const uploadDir = path.resolve(process.env.UPLOAD_DIR || "./uploads");
if (!resolvedPath.startsWith(uploadDir)) {
  return Response.json({ error: "Accès interdit" }, { status: 403 });
}
```

---

### HIGH-02 : Dépendances vulnérables (Hono / @hono/node-server)

| | |
|---|---|
| **Fichier** | `package.json` (dépendances transitives) |
| **Sévérité** | HAUTE |

**Vulnérabilités détectées** (via `npm audit`) :

| CVE / GHSA | Package | Description |
|---|---|---|
| GHSA-9r54-q6cx-xmh5 | hono | XSS via ErrorBoundary |
| GHSA-6wqw-2p9w-4vw4 | hono | Cache middleware ignore `Cache-Control: private` |
| GHSA-q5qw-h33p-qvwr | hono | Accès fichier arbitraire via serveStatic |
| GHSA-w332-q679-j88p | hono | Lecture clé arbitraire sur Cloudflare Workers |
| GHSA-wc8c-qw6v-h7f6 | @hono/node-server | Bypass d'autorisation via chemins encodés |

**Recommandation** : `npm audit fix` ou mettre à jour les dépendances transitives.

---

### HIGH-03 : Aucun rate limiting

| | |
|---|---|
| **Fichier** | Toutes les routes API dans `src/app/api/` |
| **Sévérité** | HAUTE |

**Problème** : Aucune limitation de débit n'est implémentée sur aucun endpoint :

| Endpoint | Risque |
|---|---|
| `POST /api/upload` | Spam de fichiers volumineux, épuisement stockage |
| `GET /api/download/[token]` | Brute-force de tokens (12 chars nanoid) |
| `POST /api/files/[id]/share` | Création massive de liens |
| `DELETE /api/files/[id]` | Suppression en masse |

**Recommandation** :
- Implémenter un rate limiter dans un middleware Next.js
- Limites suggérées : 10 uploads/min, 100 downloads/min, 50 requêtes API/min par IP

---

## 1.3 Vulnérabilités moyennes

### MED-01 : Pas de protection CSRF

| | |
|---|---|
| **Fichier** | Toutes les routes POST/DELETE |
| **Sévérité** | MOYENNE |

**Problème** : Aucun token CSRF n'est validé sur les endpoints de mutation. Un site malveillant pourrait déclencher des actions (suppression de fichiers, création de liens) via les requêtes cross-origin du navigateur de la victime.

**Recommandation** : Valider l'en-tête `Origin` ou `Referer` dans les routes de mutation, ou implémenter des tokens CSRF.

---

### MED-02 : Validation d'entrée insuffisante sur les paramètres de partage

| | |
|---|---|
| **Fichier** | `src/app/api/files/[id]/share/route.ts` lignes 55-62 |
| **Sévérité** | MOYENNE |

**Problème** : Pas de validation de schéma avec Zod (pourtant disponible dans le projet). Le body est parsé avec un simple `catch(() => ({}))`. Des valeurs inattendues (NaN, objets imbriqués) pourraient passer.

```typescript
const body = await request.json().catch(() => ({}));
const expirationDays = Math.min(Math.max(body.expirationDays ?? 7, 1), 30);
```

**Recommandation** : Utiliser Zod pour valider le body de requête :

```typescript
const ShareSchema = z.object({
  expirationDays: z.number().int().min(1).max(30).default(7),
  maxDownloads: z.number().int().min(1).optional(),
});
```

---

### MED-03 : Risque de sniffing de Content-Type

| | |
|---|---|
| **Fichier** | `src/app/api/download/[token]/route.ts` ligne 58 |
| **Sévérité** | MOYENNE |

**Problème** : Le `Content-Type` de la réponse de téléchargement utilise directement le MIME type fourni par le client lors de l'upload. Aucun header `X-Content-Type-Options: nosniff` n'est envoyé.

```typescript
"Content-Type": link.file.mimeType, // ← Contrôlé par le client à l'upload
```

**Impact** : Un attaquant pourrait uploader un fichier `.html` avec du JavaScript malveillant et le faire exécuter dans le contexte du domaine.

**Recommandation** :
- Forcer `Content-Type: application/octet-stream` pour tous les téléchargements
- Ajouter `X-Content-Type-Options: nosniff`
- Ajouter `Content-Disposition: attachment` (déjà fait, mais renforcer avec le Content-Type)

---

### MED-04 : Pas de headers de sécurité

| | |
|---|---|
| **Fichier** | Aucun middleware de sécurité |
| **Sévérité** | MOYENNE |

**Headers manquants** :

| Header | Valeur recommandée |
|---|---|
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |
| `Content-Security-Policy` | Politique adaptée |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` (si HTTPS) |

**Recommandation** : Ajouter un middleware Next.js ou configurer ces headers dans `next.config.ts`.

---

## 1.4 Vulnérabilités basses

### LOW-01 : Credentials en clair dans `.env.deploy`

| | |
|---|---|
| **Fichier** | `.env.deploy` |
| **Sévérité** | BASSE (fichier gitignored) |

**Problème** : Le mot de passe SSH est stocké en clair. Si le fichier fuite, l'accès au serveur de déploiement est compromis.

**Recommandation** : Utiliser des clés SSH au lieu d'un mot de passe, ou un gestionnaire de secrets.

---

### LOW-02 : Race condition sur le compteur de téléchargements

| | |
|---|---|
| **Fichier** | `src/app/api/download/[token]/route.ts` lignes 30-46 |
| **Sévérité** | BASSE |

**Problème** : Pattern check-then-act entre la vérification de `maxDownloads` et l'incrémentation de `downloadCount`. Deux requêtes concurrentes pourraient dépasser la limite.

**Recommandation** : Utiliser une transaction Prisma avec `UPDATE ... WHERE downloadCount < maxDownloads`.

---

### LOW-03 : Pas de job de nettoyage des fichiers expirés

| | |
|---|---|
| **Fichier** | `src/lib/config.ts` lignes 24-28 |
| **Sévérité** | BASSE |

**Problème** : `config.cleanup.deleteExpiredFiles` est `true` mais aucun job de nettoyage n'existe. Les fichiers et liens expirés s'accumulent indéfiniment.

**Impact** : Consommation disque croissante, données obsolètes en base.

---

### LOW-04 : Chemin de base de données relatif

| | |
|---|---|
| **Fichier** | `src/lib/prisma.ts` ligne 9 |
| **Sévérité** | BASSE |

**Problème** : `path.resolve(process.cwd(), "prisma/dev.db")` suppose que `cwd()` est la racine du projet. En production avec pm2, le `cwd` pourrait être différent.

---

## 1.5 Problèmes architecturaux

| Problème | Description |
|---|---|
| **Modèle d'authentification faible** | L'identification par IP est fondamentalement inadaptée pour une application multi-utilisateurs. Pas de session, pas de cookie, pas de token. |
| **Pas de logging d'audit** | Aucune trace de qui a accédé/téléchargé quels fichiers, qui a créé/supprimé des liens. |
| **Pas de chiffrement des fichiers** | Les fichiers sont stockés en clair sur le disque. Les tokens sont visibles dans les URLs. |

---

## 1.6 Points positifs

- Utilisation de Prisma ORM (protection contre l'injection SQL)
- Nommage des fichiers par UUID à l'upload (pas d'input utilisateur dans les noms de fichiers)
- Vérification de propriété (ownership check) avant chaque opération
- Validation d'expiration sur les liens de partage
- Vérification des limites de téléchargement
- Variables d'environnement pour la configuration
- Cascade delete correctement configuré dans le schéma

---

# PARTIE 2 — OPTIMISATION

## 2.1 Base de données

### DB-01 : Index manquants (HAUTE priorité)

| | |
|---|---|
| **Fichier** | `prisma/schema.prisma` |
| **Impact** | Full table scans sur les requêtes fréquentes |

**Index existants** : `User.ipAddress` (unique), `ShareLink.token` (unique)

**Index manquants** :

| Table.Colonne | Requêtes impactées |
|---|---|
| `File.userId` | `/api/files` (liste des fichiers), `/api/upload` (vérification quota), `/api/stats` |
| `ShareLink.fileId` | `/api/files/[id]/share` (liste des liens), cascade deletes |
| `ShareLink.expiresAt` | Futur job de nettoyage, `/api/stats` (liens actifs) |

**Correction** : Ajouter dans le schéma Prisma :
```prisma
model File {
  // ...
  @@index([userId])
}

model ShareLink {
  // ...
  @@index([fileId])
  @@index([expiresAt])
}
```

---

### DB-02 : Requêtes N+1 et agrégation inefficace

| | |
|---|---|
| **Fichier** | `src/app/api/stats/route.ts` lignes 15-18 |
| **Impact** | Charge DB proportionnelle au nombre de liens |

**Problème** : La route `/api/stats` charge TOUS les shareLinks de l'utilisateur pour compter les liens actifs avec un filtre JavaScript côté serveur.

**Recommandation** : Utiliser un `count` Prisma avec filtre WHERE au lieu de charger tous les enregistrements.

---

### DB-03 : Pas de mode WAL pour SQLite

| | |
|---|---|
| **Fichier** | `src/lib/prisma.ts` |
| **Impact** | Performances de concurrence dégradées |

**Recommandation** : Activer le mode WAL (Write-Ahead Logging) pour améliorer les performances en lecture concurrente.

---

## 2.2 Gestion des fichiers

### FILE-01 : Opérations bloquantes sur le thread principal (HAUTE priorité)

| Fichier | Ligne | Opération | Correction |
|---|---|---|---|
| `src/app/api/files/[id]/route.ts` | 27 | `fs.unlinkSync()` | Remplacer par `fs.promises.unlink()` |
| `src/app/api/download/[token]/route.ts` | 49 | `fs.statSync()` | Utiliser `link.file.size` depuis la DB |

**Impact** : Ces appels synchrones bloquent l'event loop Node.js et empêchent le serveur de traiter d'autres requêtes pendant l'opération I/O.

---

### FILE-02 : Vérification de quota O(n) à chaque upload

| | |
|---|---|
| **Fichier** | `src/app/api/upload/route.ts` lignes 40-43 |
| **Impact** | Lenteur croissante avec le nombre de fichiers |

**Problème** : Chaque upload déclenche un `aggregate()` qui somme la taille de TOUS les fichiers de l'utilisateur.

**Recommandation** : Stocker `totalStorageUsed` sur le modèle `User` et l'incrémenter/décrémenter lors des uploads/suppressions.

---

### FILE-03 : Pas de support des Range requests

| | |
|---|---|
| **Fichier** | `src/app/api/download/[token]/route.ts` |
| **Impact** | Pas de reprise de téléchargement possible |

**Problème** : Les téléchargements ne supportent pas le header `Range` HTTP. Si un téléchargement de 10 Go est interrompu à 95%, l'utilisateur doit tout recommencer.

**Recommandation** : Implémenter le support `Accept-Ranges: bytes` avec parsing du header `Range`.

---

### FILE-04 : Pas de chunked upload pour les gros fichiers

| | |
|---|---|
| **Fichier** | `src/app/api/upload/route.ts` |
| **Impact** | Uploads de fichiers > quelques Go instables |

La limite configurée est de 100 Go, mais l'upload se fait en une seule requête HTTP. Cela crée des risques de timeout, de corruption, et d'impossibilité de reprise.

**Recommandation** : Implémenter un protocole d'upload par chunks (tus.io ou similaire).

---

## 2.3 API & Cache

### CACHE-01 : Polling excessif de la version

| | |
|---|---|
| **Fichier** | `src/hooks/use-version-check.ts` ligne 6, `src/app/api/version/route.ts` |
| **Impact** | ~2 880 requêtes/jour par utilisateur connecté |

**Problème** : Le client poll `/api/version` toutes les 30 secondes avec `cache: "no-store"`, et la route est `force-dynamic`. La version ne change que lors d'un déploiement.

**Recommandation** :
- Augmenter l'intervalle à 5 minutes (réduit à ~288 requêtes/jour)
- Utiliser `Cache-Control: max-age=60` côté serveur
- Retirer `cache: "no-store"` côté client

---

### CACHE-02 : Pas de cache sur `/api/stats`

| | |
|---|---|
| **Fichier** | `src/app/api/stats/route.ts` |
| **Impact** | Requêtes DB à chaque rechargement du dashboard |

**Recommandation** : Ajouter un `Cache-Control: max-age=5` ou un `stale-while-revalidate`.

---

## 2.4 Bundle & Client

### BUNDLE-01 : Config serveur importée côté client

| | |
|---|---|
| **Fichier** | `src/components/file-upload.tsx` ligne 6 |
| **Impact** | Fuite de constantes serveur dans le bundle client |

**Problème** : Le composant `FileUpload` importe l'objet `config` complet depuis `src/lib/config.ts`, incluant les paramètres de cleanup, les durées d'expiration, etc.

**Recommandation** : Extraire uniquement les constantes nécessaires côté client (`maxFileSize`, `maxStoragePerUser`) dans un fichier séparé.

---

### BUNDLE-02 : Dépendance `date-fns` surdimensionnée

| | |
|---|---|
| **Fichier** | `src/lib/format.ts` |
| **Impact** | ~60 Ko ajoutés au bundle |

**Problème** : `date-fns` est importé uniquement pour `format()` dans `formatDate()`. L'API native `Intl.DateTimeFormat` fait le même travail sans dépendance.

```typescript
// Remplacement possible
export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(date));
}
```

---

### BUNDLE-03 : Dépendances inutilisées

| Package | Taille estimée | Statut |
|---|---|---|
| `uuid` | ~10 Ko | Remplacé par `nanoid`, jamais importé |
| `@base-ui/react` | ~50 Ko | Jamais importé dans le code source |

---

## 2.5 Next.js

### NEXT-01 : Page d'accueil non optimisée (Server Components)

| | |
|---|---|
| **Fichier** | `src/app/page.tsx` |

**Problème** : La page renvoie directement `<Dashboard />` qui est entièrement `"use client"`. Aucun avantage des Server Components n'est exploité pour le layout principal.

---

### NEXT-02 : Double requête Prisma sur la page de téléchargement

| | |
|---|---|
| **Fichier** | `src/app/d/[token]/page.tsx` lignes 23 et 63 |

**Problème** : `prisma.shareLink.findUnique()` est appelé deux fois : une fois pour `generateMetadata()` et une fois pour le rendu de la page, avec les mêmes paramètres.

**Recommandation** : Utiliser le cache React (`cache()`) pour dédupliquer :

```typescript
import { cache } from "react";

const getShareLink = cache((token: string) =>
  prisma.shareLink.findUnique({ where: { token }, include: { file: true } })
);
```

---

### NEXT-03 : Polices Geist chargées en totalité

| | |
|---|---|
| **Fichier** | `src/app/layout.tsx` lignes 6-16 |

**Problème** : Les polices Geist Sans et Geist Mono sont importées sans restriction de subset. Seul le subset `latin` serait nécessaire.

---

## 2.6 Fuites mémoire & qualité

### MEM-01 : XHR non annulé au démontage du composant

| | |
|---|---|
| **Fichier** | `src/components/file-upload.tsx` lignes 57-87 |

**Problème** : Si le composant `FileUpload` est démonté pendant un upload en cours, le `XMLHttpRequest` continue de s'exécuter en arrière-plan avec des handlers qui tentent de mettre à jour un état React démonté.

**Recommandation** : Stocker la référence XHR dans un `useRef` et appeler `xhr.abort()` dans le cleanup du `useEffect` ou du handler.

---

### MEM-02 : Pas de memoization sur les calculs de stats

| | |
|---|---|
| **Fichier** | `src/components/dashboard-stats.tsx` lignes 27-29 |

**Problème** : `storagePercent` est recalculé à chaque render sans `useMemo`.

---

## 2.7 Fonctionnalités manquantes (performance)

| Fonctionnalité | Impact | Priorité |
|---|---|---|
| **Job de nettoyage des fichiers/liens expirés** | Disque et DB qui grossissent indéfiniment | Haute |
| **Support Range requests (reprise de téléchargement)** | UX dégradée sur gros fichiers | Haute |
| **Upload par chunks / resumable** | Uploads > quelques Go instables | Moyenne |
| **Compression des réponses API** | Bande passante gaspillée | Moyenne |
| **Pagination de la liste de fichiers** | Performance dégradée avec > 100 fichiers | Moyenne |

---

## 2.8 Dépendances

| Action | Package | Gain estimé |
|---|---|---|
| Supprimer | `uuid` | ~10 Ko |
| Supprimer | `@base-ui/react` | ~50 Ko |
| Remplacer par `Intl` | `date-fns` | ~60 Ko |
| **Total** | | **~120 Ko** de bundle en moins |

---

## 2.9 Quick wins (faciles à implémenter)

| # | Action | Fichier | Effort |
|---|---|---|---|
| 1 | Supprimer `uuid` et `@base-ui/react` de package.json | `package.json` | 5 min |
| 2 | Remplacer `fs.unlinkSync` par `await fs.promises.unlink` | `src/app/api/files/[id]/route.ts` | 5 min |
| 3 | Remplacer `fs.statSync` par la taille en DB | `src/app/api/download/[token]/route.ts` | 5 min |
| 4 | Ajouter `@@index([userId])` sur File | `prisma/schema.prisma` | 10 min |
| 5 | Ajouter `@@index([fileId])` sur ShareLink | `prisma/schema.prisma` | 10 min |
| 6 | Augmenter le polling version à 5 min | `src/hooks/use-version-check.ts` | 5 min |
| 7 | Ajouter `X-Content-Type-Options: nosniff` aux downloads | `src/app/api/download/[token]/route.ts` | 5 min |
| 8 | Forcer `application/octet-stream` en Content-Type | `src/app/api/download/[token]/route.ts` | 5 min |
| 9 | Dédupliquer la requête Prisma avec `cache()` | `src/app/d/[token]/page.tsx` | 10 min |
| 10 | Remplacer `date-fns` par `Intl.DateTimeFormat` | `src/lib/format.ts` | 15 min |

---

# RÉSUMÉ GLOBAL

## Sécurité

| Sévérité | Nombre | Exemples clés |
|---|---|---|
| **CRITIQUE** | 2 | IP spoofing, champ password non vérifié |
| **HAUTE** | 3 | Traversée de répertoire, dépendances vulnérables, pas de rate limiting |
| **MOYENNE** | 4 | Pas de CSRF, validation faible, Content-Type sniffing, pas de headers sécu |
| **BASSE** | 4 | Credentials en clair, race condition, pas de cleanup, chemin relatif |

## Optimisation

| Catégorie | Nombre d'issues | Priorité max |
|---|---|---|
| **Base de données** | 3 | Haute (index manquants) |
| **Gestion fichiers** | 4 | Haute (opérations bloquantes) |
| **API & Cache** | 2 | Moyenne |
| **Bundle & Client** | 3 | Moyenne |
| **Next.js** | 3 | Basse |
| **Fuites mémoire** | 2 | Basse |
| **Fonctionnalités perf** | 5 | Haute (cleanup, Range requests) |

## Actions prioritaires recommandées

1. **Sécuriser l'authentification IP** — Ajouter validation du proxy de confiance + envisager sessions
2. **Ajouter les index DB manquants** — Gain de performance immédiat
3. **Mettre à jour les dépendances vulnérables** — `npm audit fix`
4. **Remplacer les opérations fs synchrones** — `unlinkSync`, `statSync`
5. **Implémenter le rate limiting** — Middleware sur toutes les routes API
6. **Ajouter les headers de sécurité** — Middleware Next.js
7. **Implémenter le job de nettoyage** — Fichiers et liens expirés
8. **Forcer `application/octet-stream`** — Empêcher l'exécution de contenu uploadé
