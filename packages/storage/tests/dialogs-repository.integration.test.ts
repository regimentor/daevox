import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { DialogsRepository } from "../src/dialogs-repository.js";
import { DialogsMessagesRepository } from "../src/dialogs-messages-repository.js";
import { createTestDatabase } from "./integration-test-utils.js";

describe("DialogsRepository", () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let dialogs: DialogsRepository;
  let messages: DialogsMessagesRepository;

  beforeAll(async () => {
    database = await createTestDatabase();
    dialogs = new DialogsRepository(database.client);
    messages = new DialogsMessagesRepository(database.client);
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
      memoryGroomed: false,
    });
    expect(await dialogs.findMany()).toEqual([newerDialog, olderDialog]);

    await dialogs.delete(olderDialog.id);
    expect(await dialogs.findById(olderDialog.id)).toBeNull();
  });

  test("finds and marks the newest ungroomed dialog that has messages", async () => {
    const olderDialog = await dialogs.create({
      createdAt: new Date("2026-08-09T11:00:00.000Z"),
    });
    const newerDialog = await dialogs.create({
      createdAt: new Date("2026-08-09T12:00:00.000Z"),
    });
    const emptyDialog = await dialogs.create({
      createdAt: new Date("2026-08-09T13:00:00.000Z"),
    });

    await messages.create({
      dialogId: olderDialog.id,
      message: {
        actor: "user",
        type: "user",
        content: "Older",
        createdAt: new Date("2026-08-09T11:00:01.000Z"),
      },
    });
    await messages.create({
      dialogId: newerDialog.id,
      message: {
        actor: "user",
        type: "user",
        content: "Newer",
        createdAt: new Date("2026-08-09T12:00:01.000Z"),
      },
    });

    expect(await dialogs.findLatestUngroomedWithMessages()).toMatchObject({
      id: newerDialog.id,
      memoryGroomed: false,
    });

    await dialogs.markMemoryGroomed(newerDialog.id);

    expect(await dialogs.findLatestUngroomedWithMessages()).toMatchObject({
      id: olderDialog.id,
    });
    expect(await dialogs.findById(newerDialog.id)).toMatchObject({
      memoryGroomed: true,
    });
    expect(await dialogs.findById(emptyDialog.id)).toMatchObject({
      memoryGroomed: false,
    });
  });
});
