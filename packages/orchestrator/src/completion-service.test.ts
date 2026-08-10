import { EventEmitter2 } from "@nestjs/event-emitter";
import type {
  DialogMessagesStore,
  Message,
  StoredMessage,
} from "@daevox/contracts";
import { describe, expect, test, vi } from "vitest";
import { CompletionService } from "./completion-service.js";

const userMessage: Message = {
  actor: "user",
  type: "completion",
  content: "Hello",
  createdAt: new Date("2026-08-10T10:00:00.000Z"),
};

const recordsToStore = (initial: Message[] = []) => {
  const records: StoredMessage[] = initial.map((message, index) => ({
    id: `message-${index}`,
    actor: message.actor,
    type: message.type,
    content: message.content,
    createdAt: message.createdAt,
    tools: message.tools ?? null,
    sources: message.sources ?? null,
    metrics: message.metrics ?? null,
  }));
  let nextId = records.length;
  const store: DialogMessagesStore = {
    create: vi.fn(async ({ message }) => {
      const record: StoredMessage = {
        id: `message-${nextId++}`,
        actor: message.actor,
        type: message.type,
        content: message.content,
        createdAt: message.createdAt,
        tools: message.tools ?? null,
        sources: message.sources ?? null,
        metrics: message.metrics ?? null,
      };
      records.push(record);
      return record;
    }),
    findByDialogId: vi.fn(async () => [...records]),
  };
  return { records, store };
};

describe("orchestrator CompletionService", () => {
  test("persists both messages and emits message.created", async () => {
    const { records, store } = recordsToStore();
    const events = new EventEmitter2();
    const created = vi.fn();
    events.on("orchestrator.message.created", created);
    const response: Message = {
      actor: "agent",
      type: "completion",
      content: "Hi",
      createdAt: new Date("2026-08-10T10:00:01.000Z"),
    };
    const service = new CompletionService(
      store,
      events,
      vi.fn().mockResolvedValue(response),
    );

    await expect(service.addMessage("dialog-1", "request-1", userMessage)).resolves.toEqual(response);
    expect(records).toHaveLength(2);
    expect(created).toHaveBeenCalledTimes(2);
    expect(created).toHaveBeenNthCalledWith(1, {
      dialogId: "dialog-1",
      requestId: "request-1",
      message: userMessage,
    });
  });

  test("uses prior records as history and stores a fallback on failure", async () => {
    const previous: Message = { ...userMessage, content: "Prior" };
    const { records, store } = recordsToStore([previous]);
    const complete = vi.fn().mockRejectedValue(new Error("model unavailable"));
    const service = new CompletionService(store, new EventEmitter2(), complete);

    const response = await service.addMessage("dialog-1", "request-1", userMessage);

    expect(complete).toHaveBeenCalledWith(
      { history: [previous], message: userMessage },
      expect.objectContaining({ onReasoning: expect.any(Function) }),
    );
    expect(response.content).toContain("Не удалось получить ответ");
    expect(records).toHaveLength(3);
  });

  test("serializes concurrent completions for one dialog", async () => {
    const { store } = recordsToStore();
    let active = 0;
    let maximum = 0;
    const complete = vi.fn(async () => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return { ...userMessage, actor: "agent" as const, content: "Done" };
    });
    const service = new CompletionService(store, new EventEmitter2(), complete);

    await Promise.all([
      service.addMessage("dialog-1", "request-1", userMessage),
      service.addMessage("dialog-1", "request-2", userMessage),
    ]);

    expect(maximum).toBe(1);
  });
});
