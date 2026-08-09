import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "./generated/prisma/client.js";

const defaultDatabaseUrl = `file:${fileURLToPath(
  new URL("../prisma/dev.db", import.meta.url),
)}`;

const createPrismaClient = (
  databaseUrl = process.env.DATABASE_URL ?? defaultDatabaseUrl,
): PrismaClient => {
  const adapter = new PrismaBetterSqlite3({ url: databaseUrl });

  return new PrismaClient({ adapter });
};

export { createPrismaClient };
