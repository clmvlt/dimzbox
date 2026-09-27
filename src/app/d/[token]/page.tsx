import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { formatDate, formatFileSize, getFileTypeLabel } from "@/lib/format";
import { getFileStyle } from "@/lib/file-icons";
import { getLinkStatus } from "@/lib/share";
import { DownloadButton } from "./download-button";
import {
  BoxIcon,
  AlertTriangleIcon,
  ClockIcon,
  DownloadIcon,
  InfinityIcon,
} from "lucide-react";
import { FileIcon } from "@/components/file-icon";
import { cache } from "react";
import Link from "next/link";

type Props = {
  params: Promise<{ token: string }>;
};

// NEXT-02: Dédupliquer la requête Prisma entre generateMetadata et le rendu
const getShareLink = cache((token: string) =>
  prisma.shareLink.findUnique({
    where: { token },
    include: { file: true },
  })
);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const link = await getShareLink(token);

  if (!link) {
    return {
      title: "Fichier introuvable — DimzBox",
      description: "Ce lien de partage n'existe pas.",
    };
  }

  const fileName = link.file.originalName;
  const description = `${getFileTypeLabel(link.file.mimeType)} · ${formatFileSize(Number(link.file.size))}`;
  const style = getFileStyle(fileName, link.file.mimeType);

  return {
    title: `${fileName} — DimzBox`,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title: fileName,
      description: `${description} · Cliquer pour télécharger`,
      siteName: "DimzBox",
      type: "website",
      locale: "fr_FR",
    },
    twitter: {
      card: "summary_large_image",
      title: fileName,
      description,
    },
    other: {
      "theme-color": style.ogText,
    },
  };
}

function daysLeft(date: Date) {
  const days = Math.ceil((date.getTime() - Date.now()) / 86_400_000);
  if (days <= 1) {
    const hours = Math.max(1, Math.ceil((date.getTime() - Date.now()) / 3_600_000));
    return `${hours} h`;
  }
  return `${days} jours`;
}

export default async function DownloadPage({ params }: Props) {
  const { token } = await params;
  const link = await getShareLink(token);

  if (!link) {
    notFound();
  }

  const status = getLinkStatus(link);
  const fileSize = formatFileSize(Number(link.file.size));
  const fileType = getFileTypeLabel(link.file.mimeType);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <Link
          href="/"
          className="flex items-center justify-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
        >
          <span className="flex size-6 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <BoxIcon className="size-3.5" />
          </span>
          <span className="text-sm font-semibold tracking-tight">DimzBox</span>
        </Link>

        <div className="hero-glow space-y-6 rounded-2xl border p-6 shadow-xl shadow-black/20">
          <div className="flex flex-col items-center gap-4 text-center">
            <FileIcon
              fileName={link.file.originalName}
              mimeType={link.file.mimeType}
              size="lg"
            />
            <div className="w-full min-w-0">
              <h1
                className="text-lg font-semibold leading-snug break-words"
                title={link.file.originalName}
              >
                {link.file.originalName}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {fileType} · {fileSize}
              </p>
            </div>
          </div>

          {status.active ? (
            <DownloadButton token={token} fileName={link.file.originalName} />
          ) : (
            <div className="flex items-center gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangleIcon className="size-4 shrink-0" />
              <span>
                {status.expired
                  ? "Ce lien de partage a expiré."
                  : "Le nombre maximum de téléchargements a été atteint."}
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl border bg-background/40 px-3 py-2">
              <p className="flex items-center gap-1 text-muted-foreground">
                <DownloadIcon className="size-3" /> Téléchargements
              </p>
              <p className="mt-0.5 flex items-center gap-1 font-medium tabular-nums">
                {status.unlimited ? (
                  <>
                    {link.downloadCount}
                    <span className="text-muted-foreground">·</span>
                    <InfinityIcon className="size-3.5 text-muted-foreground" aria-label="illimité" />
                  </>
                ) : (
                  <>
                    {status.remaining} restant{status.remaining === 1 ? "" : "s"}
                    <span className="font-normal text-muted-foreground">
                      / {link.maxDownloads}
                    </span>
                  </>
                )}
              </p>
            </div>
            <div className="rounded-xl border bg-background/40 px-3 py-2">
              <p className="flex items-center gap-1 text-muted-foreground">
                <ClockIcon className="size-3" /> Expiration
              </p>
              <p
                className="mt-0.5 font-medium tabular-nums"
                title={link.expiresAt ? formatDate(link.expiresAt) : undefined}
              >
                {!link.expiresAt
                  ? "Jamais"
                  : status.expired
                    ? "Expiré"
                    : `Dans ${daysLeft(link.expiresAt)}`}
              </p>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Partagé via{" "}
          <Link href="/" className="underline-offset-4 hover:text-foreground hover:underline">
            DimzBox
          </Link>
        </p>
      </div>
    </div>
  );
}
