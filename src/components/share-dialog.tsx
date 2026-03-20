"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  CopyIcon,
  CheckIcon,
  PlusIcon,
  TrashIcon,
  Loader2Icon,
  LinkIcon,
  DownloadIcon,
  ClockIcon,
  AlertTriangleIcon,
} from "lucide-react";
import { formatDate } from "@/lib/format";
import { copyToClipboard } from "@/lib/clipboard";
import { toast } from "sonner";

interface ShareLink {
  id: string;
  token: string;
  downloadCount: number;
  maxDownloads: number | null;
  expiresAt: string | null;
  createdAt: string;
}

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileId: string | null;
  fileName: string;
}

export function ShareDialog({
  open,
  onOpenChange,
  fileId,
  fileName,
}: ShareDialogProps) {
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expirationDays, setExpirationDays] = useState(7);
  const [maxDownloads, setMaxDownloads] = useState("");
  const [deletingLink, setDeletingLink] = useState<ShareLink | null>(null);

  useEffect(() => {
    if (open && fileId) {
      fetchLinks();
    }
  }, [open, fileId]);

  async function fetchLinks() {
    if (!fileId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/files/${fileId}/share`);
      if (res.ok) {
        setLinks(await res.json());
      }
    } catch {
      toast.error("Erreur lors du chargement des liens");
    }
    setLoading(false);
  }

  async function createLink() {
    if (!fileId) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/files/${fileId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expirationDays,
          maxDownloads: maxDownloads ? Number(maxDownloads) : null,
        }),
      });
      if (res.ok) {
        await fetchLinks();
        setMaxDownloads("");
        toast.success("Lien créé");
      } else {
        const data = await res.json();
        toast.error(data.error || "Erreur");
      }
    } catch {
      toast.error("Erreur lors de la création du lien");
    }
    setCreating(false);
  }

  async function confirmDeleteLink() {
    if (!deletingLink) return;
    try {
      const res = await fetch(`/api/share/${deletingLink.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setLinks((prev) => prev.filter((l) => l.id !== deletingLink.id));
        toast.success("Lien supprimé");
      }
    } catch {
      toast.error("Erreur lors de la suppression");
    }
    setDeletingLink(null);
  }

  async function handleCopy(token: string, linkId: string) {
    const url = `${window.location.origin}/d/${token}`;
    const ok = await copyToClipboard(url);
    if (ok) {
      setCopiedId(linkId);
      toast.success("Lien copié dans le presse-papier");
      setTimeout(() => setCopiedId(null), 2000);
    } else {
      toast.error("Impossible de copier le lien");
    }
  }

  function isExpired(link: ShareLink) {
    return link.expiresAt && new Date(link.expiresAt) < new Date();
  }

  function isMaxedOut(link: ShareLink) {
    return (
      link.maxDownloads !== null && link.downloadCount >= link.maxDownloads
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Partager</DialogTitle>
            <DialogDescription className="truncate">
              {fileName}
            </DialogDescription>
          </DialogHeader>

          {/* Création d'un nouveau lien */}
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-1">
                <Label className="text-xs mb-1">Expiration</Label>
                <select
                  value={expirationDays}
                  onChange={(e) => setExpirationDays(Number(e.target.value))}
                  className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value={1}>1 jour</option>
                  <option value={3}>3 jours</option>
                  <option value={7}>7 jours</option>
                  <option value={14}>14 jours</option>
                  <option value={30}>30 jours</option>
                </select>
              </div>
              <div className="flex-1">
                <Label className="text-xs mb-1">Max téléchargements</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="Illimité"
                  value={maxDownloads}
                  onChange={(e) => setMaxDownloads(e.target.value)}
                />
              </div>
            </div>
            <Button
              onClick={createLink}
              disabled={creating}
              className="w-full"
              size="sm"
            >
              {creating ? (
                <Loader2Icon className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <PlusIcon className="h-4 w-4 mr-2" />
              )}
              Créer un lien
            </Button>
          </div>

          <Separator />

          {/* Liste des liens existants */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-4">
                <Loader2Icon className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : links.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucun lien de partage
              </p>
            ) : (
              links.map((link) => {
                const expired = isExpired(link);
                const maxed = isMaxedOut(link);
                const inactive = expired || maxed;

                return (
                  <div
                    key={link.id}
                    className={`flex items-center gap-2 p-3 rounded-md border ${
                      inactive ? "opacity-50 bg-muted/30" : "bg-muted/10"
                    }`}
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <LinkIcon className="h-3 w-3 text-muted-foreground shrink-0" />
                        <code className="text-xs truncate">{link.token}</code>
                        {expired && (
                          <Badge
                            variant="destructive"
                            className="text-[10px] px-1 py-0"
                          >
                            Expiré
                          </Badge>
                        )}
                        {maxed && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-1 py-0"
                          >
                            Max atteint
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <DownloadIcon className="h-3 w-3" />
                          {link.downloadCount}
                          {link.maxDownloads ? `/${link.maxDownloads}` : ""}
                        </span>
                        {link.expiresAt && (
                          <span className="flex items-center gap-1">
                            <ClockIcon className="h-3 w-3" />
                            {formatDate(link.expiresAt)}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleCopy(link.token, link.id)}
                      title="Copier le lien"
                    >
                      {copiedId === link.id ? (
                        <CheckIcon className="h-3 w-3 text-green-500" />
                      ) : (
                        <CopyIcon className="h-3 w-3" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setDeletingLink(link)}
                      title="Supprimer le lien"
                    >
                      <TrashIcon className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation suppression de lien */}
      <AlertDialog
        open={!!deletingLink}
        onOpenChange={(open) => !open && setDeletingLink(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10">
              <AlertTriangleIcon className="text-destructive" />
            </AlertDialogMedia>
            <AlertDialogTitle>Supprimer ce lien ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le lien ne sera plus accessible. Les personnes ayant ce lien ne
              pourront plus télécharger le fichier.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={confirmDeleteLink}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
