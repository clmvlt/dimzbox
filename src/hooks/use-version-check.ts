"use client";

import { useEffect, useRef, useState } from "react";

const CLIENT_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";
const POLL_INTERVAL = 30_000; // 30 secondes

export function useVersionCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [serverVersion, setServerVersion] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function check() {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (data.version && data.version !== CLIENT_VERSION) {
          setServerVersion(data.version);
          setUpdateAvailable(true);
          // Arrêter le poll une fois la mise à jour détectée
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      } catch {
        // Silencieux — on réessaiera au prochain tick
      }
    }

    // Premier check après un court délai (pas au mount pour ne pas bloquer)
    const timeout = setTimeout(check, 5_000);
    // Puis poll régulier
    intervalRef.current = setInterval(check, POLL_INTERVAL);

    return () => {
      clearTimeout(timeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return {
    updateAvailable,
    clientVersion: CLIENT_VERSION,
    serverVersion,
    refresh: () => window.location.reload(),
  };
}
