"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  BoxIcon,
  UsersIcon,
  FileIcon,
  LinkIcon,
  HardDriveIcon,
  DownloadIcon,
  TrashIcon,
  Loader2Icon,
  AlertTriangleIcon,
  RefreshCwIcon,
  ShieldIcon,
  ArrowLeftIcon,
  WrenchIcon,
  UserIcon,
  DatabaseIcon,
} from "lucide-react";
import { formatFileSize, formatDate } from "@/lib/format";
import { FileIcon as FileTypeIcon } from "@/components/file-icon";
import { toast } from "sonner";

// --- Types ---

interface AdminStats {
  totalUsers: number;
  registeredUsers: number;
  anonymousUsers: number;
  totalFiles: number;
  totalStorage: number;
  totalLinks: number;
  activeLinks: number;
  expiredLinks: number;
  totalDownloads: number;
  totalSessions: number;
}

interface AdminUser {
  id: string;
  username: string | null;
  pseudo: string | null;
  isAnonymous: boolean;
  createdAt: string;
  lastSeenAt: string;
  fileCount: number;
  sessionCount: number;
  storageUsed: number;
}

interface AdminFile {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  createdAt: string;
  userId: string;
  userName: string;
  linkCount: number;
  totalDownloads: number;
}

interface AdminLink {
  id: string;
  token: string;
  fileId: string;
  fileName: string;
  userName: string;
  downloadCount: number;
  maxDownloads: number | null;
  expiresAt: string | null;
  createdAt: string;
  expired: boolean;
  maxedOut: boolean;
}

// --- Main Component ---

