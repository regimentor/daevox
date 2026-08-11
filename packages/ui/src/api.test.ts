import type {
  Api,
  CompletionErrorListener,
  DialogSummary,
  Message,
  NewMessageListener,
} from "@daevox/contracts";
import { describe, expect, test, vi } from "vitest";

const message: Message = {
  actor: "agent",
  type: "completion",
  content: "Hi!",
  createdAt: new Date("2026-08-08T10:00:01.000Z"),
};

const dialog: DialogSummary = {
  id: "dialog-1",
  createdAt: new Date("2026-08-08T09:00:00.000Z"),
  updatedAt: new Date("2026-08-08T09:00:00.000Z"),
};

const loadApi = async () => {
  vi.resetModules();
  return import("./api.js");
};

type UiApiInstance = Pick<
  import("./api.js").UiApi,
  | "addMessage"
  | "isConfigured"
  | "onCompletionError"
  | "onNewMessage"
  | "setImplementation"
>;

const createUiApi = async () => {
  const { UiApi } = await loadApi();
  const Constructor = UiApi as unknown as new () => UiApiInstance;

  return new Constructor();
};

const createImplementation = () => {
  const addMessage = vi.fn().mockResolvedValue(undefined);
  const listeners: NewMessageListener[] = [];
  const completionErrorListeners: CompletionErrorListener[] = [];
  const onNewMessage = vi.fn((listener: NewMessageListener) => {
    listeners.push(listener);
  });
  const onCompletionError = vi.fn((listener: CompletionErrorListener) => {
    completionErrorListeners.push(listener);
  });
  const implementation: Api = {
    listDialogs: vi.fn().mockResolvedValue([dialog]),
    createDialog: vi.fn().mockResolvedValue(dialog),
    getDialogMessages: vi.fn().mockResolvedValue([]),
    deleteDialog: vi.fn().mockResolvedValue(undefined),
    getContextInfo: vi.fn().mockResolvedValue({
      model: "test-model",
      contextWindowTokens: 4096,
    }),
    addMessage,
    onAgentStream: vi.fn(),
    onNewMessage,
    onCompletionError,
  };

  return {
    addMessage,
    completionErrorListeners,
    implementation,
    listeners,
    onCompletionError,
  };
};

describe("UiApi", () => {
  test("is a singleton and uses the local fallback when unconfigured", async () => {
    const { UiApi, uiApi } = await loadApi();
    const listener = vi.fn();

    expect(uiApi).toBe(UiApi.getInstance());
    expect(uiApi.isConfigured()).toBe(false);

    uiApi.onNewMessage(listener);
    await uiApi.addMessage(dialog.id, message);

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith({ dialogId: dialog.id, message });
  });

  test("forwards existing and new listeners to the implementation", async () => {
    const uiApi = await createUiApi();
    const existingListener = vi.fn();
    const newListener = vi.fn();
    const { implementation, listeners } = createImplementation();

    uiApi.onNewMessage(existingListener);
    uiApi.setImplementation(implementation);
    uiApi.onNewMessage(newListener);

    expect(uiApi.isConfigured()).toBe(true);
    expect(listeners).toContain(existingListener);
    expect(listeners).toContain(newListener);
  });

  test("delegates message writes once an implementation is configured", async () => {
    const uiApi = await createUiApi();
    const listener = vi.fn<NewMessageListener>();
    const { addMessage, implementation } = createImplementation();

    uiApi.onNewMessage(listener);
    uiApi.setImplementation(implementation);
    await uiApi.addMessage(dialog.id, message);

    expect(addMessage).toHaveBeenCalledOnce();
    expect(addMessage).toHaveBeenCalledWith(dialog.id, message);
    expect(listener).not.toHaveBeenCalled();
  });

  test("forwards completion error listeners to the implementation", async () => {
    const uiApi = await createUiApi();
    const listener = vi.fn<CompletionErrorListener>();
    const { implementation, completionErrorListeners, onCompletionError } =
      createImplementation();

    uiApi.onCompletionError(listener);
    uiApi.setImplementation(implementation);

    expect(onCompletionError).toHaveBeenCalledOnce();
    expect(completionErrorListeners).toContain(listener);
  });
});
