import { PrismaClient } from "@/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";
import path from "node:path";
import { fileURLToPath } from "node:url";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// LOW-04: Utiliser __dirname au lieu de process.cwd() pour un chemin stable
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, "../../prisma/dev.db");
const dbUrl = `file:${dbPath}`;

const adapter = new PrismaLibSql({ url: dbUrl });

// DB-03: Enable WAL mode for better concurrent read performance
const walClient = createClient({ url: dbUrl });
walClient
  .execute("PRAGMA journal_mode=WAL")
  .then(() => walClient.close())
  .catch(() => walClient.close());

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
