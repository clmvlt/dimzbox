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
      <div className="container mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
        <p className="text-sm">
          <span className="font-medium">Nouvelle version disponible</span>
          <span className="text-muted-foreground ml-2 text-xs tabular-nums">
            {clientVersion} → {serverVersion}
          </span>
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={refresh}>
            <RefreshCwIcon className="h-3.5 w-3.5 mr-1.5" />
            Rafraîchir
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