export function AdminPanel() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [files, setFiles] = useState<AdminFile[]>([]);
  const [links, setLinks] = useState<AdminLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/stats");
      if (res.ok) setStats(await res.json());
    } catch {
      toast.error("Erreur chargement stats");
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) setUsers(await res.json());
    } catch {
      toast.error("Erreur chargement utilisateurs");
    }
  }, []);

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/files");
      if (res.ok) setFiles(await res.json());
    } catch {
      toast.error("Erreur chargement fichiers");
    }
  }, []);

  const fetchLinks = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/links");
      if (res.ok) setLinks(await res.json());
    } catch {
      toast.error("Erreur chargement liens");
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchStats(), fetchUsers(), fetchFiles(), fetchLinks()]);
    setLoading(false);
  }, [fetchStats, fetchUsers, fetchFiles, fetchLinks]);

  // Chargement initial sans useEffect (évite le warning setState-in-effect)
  useState(() => {
    if (typeof window !== "undefined") {
      fetchAll();
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center gap-2 sm:gap-3">
          <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeftIcon className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2">
            <ShieldIcon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            <h1 className="text-lg sm:text-xl font-bold tracking-tight">Admin</h1>
          </div>
          <span className="hidden sm:inline text-xs text-muted-foreground">DimzBox</span>
          <div className="ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchAll}
              disabled={loading}
            >
              <RefreshCwIcon className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Actualiser</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full mb-4 sm:mb-6">
            <TabsTrigger value="overview">
              <BoxIcon className="h-3.5 w-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Vue globale</span>
            </TabsTrigger>
            <TabsTrigger value="users">
              <UsersIcon className="h-3.5 w-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Utilisateurs</span>
            </TabsTrigger>
            <TabsTrigger value="files">
              <FileIcon className="h-3.5 w-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Fichiers</span>
            </TabsTrigger>
            <TabsTrigger value="links">
              <LinkIcon className="h-3.5 w-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Liens</span>
            </TabsTrigger>
            <TabsTrigger value="system">
              <WrenchIcon className="h-3.5 w-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Système</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab stats={stats} loading={loading} />
          </TabsContent>
          <TabsContent value="users">
            <UsersTab users={users} onRefresh={() => { fetchUsers(); fetchStats(); }} />
          </TabsContent>
          <TabsContent value="files">
            <FilesTab files={files} onRefresh={() => { fetchFiles(); fetchStats(); }} />
          </TabsContent>
          <TabsContent value="links">
            <LinksTab links={links} onRefresh={() => { fetchLinks(); fetchStats(); }} />
          </TabsContent>
          <TabsContent value="system">
            <SystemTab onRefresh={fetchAll} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// --- Overview Tab ---

function OverviewTab({ stats, loading }: { stats: AdminStats | null; loading: boolean }) {
  if (loading || !stats) {
    return (
      <div className="flex justify-center py-12">
        <Loader2Icon className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const statCards = [
    { label: "Utilisateurs", value: stats.totalUsers, sub: `${stats.registeredUsers} inscrits · ${stats.anonymousUsers} anonymes`, icon: UsersIcon },
    { label: "Fichiers", value: stats.totalFiles, icon: FileIcon },
    { label: "Stockage total", value: formatFileSize(stats.totalStorage), icon: HardDriveIcon },
    { label: "Téléchargements", value: stats.totalDownloads, icon: DownloadIcon },
    { label: "Liens actifs", value: stats.activeLinks, sub: `${stats.expiredLinks} expirés`, icon: LinkIcon },
    { label: "Sessions", value: stats.totalSessions, icon: DatabaseIcon },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
      {statCards.map((s) => (
        <Card key={s.label}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
              {s.label}
            </CardTitle>
            <s.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold tabular-nums">{s.value}</div>
            {s.sub && (
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">{s.sub}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// --- Users Tab ---

function UsersTab({ users, onRefresh }: { users: AdminUser[]; onRefresh: () => void }) {
  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    if (!deletingUser) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/users/${deletingUser.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(`Utilisateur supprimé`);
        onRefresh();
      } else {
        const data = await res.json();
        toast.error(data.error || "Erreur");
      }
    } catch {
      toast.error("Erreur lors de la suppression");
    }
    setIsDeleting(false);
    setDeletingUser(null);
  }

  if (users.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <UsersIcon className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">Aucun utilisateur</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {users.map((user) => (
          <Card key={user.id} size="sm">
            <CardContent className="flex items-center gap-3">
              <div className="flex items-center justify-center h-9 w-9 rounded-full bg-muted shrink-0">
                <UserIcon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium truncate">
                    {user.pseudo || user.username || "Anonyme"}
                  </span>
                  {user.username && (
                    <span className="text-[10px] text-muted-foreground">@{user.username}</span>
                  )}
                  {user.isAnonymous ? (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Anonyme</Badge>
                  ) : (
                    <Badge variant="default" className="text-[10px] px-1.5 py-0">Inscrit</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs text-muted-foreground mt-0.5 flex-wrap">
                  <span>{user.fileCount} fichier{user.fileCount !== 1 ? "s" : ""}</span>
                  <span>{formatFileSize(user.storageUsed)}</span>
                  <span className="hidden sm:inline">Vu {formatDate(user.lastSeenAt)}</span>
                  <span className="hidden sm:inline">Créé {formatDate(user.createdAt)}</span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setDeletingUser(user)}
                title="Supprimer l'utilisateur"
                disabled={user.username === "dimz"}
              >
                <TrashIcon className="h-4 w-4 text-destructive" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={!!deletingUser} onOpenChange={(open) => !open && setDeletingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10">
              <AlertTriangleIcon className="text-destructive" />
            </AlertDialogMedia>
            <AlertDialogTitle>Supprimer cet utilisateur ?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingUser && (
                <>
                  <strong className="text-foreground">
                    {deletingUser.pseudo || deletingUser.username || "Anonyme"}
                  </strong>
                  {" "}sera définitivement supprimé avec tous ses fichiers ({deletingUser.fileCount}) et liens de partage.
                  Stockage libéré : {formatFileSize(deletingUser.storageUsed)}.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? <Loader2Icon className="h-4 w-4 animate-spin mr-2" /> : <TrashIcon className="h-4 w-4 mr-2" />}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// --- Files Tab ---

function FilesTab({ files, onRefresh }: { files: AdminFile[]; onRefresh: () => void }) {
  const [deletingFile, setDeletingFile] = useState<AdminFile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    if (!deletingFile) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/files/${deletingFile.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(`"${deletingFile.name}" supprimé`);
        onRefresh();
      } else {
        const data = await res.json();
        toast.error(data.error || "Erreur");
      }
    } catch {
      toast.error("Erreur lors de la suppression");
    }
    setIsDeleting(false);
    setDeletingFile(null);
  }

  if (files.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <FileIcon className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">Aucun fichier</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {files.map((file) => (
          <Card key={file.id} size="sm">
            <CardContent className="flex items-center gap-3">
              <FileTypeIcon fileName={file.name} mimeType={file.mimeType} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate" title={file.name}>
                  {file.name}
                </p>
                <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs text-muted-foreground mt-0.5 flex-wrap">
                  <span className="tabular-nums">{formatFileSize(file.size)}</span>
                  <span>{file.userName}</span>
                  <span className="flex items-center gap-0.5">
                    <DownloadIcon className="h-2.5 w-2.5" />
                    <span className="tabular-nums">{file.totalDownloads}</span>
                  </span>
                  <span className="flex items-center gap-0.5">
                    <LinkIcon className="h-2.5 w-2.5" />
                    <span className="tabular-nums">{file.linkCount}</span>
                  </span>
                  <span className="hidden sm:inline">{formatDate(file.createdAt)}</span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setDeletingFile(file)}
                title="Supprimer le fichier"
              >
                <TrashIcon className="h-4 w-4 text-destructive" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={!!deletingFile} onOpenChange={(open) => !open && setDeletingFile(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10">
              <AlertTriangleIcon className="text-destructive" />
            </AlertDialogMedia>
            <AlertDialogTitle>Supprimer ce fichier ?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingFile && (
                <>
                  <strong className="text-foreground">{deletingFile.name}</strong>
                  {" "}({formatFileSize(deletingFile.size)}) de {deletingFile.userName} sera définitivement supprimé avec ses {deletingFile.linkCount} lien{deletingFile.linkCount !== 1 ? "s" : ""}.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? <Loader2Icon className="h-4 w-4 animate-spin mr-2" /> : <TrashIcon className="h-4 w-4 mr-2" />}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// --- Links Tab ---

function LinksTab({ links, onRefresh }: { links: AdminLink[]; onRefresh: () => void }) {
  const [deletingLink, setDeletingLink] = useState<AdminLink | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    if (!deletingLink) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/links/${deletingLink.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Lien supprimé");
        onRefresh();
      } else {
        const data = await res.json();
        toast.error(data.error || "Erreur");
      }
    } catch {
      toast.error("Erreur lors de la suppression");
    }
    setIsDeleting(false);
    setDeletingLink(null);
  }

  if (links.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <LinkIcon className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">Aucun lien de partage</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {links.map((link) => {
          const inactive = link.expired || link.maxedOut;
          return (
            <Card key={link.id} size="sm" className={inactive ? "opacity-60" : ""}>
              <CardContent className="flex items-center gap-3">
                <LinkIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="text-xs truncate">{link.token}</code>
                    {link.expired && (
                      <Badge variant="destructive" className="text-[10px] px-1 py-0">Expiré</Badge>
                    )}
                    {link.maxedOut && (
                      <Badge variant="secondary" className="text-[10px] px-1 py-0">Max atteint</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs text-muted-foreground mt-0.5 flex-wrap">
                    <span className="truncate max-w-[120px] sm:max-w-[200px]" title={link.fileName}>{link.fileName}</span>
                    <span>{link.userName}</span>
                    <span className="flex items-center gap-0.5">
                      <DownloadIcon className="h-2.5 w-2.5" />
                      <span className="tabular-nums">{link.downloadCount}{link.maxDownloads ? `/${link.maxDownloads}` : ""}</span>
                    </span>
                    {link.expiresAt && (
                      <span className="hidden sm:inline">{formatDate(link.expiresAt)}</span>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setDeletingLink(link)}
                  title="Supprimer le lien"
                >
                  <TrashIcon className="h-4 w-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AlertDialog open={!!deletingLink} onOpenChange={(open) => !open && setDeletingLink(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10">
              <AlertTriangleIcon className="text-destructive" />
            </AlertDialogMedia>
            <AlertDialogTitle>Supprimer ce lien ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le lien <strong className="text-foreground">{deletingLink?.token}</strong> vers{" "}
              <strong className="text-foreground">{deletingLink?.fileName}</strong> ne sera plus accessible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? <Loader2Icon className="h-4 w-4 animate-spin mr-2" /> : <TrashIcon className="h-4 w-4 mr-2" />}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// --- System Tab ---

function SystemTab({ onRefresh }: { onRefresh: () => void }) {
  const [cleaning, setCleaning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<{
    deletedLinks: number;
    deletedFiles: number;
    deletedSessions: number;
    deletedUsers: number;
  } | null>(null);

  async function handleCleanup() {
    setCleaning(true);
    setCleanupResult(null);
    try {
      const res = await fetch("/api/admin/cleanup", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setCleanupResult(data);
        toast.success("Nettoyage terminé");
        onRefresh();
      } else {
        toast.error("Erreur lors du nettoyage");
      }
    } catch {
      toast.error("Erreur réseau");
    }
    setCleaning(false);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <WrenchIcon className="h-4 w-4" />
            Nettoyage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Supprime les liens expirés, fichiers expirés, sessions expirées et utilisateurs anonymes orphelins.
          </p>
          <Button onClick={handleCleanup} disabled={cleaning}>
            {cleaning ? (
              <Loader2Icon className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCwIcon className="h-4 w-4 mr-2" />
            )}
            Lancer le nettoyage
          </Button>
          {cleanupResult && (
            <div className="rounded-lg border p-3 text-sm space-y-1">
              <p>Liens supprimés : <strong>{cleanupResult.deletedLinks}</strong></p>
              <p>Fichiers supprimés : <strong>{cleanupResult.deletedFiles}</strong></p>
              <p>Sessions supprimées : <strong>{cleanupResult.deletedSessions}</strong></p>
              <p>Utilisateurs orphelins supprimés : <strong>{cleanupResult.deletedUsers}</strong></p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldIcon className="h-4 w-4" />
            Sécurité
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>Accès admin restreint au compte <code className="text-xs bg-muted px-1.5 py-0.5 rounded">dimz</code>.</p>
            <p>Toutes les actions admin sont vérifiées côté serveur via session cookie.</p>
            <p>Les routes <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/api/admin/*</code> retournent 403 pour tout utilisateur non-admin.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
