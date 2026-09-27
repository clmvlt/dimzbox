"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import Link from "next/link";
import { BoxIcon } from "lucide-react";
import { toast } from "sonner";
import { DashboardStats, type Stats } from "./dashboard-stats";
import { FileList, type FileItem } from "./file-list";
import { UploadDropzone, DropOverlay } from "./upload-dropzone";
import { UploadQueuePanel } from "./upload-queue-panel";
import { UpdateBanner } from "./update-banner";
import { AuthDialog } from "./auth-dialog";
import { UserMenu } from "./user-menu";
import { useUploadQueue, useWarnBeforeUnload } from "@/hooks/use-upload-queue";
import { copyQuickLink } from "@/lib/quick-share";
import { CLIENT_CONFIG } from "@/lib/config.client";
import type { PendingUpload, UploadedFile } from "@/lib/upload-queue";

interface AuthUser {
  id: string;
  username: string | null;
  pseudo: string | null;
  isAnonymous: boolean;
}

const INITIAL_STATS: Stats = {
  fileCount: 0,
  storageUsed: 0,
  storageMax: CLIENT_CONFIG.maxStoragePerUser,
  totalDownloads: 0,
  activeLinks: 0,
};

export function Dashboard() {
  const [stats, setStats] = useState<Stats>(INITIAL_STATS);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [interrupted, setInterrupted] = useState<PendingUpload[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);

  const { queue, tasks, summary } = useUploadQueue();
  useWarnBeforeUnload(summary.busy);

  const refresh = useCallback(async () => {
    try {
      const [statsRes, filesRes, pendingRes] = await Promise.all([
        fetch("/api/stats", { cache: "no-store" }),
        fetch("/api/files", { cache: "no-store" }),
        fetch("/api/upload", { cache: "no-store" }),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (filesRes.ok) setFiles(await filesRes.json());
      if (pendingRes.ok) setInterrupted(await pendingRes.json());
    } catch (error) {
      console.error("Refresh error:", error);
    }
  }, []);

  // Regroupe les rafraîchissements (ex : 20 petits fichiers qui se terminent)
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(refresh, 800);
  }, [refresh]);

  useEffect(() => {
    // D'abord initialiser la session, puis charger les données
    fetch("/api/account")
      .then((res) => res.json())
      .then((user) => {
        setAuthUser(user);
        setAuthLoading(false);
        return refresh();
      })
      .then(() => setInitialLoading(false))
      .catch(() => {
        setAuthLoading(false);
        setInitialLoading(false);
      });
  }, [refresh]);

  useEffect(() => {
    if (!queue) return;
    return queue.on((event) => {
      switch (event.type) {
        case "uploaded": {
          const f = event.file;
          setFiles((prev) =>
            prev.some((p) => p.id === f.id)
              ? prev
              : [{ ...f, totalDownloads: 0, shareLinks: [] }, ...prev]
          );
          setInterrupted((prev) => prev.filter((u) => u.id !== f.id));
          scheduleRefresh();
          break;
        }
        case "rejected":
          toast.error(`${event.name} : ${event.reason}`);
          break;
        case "failed":
          toast.error(`Échec de l'envoi de ${event.name}`, { description: event.error });
          scheduleRefresh();
          break;
        case "drained":
          if (event.succeeded > 0) {
            toast.success(
              event.succeeded === 1
                ? "Fichier envoyé"
                : `${event.succeeded} fichiers envoyés`
            );
          }
          scheduleRefresh();
          break;
      }
    });
  }, [queue, scheduleRefresh]);

  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted.length > 0) queue?.add(accepted);
    },
    [queue]
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    noClick: true,
    noKeyboard: true,
  });

  const handleAuthenticated = useCallback(
    (user: AuthUser) => {
      setAuthUser(user);
      refresh();
    },
    [refresh]
  );

  const handleLogout = useCallback(() => {
    // Après déconnexion, recharger pour obtenir une nouvelle session anonyme
    fetch("/api/account")
      .then((res) => res.json())
      .then((user) => {
        setAuthUser(user);
        refresh();
      });
  }, [refresh]);

  const handleFileDeleted = useCallback(
    (fileId: string) => {
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      scheduleRefresh();
    },
    [scheduleRefresh]
  );

  const handleCopyUploaded = useCallback(
    async (file: UploadedFile) => {
      try {
        const existing = files.find((f) => f.id === file.id)?.shareLinks ?? [];
        const { created, copied } = await copyQuickLink(file.id, existing);
        if (copied) {
          toast.success(created ? "Lien créé et copié" : "Lien copié", {
            description: created ? "Valable 7 jours, téléchargements illimités" : undefined,
          });
        } else {
          toast.error("Impossible de copier le lien");
        }
        if (created) scheduleRefresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Erreur lors du partage");
      }
    },
    [files, scheduleRefresh]
  );

  const handleDiscardInterrupted = useCallback(
    async (id: string) => {
      setInterrupted((prev) => prev.filter((u) => u.id !== id));
      try {
        await fetch(`/api/upload/${id}`, { method: "DELETE" });
      } catch {
        toast.error("Impossible d'abandonner cet envoi");
      }
      scheduleRefresh();
    },
    [scheduleRefresh]
  );

  return (
    <div {...getRootProps({ className: "min-h-screen bg-background outline-none" })}>
      <input {...getInputProps()} />
      <UpdateBanner busy={summary.busy} />

      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <BoxIcon className="size-4.5" />
            </span>
            <span className="text-lg font-bold tracking-tight">DimzBox</span>
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-[11px] text-muted-foreground/60 tabular-nums sm:inline">
              v{process.env.NEXT_PUBLIC_APP_VERSION}
            </span>
            {!authLoading &&
              (authUser && !authUser.isAnonymous ? (
                <UserMenu user={authUser} onLogout={handleLogout} />
              ) : (
                <AuthDialog onAuthenticated={handleAuthenticated} />
              ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 px-4 py-5 sm:space-y-5 sm:py-8">
        <UploadDropzone onBrowse={open} isDragActive={isDragActive} />

        <UploadQueuePanel
          queue={queue}
          tasks={tasks}
          summary={summary}
          interrupted={interrupted}
          onResumeInterrupted={open}
          onDiscardInterrupted={handleDiscardInterrupted}
          onCopyLink={handleCopyUploaded}
        />

        <DashboardStats stats={stats} />

        <FileList
          files={files}
          loading={initialLoading}
          onFileDeleted={handleFileDeleted}
          onLinksChanged={scheduleRefresh}
        />

        <p className="pb-4 text-center text-xs text-muted-foreground/60">
          Sans compte, vos fichiers sont liés à ce navigateur. Créez un compte pour les
          retrouver partout.
        </p>
      </main>

      <DropOverlay visible={isDragActive} />
    </div>
  );
}
