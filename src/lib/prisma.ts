import { PrismaClient } from "@/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";
import path from "node:path";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// LOW-04: Utiliser DATABASE_PATH si défini, sinon process.cwd()
const dbPath = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.resolve(process.cwd(), "prisma/dev.db");
const dbUrl = `file:${dbPath}`;

const adapter = new PrismaLibSql({ url: dbUrl });

// DB-03: Enable WAL mode for better concurrent read performance
try {
  const walClient = createClient({ url: dbUrl });
  walClient
    .execute("PRAGMA journal_mode=WAL")
    .then(() => walClient.close())
    .catch(() => walClient.close());
} catch {
  // Ignore WAL setup errors - not critical
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
