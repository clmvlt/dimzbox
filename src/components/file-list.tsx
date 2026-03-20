"use client";

import { useEffect, useRef, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Badge } from "@/components/ui/badge";
import {
  ShareIcon,
  TrashIcon,
  DownloadIcon,
  FileIcon as LucideFileIcon,
  Loader2Icon,
  AlertTriangleIcon,
} from "lucide-react";
import { formatFileSize, formatDate } from "@/lib/format";
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
  shareLinks: { id: string }[];
}

interface FileListProps {
  files: FileItem[];
  loading: boolean;
  onFileDeleted: (fileId: string) => void;
}

export function FileList({ files, loading, onFileDeleted }: FileListProps) {
  const [deletingFile, setDeletingFile] = useState<FileItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [shareFile, setShareFile] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Track des IDs connus pour animer les nouveaux fichiers
  const knownIds = useRef<Set<string>>(new Set());
  const [newIds, setNewIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fresh = new Set<string>();
    for (const f of files) {
      if (!knownIds.current.has(f.id)) {
        fresh.add(f.id);
      }
    }
    // Mettre à jour les IDs connus
    knownIds.current = new Set(files.map((f) => f.id));

    if (fresh.size > 0) {
      setNewIds(fresh);
      // Retirer la classe d'animation après qu'elle a joué
      const timer = setTimeout(() => setNewIds(new Set()), 500);
      return () => clearTimeout(timer);
    }
  }, [files]);

  async function confirmDelete() {
    if (!deletingFile) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/files/${deletingFile.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success(`"${deletingFile.name}" supprimé`);
        onFileDeleted(deletingFile.id);
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

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2Icon className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <LucideFileIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p className="text-sm">Aucun fichier</p>
        <p className="text-xs mt-1">
          Uploadez votre premier fichier ci-dessus
        </p>
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40%]">Nom</TableHead>
            <TableHead>Taille</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-center">Téléchargements</TableHead>
            <TableHead className="text-center">Liens</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {files.map((file) => (
            <TableRow
              key={file.id}
              className={newIds.has(file.id) ? "animate-fade-in-up" : ""}
            >
              <TableCell>
                <div className="flex items-center gap-3 min-w-0">
                  <FileIcon
                    fileName={file.name}
                    mimeType={file.mimeType}
                    size="sm"
                  />
                  <span
                    className="truncate text-sm font-medium"
                    title={file.name}
                  >
                    {file.name}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground whitespace-nowrap tabular-nums">
                {formatFileSize(file.size)}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                {formatDate(file.createdAt)}
              </TableCell>
              <TableCell className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <DownloadIcon className="h-3 w-3 text-muted-foreground" />
                  <span className="text-sm tabular-nums">
                    {file.totalDownloads}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-center">
                <Badge variant="secondary" className="text-xs tabular-nums">
                  {file.shareLinks.length}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() =>
                      setShareFile({ id: file.id, name: file.name })
                    }
                    title="Partager"
                  >
                    <ShareIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setDeletingFile(file)}
                    title="Supprimer"
                  >
                    <TrashIcon className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <ShareDialog
        open={!!shareFile}
        onOpenChange={(open) => !open && setShareFile(null)}
        fileId={shareFile?.id ?? null}
        fileName={shareFile?.name ?? ""}
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
                  <strong className="text-foreground">
                    {deletingFile.name}
                  </strong>{" "}
                  sera définitivement supprimé, ainsi que tous ses liens de
                  partage ({deletingFile.shareLinks.length} lien
                  {deletingFile.shareLinks.length !== 1 ? "s" : ""}).
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={confirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2Icon className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <TrashIcon className="h-4 w-4 mr-2" />
              )}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
