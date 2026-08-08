import type { Message } from "@daevox/contracts";
import { describe, expect, test, vi } from "vitest";
import { InMemoryApi, createApi } from "./api.js";

const message: Message = {
  actor: "user",
  type: "completion",
  content: "Hello",
  createdAt: new Date("2026-08-08T10:00:00.000Z"),
};

describe("InMemoryApi", () => {
  test("createApi creates an InMemoryApi", () => {
    expect(createApi()).toBeInstanceOf(InMemoryApi);
  });

  test("notifies registered listeners for each added message", async () => {
    const api = new InMemoryApi();
    const firstListener = vi.fn();
    const secondListener = vi.fn();

    api.onNewMessage(firstListener);
    api.onNewMessage(secondListener);

    await api.addMessage(message);

    expect(firstListener).toHaveBeenCalledOnce();
    expect(firstListener).toHaveBeenCalledWith(message);
    expect(secondListener).toHaveBeenCalledOnce();
    expect(secondListener).toHaveBeenCalledWith(message);
  });

  test("does not notify listeners or store invalid messages", async () => {
    const api = new InMemoryApi();
    const listener = vi.fn();
    const invalidMessage = {
      ...message,
      content: 42,
    } as unknown as Message;

    api.onNewMessage(listener);

    await expect(api.addMessage(invalidMessage)).rejects.toThrow();
    expect(listener).not.toHaveBeenCalled();

    await api.addMessage(message);

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(message);
  });
});
