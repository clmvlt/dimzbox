"use client";

import { useVersionCheck } from "@/hooks/use-version-check";
import { Button } from "@/components/ui/button";
import { RefreshCwIcon, XIcon } from "lucide-react";
import { useState } from "react";

export function UpdateBanner() {
  const { updateAvailable, clientVersion, serverVersion, refresh } =
    useVersionCheck();
  const [dismissed, setDismissed] = useState(false);

  if (!updateAvailable || dismissed) return null;

  return (
    <div className="border-b bg-primary/5 border-primary/20">
      <div className="container mx-auto px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between gap-2 sm:gap-3">
        <p className="text-xs sm:text-sm min-w-0">
          <span className="font-medium">Mise à jour dispo</span>
          <span className="hidden sm:inline font-medium">nible</span>
          <span className="text-muted-foreground ml-1.5 sm:ml-2 text-[10px] sm:text-xs tabular-nums">
            {clientVersion} → {serverVersion}
          </span>
        </p>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <Button size="sm" onClick={refresh} className="h-7 sm:h-8 text-xs sm:text-sm px-2.5 sm:px-3">
            <RefreshCwIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1 sm:mr-1.5" />
            <span className="hidden sm:inline">Rafraîchir</span>
            <span className="sm:hidden">MAJ</span>
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setDismissed(true)}
          >
            <XIcon className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
