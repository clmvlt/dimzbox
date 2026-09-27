"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Share2Icon,
  Trash2Icon,
  DownloadIcon,
  Loader2Icon,
  AlertTriangleIcon,
  LinkIcon,
  SearchIcon,
  InboxIcon,
  CheckIcon,
} from "lucide-react";
import { formatDate, formatFileSize, formatShortDate } from "@/lib/format";
import { getLinkStatus } from "@/lib/share";
import { copyQuickLink, type ShareLinkItem } from "@/lib/quick-share";
import { FileIcon } from "./file-icon";
import { ShareDialog } from "./share-dialog";
import { toast } from "sonner";

export interface FileItem {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  createdAt: string;
  totalDownloads: number;
  shareLinks: ShareLinkItem[];
}

type SortKey = "recent" | "name" | "size";

interface FileListProps {
  files: FileItem[];
  loading: boolean;
  onFileDeleted: (fileId: string) => void;
  onLinksChanged?: () => void;
}

export function FileList({
  files,
  loading,
  onFileDeleted,
  onLinksChanged,
}: FileListProps) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [deletingFile, setDeletingFile] = useState<FileItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [shareFile, setShareFile] = useState<{ id: string; name: string } | null>(null);
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Animer les fichiers qui viennent d'arriver
  const knownIds = useRef<Set<string> | null>(null);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (loading) return;
    const previous = knownIds.current;
    knownIds.current = new Set(files.map((f) => f.id));
    if (!previous) return; // premier chargement : pas d'animation
    const fresh = new Set(files.filter((f) => !previous.has(f.id)).map((f) => f.id));
    if (fresh.size > 0) {
      setNewIds(fresh);
      const timer = setTimeout(() => setNewIds(new Set()), 600);
      return () => clearTimeout(timer);
    }
  }, [files, loading]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? files.filter((f) => f.name.toLowerCase().includes(q)) : [...files];
    if (sort === "name") list.sort((a, b) => a.name.localeCompare(b.name, "fr"));
    else if (sort === "size") list.sort((a, b) => b.size - a.size);
    else list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return list;
  }, [files, query, sort]);

  async function quickCopy(file: FileItem) {
    setCopyingId(file.id);
    try {
      const { created, copied } = await copyQuickLink(file.id, file.shareLinks);
      if (copied) {
        setCopiedId(file.id);
        setTimeout(() => setCopiedId((id) => (id === file.id ? null : id)), 2000);
        toast.success(created ? "Lien créé et copié" : "Lien copié", {
          description: created ? "Valable 7 jours, téléchargements illimités" : undefined,
        });
      } else {
        toast.error("Impossible de copier — ouvrez le partage pour voir le lien");
      }
      if (created) onLinksChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur lors du partage");
    }
    setCopyingId(null);
  }

  async function confirmDelete() {
    if (!deletingFile) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/files/${deletingFile.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(`« ${deletingFile.name} » supprimé`);
        onFileDeleted(deletingFile.id);
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || "Erreur lors de la suppression");
      }
    } catch {
      toast.error("Erreur lors de la suppression");
    }
    setIsDeleting(false);
    setDeletingFile(null);
  }

  return (
    <section className="overflow-hidden rounded-2xl border bg-card">
      <header className="flex flex-wrap items-center gap-3 px-4 pt-4 pb-3 sm:px-5">
        <h2 className="font-semibold">
          Mes fichiers
          {files.length > 0 && (
            <span className="ml-2 text-sm font-normal text-muted-foreground tabular-nums">
              {files.length}
            </span>
          )}
        </h2>
        {files.length > 0 && (
          <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
            <div className="relative flex-1 sm:w-56 sm:flex-none">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher…"
                className="pl-8"
                aria-label="Rechercher un fichier"
              />
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
              aria-label="Trier"
            >
              <option value="recent">Récents</option>
              <option value="name">Nom</option>
              <option value="size">Taille</option>
            </select>
          </div>
        )}
      </header>

      {loading ? (
        <ul className="divide-y border-t">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
              <Skeleton className="size-10 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </li>
          ))}
        </ul>
      ) : files.length === 0 ? (
        <div className="border-t px-4 py-12 text-center text-muted-foreground">
          <InboxIcon className="mx-auto mb-3 size-10 opacity-40" />
          <p className="text-sm font-medium text-foreground">Aucun fichier pour l&apos;instant</p>
          <p className="mt-1 text-xs">Déposez un fichier ci-dessus pour obtenir un lien de partage.</p>
        </div>
      ) : visible.length === 0 ? (
        <p className="border-t px-4 py-10 text-center text-sm text-muted-foreground">
          Aucun fichier ne correspond à « {query} »
        </p>
      ) : (
        <ul className="divide-y border-t">
          {visible.map((file) => {
            const activeLinks = file.shareLinks.filter((l) => getLinkStatus(l).active).length;
            return (
              <li
                key={file.id}
                className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30 sm:px-5 ${
                  newIds.has(file.id) ? "animate-fade-in-up" : ""
                }`}
              >
                <FileIcon fileName={file.name} mimeType={file.mimeType} size="md" className="hidden sm:flex" />
                <FileIcon fileName={file.name} mimeType={file.mimeType} size="sm" className="sm:hidden" />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" title={file.name}>
                    {file.name}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground tabular-nums">
                    <span>{formatFileSize(file.size)}</span>
                    <span className="text-muted-foreground/40">·</span>
                    <span title={formatDate(file.createdAt)}>{formatShortDate(file.createdAt)}</span>
                    {file.totalDownloads > 0 && (
                      <>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="inline-flex items-center gap-0.5">
                          <DownloadIcon className="size-3" />
                          {file.totalDownloads}
                        </span>
                      </>
                    )}
                    {activeLinks > 0 && (
                      <>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="text-primary">
                          {activeLinks} lien{activeLinks > 1 ? "s" : ""} actif{activeLinks > 1 ? "s" : ""}
                        </span>
                      </>
                    )}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => quickCopy(file)}
                    disabled={copyingId === file.id}
                    aria-label={`Copier le lien de ${file.name}`}
                  >
                    {copyingId === file.id ? (
                      <Loader2Icon className="animate-spin" />
                    ) : copiedId === file.id ? (
                      <CheckIcon className="text-success" />
                    ) : (
                      <LinkIcon />
                    )}
                    <span className="hidden sm:inline">
                      {copiedId === file.id ? "Copié" : "Copier le lien"}
                    </span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setShareFile({ id: file.id, name: file.name })}
                    title="Gérer les liens de partage"
                    aria-label={`Gérer les liens de ${file.name}`}
                  >
                    <Share2Icon />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setDeletingFile(file)}
                    title="Supprimer"
                    aria-label={`Supprimer ${file.name}`}
                  >
                    <Trash2Icon className="text-destructive" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ShareDialog
        open={!!shareFile}
        onOpenChange={(open) => !open && setShareFile(null)}
        fileId={shareFile?.id ?? null}
        fileName={shareFile?.name ?? ""}
        onChanged={onLinksChanged}
      />

      <AlertDialog
        open={!!deletingFile}
        onOpenChange={(open) => !open && setDeletingFile(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10">
              <AlertTriangleIcon className="text-destructive" />
            </AlertDialogMedia>
            <AlertDialogTitle>Supprimer ce fichier ?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingFile && (
                <>
                  <strong className="break-all text-foreground">{deletingFile.name}</strong>{" "}
                  sera définitivement supprimé
                  {deletingFile.shareLinks.length > 0 &&
                    `, ainsi que ses ${deletingFile.shareLinks.length} lien${deletingFile.shareLinks.length > 1 ? "s" : ""} de partage`}
                  .
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={confirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2Icon className="animate-spin" /> : <Trash2Icon />}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
