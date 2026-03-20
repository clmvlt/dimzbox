import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { nanoid } from "nanoid";
import path from "node:path";
import fs from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

export async function POST(request: NextRequest) {
  try {
    const user = await getOrCreateUser();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return Response.json({ error: "Aucun fichier fourni" }, { status: 400 });
    }

    // Vérifier la taille
    if (file.size > config.upload.maxFileSize) {
      return Response.json(
        { error: "Fichier trop volumineux (max 100 Go)" },
        { status: 413 }
      );
    }

    // Vérifier les extensions bloquées
    const ext = path.extname(file.name).toLowerCase();
    if ((config.upload.blockedExtensions as readonly string[]).includes(ext)) {
      return Response.json(
        { error: "Type de fichier non autorisé" },
        { status: 400 }
      );
    }

    // Vérifier le quota utilisateur
    const currentStorage = await prisma.file.aggregate({
      where: { userId: user.id },
      _sum: { size: true },
    });
    const usedStorage = Number(currentStorage._sum.size ?? 0);
    if (usedStorage + file.size > config.upload.maxStoragePerUser) {
      return Response.json(
        { error: "Quota de stockage dépassé (max 500 Go)" },
        { status: 413 }
      );
    }

    // Vérifier le nombre de fichiers
    const fileCount = await prisma.file.count({
      where: { userId: user.id },
    });
    if (fileCount >= config.upload.maxFilesPerUser) {
      return Response.json(
        { error: "Nombre maximum de fichiers atteint" },
        { status: 413 }
      );
    }

    // Créer le dossier de l'utilisateur
    const uploadDir = path.resolve(config.upload.uploadDir);
    const userDir = path.join(uploadDir, user.id);
    fs.mkdirSync(userDir, { recursive: true });

    // Sauvegarder le fichier
    const storedName = `${nanoid()}${ext}`;
    const filePath = path.join(userDir, storedName);

    const nodeStream = Readable.fromWeb(file.stream() as never);
    const writeStream = fs.createWriteStream(filePath);
    await pipeline(nodeStream, writeStream);

    // Créer l'entrée en base
    const dbFile = await prisma.file.create({
      data: {
        name: storedName,
        originalName: file.name,
        size: BigInt(file.size),
        mimeType: file.type || "application/octet-stream",
        path: filePath,
        userId: user.id,
      },
    });

    return Response.json({
      id: dbFile.id,
      name: dbFile.originalName,
      size: Number(dbFile.size),
      mimeType: dbFile.mimeType,
      createdAt: dbFile.createdAt,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return Response.json(
      { error: "Erreur lors de l'upload" },
      { status: 500 }
    );
  }
}
