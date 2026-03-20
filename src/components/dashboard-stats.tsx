"use client";

import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatFileSize } from "@/lib/format";
import {
  FileIcon,
  HardDriveIcon,
  DownloadIcon,
  LinkIcon,
} from "lucide-react";

export interface Stats {
  fileCount: number;
  storageUsed: number;
  storageMax: number;
  totalDownloads: number;
  activeLinks: number;
}

export function DashboardStats({ stats }: { stats: Stats }) {
  // MEM-02: Memoize le calcul de pourcentage
  const storagePercent = useMemo(
    () =>
      stats.storageMax
        ? Math.round((stats.storageUsed / stats.storageMax) * 100)
        : 0,
    [stats.storageUsed, stats.storageMax]
  );

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Fichiers
          </CardTitle>
          <FileIcon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold tabular-nums">
            {stats.fileCount}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Stockage
          </CardTitle>
          <HardDriveIcon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold tabular-nums">
            {formatFileSize(stats.storageUsed)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            sur {formatFileSize(stats.storageMax)}
          </p>
          <Progress className="mt-2" value={storagePercent} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Téléchargements
          </CardTitle>
          <DownloadIcon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold tabular-nums">
            {stats.totalDownloads}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Liens actifs
          </CardTitle>
          <LinkIcon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold tabular-nums">
            {stats.activeLinks}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
