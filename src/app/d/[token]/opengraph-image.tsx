import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { formatFileSize, getFileTypeLabel, getFileExtension } from "@/lib/format";
import { getFileStyle } from "@/lib/file-icons";

export const alt = "DimzBox";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const link = await prisma.shareLink.findUnique({
    where: { token },
    include: { file: true },
  });

  if (!link) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#0a0a0a",
            color: "#52525b",
            fontSize: 28,
            fontFamily: "sans-serif",
          }}
        >
          Fichier introuvable
        </div>
      ),
      { ...size }
    );
  }

  const fileName = link.file.originalName;
  const fileSize = formatFileSize(Number(link.file.size));
  const fileType = getFileTypeLabel(link.file.mimeType);
  const ext = getFileExtension(fileName);
  const style = getFileStyle(fileName, link.file.mimeType);

  // Tronquer le nom si trop long
  const displayName =
    fileName.length > 38 ? fileName.slice(0, 35) + "..." : fileName;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#09090b",
          fontFamily: "sans-serif",
          padding: 80,
        }}
      >
        {/* Barre colorée à gauche */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            bottom: 0,
            width: 6,
            background: style.ogText,
          }}
        />

        {/* Contenu principal — layout horizontal */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 48,
            width: "100%",
          }}
        >
          {/* Badge extension */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 140,
              height: 140,
              borderRadius: 32,
              background: style.ogBg,
              border: `2px solid ${style.ogBorder}`,
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: ext.length > 4 ? 28 : 36,
                fontWeight: 800,
                color: style.ogText,
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              {ext || "?"}
            </span>
          </div>

          {/* Infos fichier */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              flex: 1,
              minWidth: 0,
            }}
          >
            {/* Nom du fichier */}
            <span
              style={{
                fontSize: 42,
                fontWeight: 700,
                color: "#fafafa",
                lineHeight: 1.2,
              }}
            >
              {displayName}
            </span>

            {/* Type + taille */}
            <span
              style={{
                fontSize: 24,
                color: "#71717a",
              }}
            >
              {fileType} · {fileSize}
            </span>
          </div>
        </div>

        {/* DimzBox en bas à droite */}
        <span
          style={{
            position: "absolute",
            bottom: 32,
            right: 40,
            fontSize: 18,
            color: "#3f3f46",
          }}
        >
          dimzbox
        </span>
      </div>
    ),
    { ...size }
  );
}
