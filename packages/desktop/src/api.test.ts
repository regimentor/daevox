import type { AgentStreamEvent, Message } from "@daevox/contracts";
import { describe, expect, test, vi } from "vitest";
import { ElectronApi, createApi } from "./api.js";

const message: Message = {
  actor: "user",
  type: "completion",
  content: "Hello",
  createdAt: new Date("2026-08-08T10:00:00.000Z"),
};

describe("ElectronApi", () => {
  test("requires the Electron preload bridge", () => {
    expect(() => createApi()).toThrow("Electron API bridge is unavailable");
  });

  test("publishes the user message immediately and the agent message after the RPC returns", async () => {
    let resolveResponse!: (response: Message) => void;
    const response: Message = {
      actor: "agent",
      type: "completion",
      content: "Hi!",
      createdAt: new Date("2026-08-08T10:00:01.000Z"),
    };
    const addMessage = vi.fn(
      () =>
        new Promise<Message>((resolve) => {
          resolveResponse = resolve;
        }),
    );
    const api = new ElectronApi({
      addMessage,
      onAgentStream: vi.fn(),
    });
    const listener = vi.fn();

    api.onNewMessage(listener);
    const pending = api.addMessage(message);

    await Promise.resolve();
    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(message);
    expect(addMessage).toHaveBeenCalledWith({
      history: [],
      message,
      requestId: expect.any(String),
    });

    resolveResponse(response);
    await pending;

    expect(listener).toHaveBeenNthCalledWith(1, message);
    expect(listener).toHaveBeenNthCalledWith(2, response);
  });

  test("forwards agent stream events to subscribers", () => {
    let notifyStream!: (event: AgentStreamEvent) => void;
    const api = new ElectronApi({
      addMessage: vi.fn(),
      onAgentStream: (listener) => {
        notifyStream = listener;
      },
    });
    const listener = vi.fn();
    const event = {
      requestId: "request-1",
      type: "response" as const,
      content: "Hi",
    };

    api.onAgentStream(listener);
    notifyStream(event);

    expect(listener).toHaveBeenCalledWith(event);
  });
});
