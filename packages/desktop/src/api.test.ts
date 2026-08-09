import type { AgentStreamEvent, Message } from "@daevox/contracts";
import { describe, expect, test, vi } from "vitest";
import { ElectronApi, createApi } from "./api.js";

const message: Message = {
  actor: "user",
  type: "completion",
  content: "Hello",
  createdAt: new Date("2026-08-08T10:00:00.000Z"),
};

const dialog = {
  id: "dialog-1",
  createdAt: new Date("2026-08-08T09:00:00.000Z"),
  updatedAt: new Date("2026-08-08T09:00:00.000Z"),
};

describe("ElectronApi", () => {
  test("delegates dialog operations and validates returned data", async () => {
    const listDialogs = vi.fn().mockResolvedValue([dialog]);
    const createDialog = vi.fn().mockResolvedValue(dialog);
    const getDialogMessages = vi.fn().mockResolvedValue([message]);
    const deleteDialog = vi.fn().mockResolvedValue(undefined);
    const api = new ElectronApi({
      listDialogs,
      createDialog,
      getDialogMessages,
      deleteDialog,
      addMessage: vi.fn(),
      onAgentStream: vi.fn(),
    });

    await expect(api.listDialogs()).resolves.toEqual([dialog]);
    await expect(api.createDialog()).resolves.toEqual(dialog);
    await expect(api.getDialogMessages(dialog.id)).resolves.toEqual([message]);
    await api.deleteDialog(dialog.id);

    expect(listDialogs).toHaveBeenCalledOnce();
    expect(createDialog).toHaveBeenCalledOnce();
    expect(getDialogMessages).toHaveBeenCalledWith(dialog.id);
    expect(deleteDialog).toHaveBeenCalledWith(dialog.id);
  });

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
      listDialogs: vi.fn().mockResolvedValue([dialog]),
      createDialog: vi.fn().mockResolvedValue(dialog),
      getDialogMessages: vi.fn().mockResolvedValue([]),
      deleteDialog: vi.fn().mockResolvedValue(undefined),
      addMessage,
      onAgentStream: vi.fn(),
    });
    const listener = vi.fn();

    api.onNewMessage(listener);
    const pending = api.addMessage(dialog.id, message);

    await Promise.resolve();
    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith({ dialogId: dialog.id, message });
    expect(addMessage).toHaveBeenCalledWith({
      message,
      dialogId: dialog.id,
      requestId: expect.any(String),
    });

    resolveResponse(response);
    await pending;

    expect(listener).toHaveBeenNthCalledWith(1, {
      dialogId: dialog.id,
      message,
    });
    expect(listener).toHaveBeenNthCalledWith(2, {
      dialogId: dialog.id,
      message: response,
    });
  });

  test("forwards agent stream events to subscribers", () => {
    let notifyStream!: (event: AgentStreamEvent) => void;
    const api = new ElectronApi({
      listDialogs: vi.fn().mockResolvedValue([]),
      createDialog: vi.fn(),
      getDialogMessages: vi.fn().mockResolvedValue([]),
      deleteDialog: vi.fn().mockResolvedValue(undefined),
      addMessage: vi.fn(),
      onAgentStream: (listener) => {
        notifyStream = listener;
      },
    });
    const listener = vi.fn();
    const event = {
      dialogId: dialog.id,
      requestId: "request-1",
      type: "response" as const,
      content: "Hi",
    };

    api.onAgentStream(listener);
    notifyStream(event);

    expect(listener).toHaveBeenCalledWith(event);
  });
});
