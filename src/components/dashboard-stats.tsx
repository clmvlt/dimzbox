"use client";

import { FileIcon, HardDriveIcon, DownloadIcon, LinkIcon } from "lucide-react";
import { formatFileSize } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface Stats {
  fileCount: number;
  storageUsed: number;
  storageMax: number;
  totalDownloads: number;
  activeLinks: number;
}

export function DashboardStats({ stats }: { stats: Stats }) {
  const storagePercent = stats.storageMax
    ? Math.min(100, (stats.storageUsed / stats.storageMax) * 100)
    : 0;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile icon={HardDriveIcon} label="Stockage" className="col-span-2 lg:col-span-1">
        <div className="flex items-baseline gap-1.5">
          <span className="text-xl font-semibold tabular-nums">
            {formatFileSize(stats.storageUsed)}
          </span>
          <span className="text-xs text-muted-foreground">
            / {formatFileSize(stats.storageMax)}
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-500",
              storagePercent > 90 ? "bg-destructive" : "bg-primary"
            )}
            style={{ width: `${Math.max(storagePercent, stats.storageUsed > 0 ? 1 : 0)}%` }}
          />
        </div>
      </Tile>
      <Tile icon={FileIcon} label="Fichiers">
        <span className="text-xl font-semibold tabular-nums">{stats.fileCount}</span>
      </Tile>
      <Tile icon={DownloadIcon} label="Téléchargements">
        <span className="text-xl font-semibold tabular-nums">{stats.totalDownloads}</span>
      </Tile>
      <Tile icon={LinkIcon} label="Liens actifs" className="hidden lg:block">
        <span className="text-xl font-semibold tabular-nums">{stats.activeLinks}</span>
      </Tile>
    </div>
  );
}

function Tile({
  icon: Icon,
  label,
  className,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-2xl border bg-card px-4 py-3", className)}>
      <p className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </p>
      {children}
    </div>
  );
}
