"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2Icon,
  CircleAlertIcon,
  LinkIcon,
  Loader2Icon,
  RotateCwIcon,
  Trash2Icon,
  WifiOffIcon,
  XIcon,
  ClockIcon,
  HistoryIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileIcon } from "./file-icon";
import {
  formatDuration,
  formatFileSize,
  formatRelative,
  formatSpeed,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  isActive,
  type PendingUpload,
  type UploadedFile,
  type UploadQueue,
  type UploadTask,
} from "@/lib/upload-queue";

interface Summary {
  busy: boolean;
  active: number;
  queued: number;
  failed: number;
  finished: number;
  totalBytes: number;
  doneBytes: number;
  speed: number;
  percent: number;
  eta: number | null;
}

interface UploadQueuePanelProps {
  queue: UploadQueue | null;
  tasks: readonly UploadTask[];
  summary: Summary;
  interrupted: PendingUpload[];
  onResumeInterrupted: () => void;
  onDiscardInterrupted: (id: string) => void;
  onCopyLink: (file: UploadedFile) => void;
}

export function UploadQueuePanel({
  queue,
  tasks,
  summary,
  interrupted,
  onResumeInterrupted,
  onDiscardInterrupted,
  onCopyLink,
}: UploadQueuePanelProps) {
  // Horloge pour les comptes à rebours "nouvelle tentative dans X s"
  const [now, setNow] = useState(() => Date.now());
  const hasRetrying = tasks.some((t) => t.status === "retrying");
  useEffect(() => {
    if (!hasRetrying) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [hasRetrying]);

  const inQueue = new Set(tasks.map((t) => t.uploadId).filter(Boolean));
  const orphans = interrupted.filter((u) => !inQueue.has(u.id));

  if (tasks.length === 0 && orphans.length === 0) return null;

  return (
    <section className="animate-fade-in-up overflow-hidden rounded-2xl border bg-card">
      {tasks.length > 0 && (
        <>
          <header className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pt-4 pb-3 sm:px-5">
            <h2 className="flex items-center gap-2 font-semibold">
              {summary.busy ? (
                <Loader2Icon className="size-4 animate-spin text-primary" />
              ) : summary.failed > 0 ? (
                <CircleAlertIcon className="size-4 text-destructive" />
              ) : (
                <CheckCircle2Icon className="size-4 text-success" />
              )}
              Envois
            </h2>
            <p className="text-xs text-muted-foreground tabular-nums">
              {describeSummary(summary)}
            </p>
            {summary.finished + summary.failed > 0 && (
              <Button
                variant="ghost"
                size="xs"
                className="ml-auto text-muted-foreground"
                onClick={() => queue?.clearFinished()}
              >
                Effacer les terminés
              </Button>
            )}
          </header>

          {summary.busy && (
            <div className="px-4 pb-3 sm:px-5">
              <ProgressBar percent={summary.percent} tone="active" className="h-2" />
              <div className="mt-1.5 flex justify-between text-xs text-muted-foreground tabular-nums">
                <span>
                  {formatFileSize(summary.doneBytes)} / {formatFileSize(summary.totalBytes)}
                </span>
                <span>
                  {summary.speed > 0 && formatSpeed(summary.speed)}
                  {summary.eta !== null && ` · ${formatDuration(summary.eta)} restantes`}
                </span>
              </div>
            </div>
          )}

          <ul className="max-h-[22rem] divide-y overflow-y-auto border-t">
            {tasks.map((task) => (
              <TaskRow
                key={task.key}
                task={task}
                now={now}
                queue={queue}
                onCopyLink={onCopyLink}
              />
            ))}
          </ul>
        </>
      )}

      {orphans.length > 0 && (
        <div className={cn(tasks.length > 0 && "border-t")}>
          <div className="flex flex-wrap items-center gap-2 px-4 pt-4 pb-2 sm:px-5">
            <HistoryIcon className="size-4 text-warning" />
            <h2 className="font-semibold">Envois interrompus</h2>
            <p className="w-full text-xs text-muted-foreground">
              Resélectionnez le même fichier : l&apos;envoi reprendra là où il s&apos;est arrêté.
            </p>
          </div>
          <ul className="divide-y">
            {orphans.map((u) => {
              const percent = u.size ? (u.offset / u.size) * 100 : 0;
              return (
                <li key={u.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <FileIcon fileName={u.name} mimeType={u.mimeType} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" title={u.name}>
                      {u.name}
                    </p>
                    <ProgressBar percent={percent} tone="paused" className="my-1.5 h-1" />
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {Math.floor(percent)} % reçu · {formatFileSize(u.offset)} / {formatFileSize(u.size)}
                      {" · "}
                      {formatRelative(u.updatedAt)}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={onResumeInterrupted}>
                    <RotateCwIcon />
                    <span className="hidden sm:inline">Reprendre</span>
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => onDiscardInterrupted(u.id)}
                    title="Abandonner cet envoi"
                    aria-label="Abandonner cet envoi"
                  >
                    <Trash2Icon className="text-destructive" />
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

function describeSummary(s: Summary) {
  const parts: string[] = [];
  if (s.active) parts.push(`${s.active} en cours`);
  if (s.queued) parts.push(`${s.queued} en attente`);
  if (s.finished) parts.push(`${s.finished} terminé${s.finished > 1 ? "s" : ""}`);
  if (s.failed) parts.push(`${s.failed} en erreur`);
  return parts.join(" · ");
}

function TaskRow({
  task,
  now,
  queue,
  onCopyLink,
}: {
  task: UploadTask;
  now: number;
  queue: UploadQueue | null;
  onCopyLink: (file: UploadedFile) => void;
}) {
  const percent = task.size ? (task.uploaded / task.size) * 100 : 100;
  const active = isActive(task.status);

  return (
    <li className="flex items-center gap-3 px-4 py-3 sm:px-5">
      <FileIcon fileName={task.name} mimeType={task.type} size="sm" />

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className="truncate text-sm font-medium" title={task.name}>
            {task.name}
          </p>
          {task.resumed && active && (
            <span className="shrink-0 rounded bg-primary/15 px-1.5 text-[10px] font-medium text-primary">
              reprise
            </span>
          )}
        </div>

        {task.status !== "done" && task.status !== "canceled" && (
          <ProgressBar
            percent={percent}
            tone={
              task.status === "error"
                ? "error"
                : task.status === "retrying"
                  ? "paused"
                  : task.status === "queued"
                    ? "idle"
                    : "active"
            }
            className="my-1.5 h-1"
          />
        )}

        <p
          className={cn(
            "text-xs tabular-nums",
            task.status === "error" ? "text-destructive" : "text-muted-foreground",
            task.status === "done" && "mt-0.5"
          )}
        >
          <StatusText task={task} percent={percent} now={now} />
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {task.status === "done" && task.result && (
          <Button size="sm" variant="secondary" onClick={() => onCopyLink(task.result!)}>
            <LinkIcon />
            <span className="hidden sm:inline">Copier le lien</span>
          </Button>
        )}
        {(task.status === "error" || task.status === "canceled") && (
          <Button size="sm" variant="outline" onClick={() => queue?.retry(task.key)}>
            <RotateCwIcon />
            <span className="hidden sm:inline">Réessayer</span>
          </Button>
        )}
        {active ? (
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => queue?.cancel(task.key)}
            title="Annuler"
            aria-label={`Annuler l'envoi de ${task.name}`}
          >
            <XIcon />
          </Button>
        ) : (
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => queue?.dismiss(task.key)}
            title="Retirer de la liste"
            aria-label="Retirer de la liste"
            className="text-muted-foreground"
          >
            <XIcon />
          </Button>
        )}
      </div>
    </li>
  );
}

function StatusText({
  task,
  percent,
  now,
}: {
  task: UploadTask;
  percent: number;
  now: number;
}) {
  switch (task.status) {
    case "queued":
      return (
        <span className="inline-flex items-center gap-1">
          <ClockIcon className="size-3" /> En attente · {formatFileSize(task.size)}
        </span>
      );
    case "uploading": {
      const eta = task.speed > 0 ? (task.size - task.uploaded) / task.speed : null;
      return (
        <>
          {Math.floor(percent)} % · {formatFileSize(task.uploaded)} / {formatFileSize(task.size)}
          {task.speed > 0 && ` · ${formatSpeed(task.speed)}`}
          {eta !== null && ` · ${formatDuration(eta)}`}
        </>
      );
    }
    case "retrying": {
      // `now` peut dater d'avant le début de l'attente : on borne par sa durée
      const left = task.retryAt ? Math.min(task.retryAt - now, task.retryDelay) : 0;
      const seconds = Math.max(0, Math.ceil(left / 1000));
      return (
        <span className="inline-flex items-center gap-1 text-warning">
          <WifiOffIcon className="size-3" />
          Connexion perdue à {Math.floor(percent)} % —{" "}
          {seconds > 0 ? `nouvelle tentative dans ${seconds} s` : "reconnexion…"}
        </span>
      );
    }
    case "done":
      return (
        <span className="inline-flex items-center gap-1 text-success">
          <CheckCircle2Icon className="size-3" /> Envoyé · {formatFileSize(task.size)}
        </span>
      );
    case "canceled":
      return <>Annulé</>;
    case "error":
      return <>{task.error}</>;
  }
}

function ProgressBar({
  percent,
  tone,
  className,
}: {
  percent: number;
  tone: "active" | "paused" | "error" | "idle";
  className?: string;
}) {
  return (
    <div
      className={cn("w-full overflow-hidden rounded-full bg-muted", className)}
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-300 ease-out",
          tone === "active" && "progress-active bg-primary",
          tone === "paused" && "bg-warning",
          tone === "error" && "bg-destructive",
          tone === "idle" && "bg-muted-foreground/30"
        )}
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
      />
    </div>
  );
}
