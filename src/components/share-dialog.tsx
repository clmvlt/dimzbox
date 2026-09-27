"use client";

import { useCallback, useEffect, useState } from "react";
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
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CopyIcon,
  CheckIcon,
  Trash2Icon,
  Loader2Icon,
  DownloadIcon,
  ClockIcon,
  AlertTriangleIcon,
  ExternalLinkIcon,
  LinkIcon,
  InfinityIcon,
} from "lucide-react";
import { formatDate, formatRelative } from "@/lib/format";
import { copyToClipboard } from "@/lib/clipboard";
import { getLinkStatus, shareUrl } from "@/lib/share";
import { createShareLink, type ShareLinkItem } from "@/lib/quick-share";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileId: string | null;
  fileName: string;
  onChanged?: () => void;
}

const EXPIRATIONS = [1, 3, 7, 14, 30];
const DOWNLOAD_LIMITS: (number | null)[] = [null, 1, 5, 10];

export function ShareDialog({
  open,
  onOpenChange,
  fileId,
  fileName,
  onChanged,
}: ShareDialogProps) {
  // Liens rattachés au fichier chargé : pas de liens périmés d'un autre fichier
  const [loaded, setLoaded] = useState<{ fileId: string | null; links: ShareLinkItem[] }>({
    fileId: null,
    links: [],
  });
  const links = loaded.fileId === fileId ? loaded.links : [];
  const setLinks = useCallback(
    (update: (prev: ShareLinkItem[]) => ShareLinkItem[]) =>
      setLoaded((s) => ({
        fileId,
        links: update(s.fileId === fileId ? s.links : []),
      })),
    [fileId]
  );
  const loading = open && !!fileId && loaded.fileId !== fileId;
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expirationDays, setExpirationDays] = useState(7);
  const [limit, setLimit] = useState<number | null | "custom">(null);
  const [customLimit, setCustomLimit] = useState("");
  const [deletingLink, setDeletingLink] = useState<ShareLinkItem | null>(null);

  useEffect(() => {
    if (!open || !fileId) return;
    let cancelled = false;
    fetch(`/api/files/${fileId}/share`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: ShareLinkItem[]) => {
        if (!cancelled) setLoaded({ fileId, links: data });
      })
      .catch(() => {
        if (!cancelled) toast.error("Erreur lors du chargement des liens");
      });
    return () => {
      cancelled = true;
    };
  }, [open, fileId]);

  async function copy(link: ShareLinkItem) {
    const ok = await copyToClipboard(shareUrl(window.location.origin, link.token));
    if (ok) {
      setCopiedId(link.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
    return ok;
  }

  async function createLink() {
    if (!fileId) return;
    let maxDownloads: number | null = null;
    if (limit === "custom") {
      const n = Number(customLimit);
      if (!Number.isInteger(n) || n < 1) {
        toast.error("Indiquez un nombre de téléchargements valide (1 minimum)");
        return;
      }
      maxDownloads = n;
    } else {
      maxDownloads = limit;
    }

    setCreating(true);
    try {
      const link = await createShareLink(fileId, { expirationDays, maxDownloads });
      setLinks((prev) => [link, ...prev]);
      const ok = await copy(link);
      toast.success(ok ? "Lien créé et copié" : "Lien créé");
      onChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur lors de la création du lien");
    }
    setCreating(false);
  }

  async function confirmDeleteLink() {
    if (!deletingLink) return;
    try {
      const res = await fetch(`/api/share/${deletingLink.id}`, { method: "DELETE" });
      if (res.ok) {
        setLinks((prev) => prev.filter((l) => l.id !== deletingLink.id));
        toast.success("Lien supprimé");
        onChanged?.();
      } else {
        toast.error("Impossible de supprimer le lien");
      }
    } catch {
      toast.error("Erreur lors de la suppression");
    }
    setDeletingLink(null);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Partager</DialogTitle>
            <DialogDescription className="truncate" title={fileName}>
              {fileName}
            </DialogDescription>
          </DialogHeader>

          {/* Nouveau lien */}
          <div className="space-y-4 rounded-xl border bg-muted/20 p-3 sm:p-4">
            <fieldset className="space-y-2">
              <legend className="mb-2 text-xs font-medium text-muted-foreground">
                Expire après
              </legend>
              <Segmented
                options={EXPIRATIONS.map((d) => ({ value: d, label: `${d} j` }))}
                value={expirationDays}
                onChange={setExpirationDays}
              />
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="mb-2 text-xs font-medium text-muted-foreground">
                Nombre de téléchargements
              </legend>
              <Segmented<number | null | "custom">
                options={[
                  ...DOWNLOAD_LIMITS.map((n) => ({
                    value: n,
                    label:
                      n === null ? (
                        <span className="inline-flex items-center gap-1">
                          <InfinityIcon className="size-3.5" /> Illimité
                        </span>
                      ) : (
                        String(n)
                      ),
                  })),
                  { value: "custom" as const, label: "Autre" },
                ]}
                value={limit}
                onChange={setLimit}
              />
              {limit === "custom" && (
                <Input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  autoFocus
                  placeholder="Ex : 25"
                  value={customLimit}
                  onChange={(e) => setCustomLimit(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createLink()}
                />
              )}
            </fieldset>

            <Button onClick={createLink} disabled={creating} className="w-full" size="lg">
              {creating ? <Loader2Icon className="animate-spin" /> : <LinkIcon />}
              Créer et copier le lien
            </Button>
          </div>

          {/* Liens existants */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Liens existants {links.length > 0 && `(${links.length})`}
            </p>
            <div className="-mx-1 max-h-60 space-y-2 overflow-y-auto px-1">
              {loading && links.length === 0 ? (
                <div className="flex justify-center py-4">
                  <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : links.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Aucun lien pour l&apos;instant
                </p>
              ) : (
                links.map((link) => (
                  <LinkRow
                    key={link.id}
                    link={link}
                    copied={copiedId === link.id}
                    onCopy={async () => {
                      if (!(await copy(link))) toast.error("Impossible de copier le lien");
                    }}
                    onDelete={() => setDeletingLink(link)}
                  />
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deletingLink}
        onOpenChange={(v) => !v && setDeletingLink(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10">
              <AlertTriangleIcon className="text-destructive" />
            </AlertDialogMedia>
            <AlertDialogTitle>Supprimer ce lien ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les personnes qui ont ce lien ne pourront plus télécharger le fichier.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDeleteLink}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function LinkRow({
  link,
  copied,
  onCopy,
  onDelete,
}: {
  link: ShareLinkItem;
  copied: boolean;
  onCopy: () => void;
  onDelete: () => void;
}) {
  const status = getLinkStatus(link);
  const url = `/d/${link.token}`;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border p-2.5 pl-3",
        !status.active && "bg-muted/30 opacity-60"
      )}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <code className="truncate text-xs">{url}</code>
          {status.expired ? (
            <StatusPill tone="error">Expiré</StatusPill>
          ) : status.exhausted ? (
            <StatusPill tone="muted">Limite atteinte</StatusPill>
          ) : (
            <StatusPill tone="ok">Actif</StatusPill>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground tabular-nums">
          <span className="inline-flex items-center gap-1">
            <DownloadIcon className="size-3" />
            {status.unlimited
              ? `${link.downloadCount} · illimité`
              : `${link.downloadCount} / ${link.maxDownloads}`}
          </span>
          {link.expiresAt && (
            <span
              className="inline-flex items-center gap-1"
              title={formatDate(link.expiresAt)}
            >
              <ClockIcon className="size-3" />
              {status.expired ? "expiré " : "expire "}
              {formatRelative(link.expiresAt)}
            </span>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onCopy}
        title="Copier le lien"
        aria-label="Copier le lien"
      >
        {copied ? <CheckIcon className="text-success" /> : <CopyIcon />}
      </Button>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
        title="Ouvrir la page de téléchargement"
        aria-label="Ouvrir la page de téléchargement"
      >
        <ExternalLinkIcon />
      </a>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onDelete}
        title="Supprimer le lien"
        aria-label="Supprimer le lien"
      >
        <Trash2Icon className="text-destructive" />
      </Button>
    </div>
  );
}

function StatusPill({
  tone,
  children,
}: {
  tone: "ok" | "error" | "muted";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "shrink-0 rounded px-1.5 py-px text-[10px] font-medium",
        tone === "ok" && "bg-success/15 text-success",
        tone === "error" && "bg-destructive/15 text-destructive",
        tone === "muted" && "bg-muted text-muted-foreground"
      )}
    >
      {children}
    </span>
  );
}

function Segmented<T>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup">
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={cn(
              "h-8 min-w-11 rounded-lg border px-3 text-sm font-medium transition-colors",
              selected
                ? "border-primary bg-primary/15 text-foreground"
                : "border-border bg-background/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
