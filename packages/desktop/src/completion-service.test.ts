import type {
  Message,
  NextCompletionRequest,
  StoredMessage,
} from "@daevox/contracts";
import { describe, expect, test, vi } from "vitest";
import { CompletionService } from "./completion-service.js";

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
};

const toStoredMessage = (id: string, message: Message): StoredMessage => ({
  id,
  actor: message.actor,
  type: message.type,
  content: message.content,
  createdAt: message.createdAt,
  tools: message.tools ?? null,
  sources: message.sources ?? null,
  metrics: message.metrics ?? null,
});

const createStore = (initial: StoredMessage[] = []) => {
  const records = [...initial];
  let nextId = 1;
  const create = vi.fn(async ({ message }: { message: Message }) => {
    const record = toStoredMessage(`message-${nextId++}`, message);
    records.push(record);
    return record;
  });
  const findByDialogId = vi.fn(async () => [...records]);

  return { records, create, findByDialogId };
};

describe("CompletionService", () => {
  test("persists the user message, reads prior history, completes, and persists the response", async () => {
    const store = createStore([
      toStoredMessage("previous-user", userMessage),
      toStoredMessage("previous-agent", agentMessage),
    ]);
    const complete = vi.fn(
      async ({ history, message }: NextCompletionRequest) => {
        expect(history).toEqual([userMessage, agentMessage]);
        expect(message).toEqual({
          ...userMessage,
          content: "Next message",
        });
        return agentMessage;
      },
    );
    const service = new CompletionService("dialog-1", store, complete);

    const nextMessage = { ...userMessage, content: "Next message" };
    await expect(service.addMessage(nextMessage)).resolves.toEqual(
      agentMessage,
    );

    expect(store.create).toHaveBeenCalledTimes(2);
    expect(store.create).toHaveBeenNthCalledWith(1, {
      dialogId: "dialog-1",
      message: nextMessage,
    });
    expect(store.create).toHaveBeenNthCalledWith(2, {
      dialogId: "dialog-1",
      message: agentMessage,
    });
    expect(store.findByDialogId).toHaveBeenCalledWith("dialog-1");
    expect(complete).toHaveBeenCalledOnce();
  });

  test("does not call the agent when reading storage fails", async () => {
    const store = createStore();
    const storageError = new Error("database unavailable");
    store.findByDialogId.mockRejectedValue(storageError);
    const complete = vi.fn();
    const service = new CompletionService("dialog-1", store, complete);

    await expect(service.addMessage(userMessage)).rejects.toBe(storageError);
    expect(complete).not.toHaveBeenCalled();
    expect(store.create).toHaveBeenCalledOnce();
  });

  test("stores a fallback response when completion fails", async () => {
    const store = createStore();
    const complete = vi.fn().mockRejectedValue(new Error("model unavailable"));
    const service = new CompletionService("dialog-1", store, complete);

    const response = await service.addMessage(userMessage);

    expect(response.actor).toBe("agent");
    expect(response.content).toContain("Не удалось получить ответ");
    expect(store.records).toHaveLength(2);
    expect(store.records[1]?.content).toBe(response.content);
  });
});
