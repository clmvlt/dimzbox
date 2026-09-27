"use client";

import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { DownloadIcon, CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Vrai lien <a download> : le navigateur gère le téléchargement (et sa reprise)
// directement, sans passer par JavaScript.
export function DownloadButton({
  token,
  fileName,
}: {
  token: string;
  fileName: string;
}) {
  const [clicked, setClicked] = useState(false);

  return (
    <a
      href={`/api/download/${token}`}
      download={fileName}
      onClick={() => {
        setClicked(true);
        setTimeout(() => setClicked(false), 4000);
      }}
      className={cn(
        buttonVariants({ size: "lg" }),
        "h-11 w-full text-base transition-all active:scale-[0.98]"
      )}
    >
      {clicked ? <CheckIcon /> : <DownloadIcon />}
      {clicked ? "Téléchargement lancé" : "Télécharger"}
    </a>
  );
}
