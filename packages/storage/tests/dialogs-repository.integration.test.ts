import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { DialogsRepository } from "../src/dialogs-repository.js";
import { createTestDatabase } from "./integration-test-utils.js";

describe("DialogsRepository", () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let dialogs: DialogsRepository;

  beforeAll(async () => {
    database = await createTestDatabase();
    dialogs = new DialogsRepository(database.client);
  });

  afterAll(async () => {
    await database.cleanup();
  });

  test("creates, lists newest dialogs first, and deletes dialogs", async () => {
    const olderDialog = await dialogs.create({
      createdAt: new Date("2026-08-09T09:00:00.000Z"),
    });
    const newerDialog = await dialogs.create({
      createdAt: new Date("2026-08-09T10:00:00.000Z"),
    });

    expect(await dialogs.findById(newerDialog.id)).toMatchObject({
      id: newerDialog.id,
    });
    expect(await dialogs.findMany()).toEqual([newerDialog, olderDialog]);

    await dialogs.delete(olderDialog.id);
    expect(await dialogs.findById(olderDialog.id)).toBeNull();
  });
});
