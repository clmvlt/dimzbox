"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import {
  getUploadQueue,
  isActive,
  type UploadQueue,
  type UploadTask,
} from "@/lib/upload-queue";

const EMPTY: readonly UploadTask[] = [];
const noopSubscribe = () => () => {};

function queueOrNull(): UploadQueue | null {
  return typeof window === "undefined" ? null : getUploadQueue();
}

export function useUploadQueue() {
  const queue = queueOrNull();
  const tasks = useSyncExternalStore(
    queue?.subscribe ?? noopSubscribe,
    queue?.getSnapshot ?? (() => EMPTY),
    () => EMPTY
  );

  const summary = useMemo(() => {
    let totalBytes = 0;
    let doneBytes = 0;
    let speed = 0;
    let active = 0;
    let queued = 0;
    let failed = 0;
    let finished = 0;
    for (const t of tasks) {
      if (isActive(t.status)) {
        totalBytes += t.size;
        doneBytes += t.uploaded;
        speed += t.speed;
        if (t.status === "queued") queued++;
        else active++;
      } else if (t.status === "error") failed++;
      else finished++;
    }
    const remaining = totalBytes - doneBytes;
    return {
      busy: active + queued > 0,
      active,
      queued,
      failed,
      finished,
      totalBytes,
      doneBytes,
      speed,
      percent: totalBytes ? (doneBytes / totalBytes) * 100 : 0,
      eta: speed > 0 ? remaining / speed : null,
    };
  }, [tasks]);

  return { queue, tasks, summary };
}

/** Avertit avant de quitter / recharger la page pendant un envoi. */
export function useWarnBeforeUnload(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [active]);
}
