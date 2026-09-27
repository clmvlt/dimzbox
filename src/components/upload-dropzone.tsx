"use client";

import { UploadCloudIcon, ZapIcon, RotateCcwIcon, ShieldCheckIcon } from "lucide-react";
import { CLIENT_CONFIG } from "@/lib/config.client";
import { formatFileSize } from "@/lib/format";
import { cn } from "@/lib/utils";

interface UploadDropzoneProps {
  onBrowse: () => void;
  isDragActive: boolean;
}

/** Zone d'upload principale. Le dépôt est géré au niveau de la page entière. */
export function UploadDropzone({ onBrowse, isDragActive }: UploadDropzoneProps) {
  return (
    <section
      className={cn(
        "hero-glow relative overflow-hidden rounded-2xl border transition-colors duration-200",
        isDragActive ? "border-primary" : "border-border"
      )}
    >
      <button
        type="button"
        onClick={onBrowse}
        className="group flex w-full flex-col items-center gap-4 px-5 py-10 text-center outline-none sm:py-14 focus-visible:ring-3 focus-visible:ring-ring/50 rounded-2xl"
      >
        <span
          className={cn(
            "flex size-14 items-center justify-center rounded-2xl border bg-background/60 transition-all duration-300",
            "group-hover:-translate-y-0.5 group-hover:border-primary/50",
            isDragActive && "scale-110 border-primary text-primary"
          )}
        >
          <UploadCloudIcon className="size-7 text-primary" />
        </span>
        <span className="space-y-1.5">
          <span className="block text-lg font-semibold tracking-tight sm:text-xl">
            <span className="sm:hidden">Envoyer des fichiers</span>
            <span className="hidden sm:inline">
              Déposez vos fichiers n&apos;importe où sur la page
            </span>
          </span>
          <span className="block text-sm text-muted-foreground">
            <span className="sm:hidden">Touchez pour choisir</span>
            <span className="hidden sm:inline">
              ou{" "}
              <span className="font-medium text-primary underline-offset-4 group-hover:underline">
                parcourez votre appareil
              </span>
            </span>
            {" "}— jusqu&apos;à {formatFileSize(CLIENT_CONFIG.maxFileSize)} par fichier
          </span>
        </span>
      </button>

      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t bg-background/30 px-4 py-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <ZapIcon className="size-3.5 text-primary" />
          {CLIENT_CONFIG.parallelUploads} envois en parallèle
        </span>
        <span className="inline-flex items-center gap-1.5">
          <RotateCcwIcon className="size-3.5 text-primary" />
          Reprise automatique après coupure
        </span>
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheckIcon className="size-3.5 text-primary" />
          Liens avec expiration
        </span>
      </div>
    </section>
  );
}

/** Voile plein écran affiché pendant un glisser-déposer. */
export function DropOverlay({ visible }: { visible: boolean }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm transition-opacity duration-150",
        visible ? "opacity-100" : "opacity-0"
      )}
    >
      <div className="m-4 flex w-full max-w-lg flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-primary bg-card/80 px-6 py-14 text-center">
        <UploadCloudIcon className="size-10 text-primary" />
        <p className="text-lg font-semibold">Lâchez pour envoyer</p>
        <p className="text-sm text-muted-foreground">
          Les fichiers partent immédiatement, {CLIENT_CONFIG.parallelUploads} à la fois
        </p>
      </div>
    </div>
  );
}
