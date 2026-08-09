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

  test("creates and lists dialogs", async () => {
    const dialog = await dialogs.create({
      createdAt: new Date("2026-08-09T09:00:00.000Z"),
    });

    expect(await dialogs.findById(dialog.id)).toMatchObject({ id: dialog.id });
    expect(await dialogs.findMany()).toEqual([dialog]);
  });
});
