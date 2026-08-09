import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { createPrismaClient } from "../src/client.js";

const execFileAsync = promisify(execFile);
const packageRoot = fileURLToPath(new URL("..", import.meta.url));

const createTestDatabase = async () => {
  const databaseDirectory = await mkdtemp(join(tmpdir(), "daevox-storage-"));
  const databaseUrl = `file:${join(databaseDirectory, "test.db")}`;

  await execFileAsync(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["exec", "--", "prisma", "migrate", "deploy"],
    {
      cwd: packageRoot,
      env: { ...process.env, DATABASE_URL: databaseUrl },
    },
  );

  const client = createPrismaClient(databaseUrl);

  return {
    client,
    cleanup: async () => {
      await client.$disconnect();
      await rm(databaseDirectory, { recursive: true, force: true });
    },
  };
};

export { createTestDatabase };
