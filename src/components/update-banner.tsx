"use client";

import { useVersionCheck } from "@/hooks/use-version-check";
import { Button } from "@/components/ui/button";
import { RefreshCwIcon, XIcon } from "lucide-react";
import { useState } from "react";

/**
 * `busy` : des envois sont en cours. Recharger les interromprait, donc on
 * propose la mise à jour seulement une fois qu'ils sont terminés.
 */
export function UpdateBanner({ busy = false }: { busy?: boolean }) {
  const { updateAvailable, clientVersion, serverVersion, refresh } =
    useVersionCheck();
  const [dismissed, setDismissed] = useState(false);

  if (!updateAvailable || dismissed) return null;

  return (
    <div className="border-b border-primary/20 bg-primary/10">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-2">
        <p className="min-w-0 text-xs sm:text-sm">
          <span className="font-medium">Nouvelle version disponible</span>
          <span className="ml-2 text-[10px] text-muted-foreground tabular-nums sm:text-xs">
            {clientVersion} → {serverVersion}
          </span>
          {busy && (
            <span className="ml-2 hidden text-xs text-muted-foreground sm:inline">
              — rechargez après vos envois
            </span>
          )}
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button size="sm" onClick={refresh} disabled={busy}>
            <RefreshCwIcon />
            Recharger
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setDismissed(true)}
            aria-label="Masquer"
          >
            <XIcon />
          </Button>
        </div>
      </div>
    </div>
  );
}
