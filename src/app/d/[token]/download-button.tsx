"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DownloadIcon, CheckIcon } from "lucide-react";

export function DownloadButton({
  token,
  fileName,
}: {
  token: string;
  fileName: string;
}) {
  const [clicked, setClicked] = useState(false);

  function handleDownload() {
    setClicked(true);
    const a = document.createElement("a");
    a.href = `/api/download/${token}`;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => setClicked(false), 3000);
  }

  return (
    <Button
      onClick={handleDownload}
      className="w-full transition-all duration-200 active:scale-[0.98]"
      size="lg"
    >
      <span
        className={`inline-flex items-center gap-2 transition-all duration-200 ${clicked ? "scale-105" : ""}`}
      >
        {clicked ? (
          <CheckIcon className="h-4 w-4" />
        ) : (
          <DownloadIcon className="h-4 w-4" />
        )}
        {clicked ? "Téléchargement lancé" : "Télécharger"}
      </span>
    </Button>
  );
}
