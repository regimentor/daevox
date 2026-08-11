import { afterAll, beforeAll, describe, expect, test } from "vitest";
import type { Message } from "@daevox/contracts";
import { DialogsMessagesRepository } from "../src/dialogs-messages-repository.js";
import { DialogsRepository } from "../src/dialogs-repository.js";
import { createTestDatabase } from "./integration-test-utils.js";

const userMessage: Message = {
  actor: "user",
  type: "completion",
  content: "Hello",
  createdAt: new Date("2026-08-09T10:00:00.000Z"),
};

const agentMessage: Message = {
  actor: "agent",
  type: "completion",
  content: "Hi!",
  createdAt: new Date("2026-08-09T10:00:01.000Z"),
  tools: [
    {
      toolCallId: "tool-1",
      name: "web_search",
      input: "daevox",
      status: "complete",
      durationMs: 42,
      error: "",
    },
  ],
  sources: [
    {
      sourceId: "source-1",
      title: "Daevox",
      url: "https://example.com/daevox",
      domain: "example.com",
    },
  ],
  metrics: {
    completionTokens: 10,
    durationMs: 100,
    tokensPerSecond: 100,
    estimated: false,
  },
  memory: {
    status: "complete",
    query: "GPU",
    durationMs: 12,
    resultCount: 1,
    results: [{ title: "Hardware", path: "hardware.md" }],
    error: "",
  },
};

describe("DialogsMessagesRepository", () => {
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

  test("stores the complete message payload and preserves history order", async () => {
    const dialog = await dialogs.create();

    await messages.create({ dialogId: dialog.id, message: agentMessage });
    await messages.create({ dialogId: dialog.id, message: userMessage });

    const history = await messages.findByDialogId(dialog.id);

    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({
      actor: "user",
      content: userMessage.content,
      tools: null,
      sources: null,
      metrics: null,
    });
    expect(history[1]).toMatchObject({
      actor: "agent",
      content: agentMessage.content,
      tools: agentMessage.tools,
      sources: agentMessage.sources,
      metrics: agentMessage.metrics,
      memory: agentMessage.memory,
    });
  });

  test("deletes messages by dialog and cascades on dialog deletion", async () => {
    const dialog = await dialogs.create();
    const message = await messages.create({
      dialogId: dialog.id,
      message: userMessage,
    });

    expect((await messages.deleteByDialogId(dialog.id)).count).toBe(1);
    expect(await messages.findById(message.id)).toBeNull();

    await messages.create({ dialogId: dialog.id, message: userMessage });
    await dialogs.delete(dialog.id);

    expect(await messages.findByDialogId(dialog.id)).toEqual([]);
  });
});
