import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { formatFileSize, getFileTypeLabel, getFileExtension } from "@/lib/format";
import { getFileStyle } from "@/lib/file-icons";
import { DownloadButton } from "./download-button";
import { BoxIcon, AlertTriangleIcon } from "lucide-react";
import { FileIcon } from "@/components/file-icon";
import { cache } from "react";

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
  const fileSize = formatFileSize(Number(link.file.size));
  const fileType = getFileTypeLabel(link.file.mimeType);
  const ext = getFileExtension(fileName);
  const style = getFileStyle(fileName, link.file.mimeType);

  const description = `${fileType} · ${fileSize}`;

  return {
    title: `${fileName} — DimzBox`,
    description,
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

export default async function DownloadPage({ params }: Props) {
  const { token } = await params;
  const link = await getShareLink(token);

  if (!link) {
    notFound();
  }

  const expired = link.expiresAt && link.expiresAt < new Date();
  const maxedOut =
    link.maxDownloads !== null && link.downloadCount >= link.maxDownloads;
  const unavailable = expired || maxedOut;

  const fileSize = formatFileSize(Number(link.file.size));
  const fileType = getFileTypeLabel(link.file.mimeType);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <BoxIcon className="h-5 w-5" />
          <span className="text-sm font-medium tracking-wide">DimzBox</span>
        </div>

        {/* Card */}
        <div className="border rounded-xl p-6 space-y-5 bg-card">
          <div className="flex items-center gap-4">
            <FileIcon
              fileName={link.file.originalName}
              mimeType={link.file.mimeType}
              size="lg"
            />
            <div className="min-w-0 flex-1">
              <h1 className="font-semibold truncate leading-tight" title={link.file.originalName}>
                {link.file.originalName}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground">{fileType}</span>
                <span className="text-xs text-muted-foreground/40">·</span>
                <span className="text-xs text-muted-foreground">{fileSize}</span>
              </div>
            </div>
          </div>

          {unavailable ? (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <AlertTriangleIcon className="h-4 w-4 shrink-0" />
              <span>
                {expired
                  ? "Ce lien de partage a expiré."
                  : "Le nombre maximum de téléchargements a été atteint."}
              </span>
            </div>
          ) : (
            <DownloadButton token={token} fileName={link.file.originalName} />
          )}

          <p className="text-xs text-center text-muted-foreground tabular-nums">
            {link.downloadCount} téléchargement{link.downloadCount !== 1 ? "s" : ""}
            {link.maxDownloads ? ` sur ${link.maxDownloads}` : ""}
          </p>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          Partagé via DimzBox
        </p>
      </div>
    </div>
  );
}
