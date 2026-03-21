"use client";

import { useCallback, useEffect, useState } from "react";
import { DashboardStats, type Stats } from "./dashboard-stats";
import { FileUpload } from "./file-upload";
import { FileList, type FileItem } from "./file-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BoxIcon } from "lucide-react";
import { UpdateBanner } from "./update-banner";
import { AuthDialog } from "./auth-dialog";
import { UserMenu } from "./user-menu";

interface AuthUser {
  id: string;
  username: string | null;
  pseudo: string | null;
  isAnonymous: boolean;
}

export function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    fileCount: 0,
    storageUsed: 0,
    storageMax: 500 * 1024 * 1024 * 1024,
    totalDownloads: 0,
    activeLinks: 0,
  });
  const [files, setFiles] = useState<FileItem[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);

  const silentRefresh = useCallback(async () => {
    try {
      const [statsRes, filesRes] = await Promise.all([
        fetch("/api/stats"),
        fetch("/api/files"),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (filesRes.ok) setFiles(await filesRes.json());
    } catch (error) {
      console.error("Refresh error:", error);
    }
  }, []);

  useEffect(() => {
    // D'abord initialiser la session, puis charger les données
    fetch("/api/account")
      .then((res) => res.json())
      .then((user) => {
        setAuthUser(user);
        return silentRefresh();
      })
      .then(() => setInitialLoading(false))
      .catch(() => setInitialLoading(false));
  }, [silentRefresh]);

  const handleAuthenticated = useCallback(
    (user: AuthUser) => {
      setAuthUser(user);
      // Recharger les fichiers après login/register
      silentRefresh();
    },
    [silentRefresh]
  );

  const handleLogout = useCallback(() => {
    // Après déconnexion, recharger pour obtenir une nouvelle session anonyme
    fetch("/api/account")
      .then((res) => res.json())
      .then((user) => {
        setAuthUser(user);
        silentRefresh();
      });
  }, [silentRefresh]);

  const handleFileUploaded = useCallback(
    (uploaded: {
      id: string;
      name: string;
      size: number;
      mimeType: string;
      createdAt: string;
    }) => {
      setFiles((prev) => [
        {
          id: uploaded.id,
          name: uploaded.name,
          size: uploaded.size,
          mimeType: uploaded.mimeType,
          createdAt: uploaded.createdAt,
          totalDownloads: 0,
          shareLinks: [],
        },
        ...prev,
      ]);
      setStats((prev) => ({
        ...prev,
        fileCount: prev.fileCount + 1,
        storageUsed: prev.storageUsed + uploaded.size,
      }));
      silentRefresh();
    },
    [silentRefresh]
  );

  const handleFileDeleted = useCallback(
    (fileId: string) => {
      const file = files.find((f) => f.id === fileId);
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      if (file) {
        setStats((prev) => ({
          ...prev,
          fileCount: Math.max(0, prev.fileCount - 1),
          storageUsed: Math.max(0, prev.storageUsed - file.size),
          totalDownloads: Math.max(0, prev.totalDownloads - file.totalDownloads),
          activeLinks: Math.max(0, prev.activeLinks - file.shareLinks.length),
        }));
      }
      silentRefresh();
    },
    [files, silentRefresh]
  );

  return (
    <div className="min-h-screen bg-background">
      <UpdateBanner />
      <header className="border-b">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <BoxIcon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            <h1 className="text-lg sm:text-xl font-bold tracking-tight">DimzBox</h1>
          </div>
          <span className="hidden sm:inline text-xs text-muted-foreground tracking-wide">
            Partage de fichiers
          </span>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden sm:inline text-[10px] text-muted-foreground/50 tabular-nums">
              v{process.env.NEXT_PUBLIC_APP_VERSION}
            </span>
            {authUser && !authUser.isAnonymous ? (
              <UserMenu user={authUser} onLogout={handleLogout} />
            ) : (
              <AuthDialog onAuthenticated={handleAuthenticated} />
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
        <DashboardStats stats={stats} />

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Upload</CardTitle>
          </CardHeader>
          <CardContent>
            <FileUpload onFileUploaded={handleFileUploaded} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Mes fichiers</CardTitle>
          </CardHeader>
          <CardContent>
            <FileList
              files={files}
              loading={initialLoading}
              onFileDeleted={handleFileDeleted}
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
