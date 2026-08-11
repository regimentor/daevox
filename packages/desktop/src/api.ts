import {
  type AgentStreamListener,
  type CompletionErrorListener,
  ContextInfoSchema,
  type ContextInfo,
  DialogSummarySchema,
  MessageSchema,
  type Api,
  type DialogSummary,
  type Message,
  type NewMessageEvent,
  type NewMessageListener,
} from "@daevox/contracts";
import { Mutex } from "async-mutex";
import type { DaevoxBridge } from "./rpc.js";

class ElectronApi implements Api {
  private readonly streamListeners = new Set<AgentStreamListener>();
  private readonly listeners = new Set<NewMessageListener>();
  private readonly completionErrorListeners =
    new Set<CompletionErrorListener>();
  private readonly mutex = new Mutex();
  private readonly pendingRequests = new Set<string>();
  private readonly deliveredResponses = new Set<string>();

  constructor(private readonly bridge: DaevoxBridge) {
    bridge.onAgentStream((event) => {
      for (const listener of this.streamListeners) {
        listener(event);
      }
    });
    bridge.onNewMessage?.((event) => {
      const requestId = event.requestId;
      if (event.message.actor === "user" && requestId) {
        if (this.pendingRequests.has(requestId)) return;
      }
      if (event.message.actor === "agent" && requestId) {
        if (this.deliveredResponses.has(requestId)) return;
        this.deliveredResponses.add(requestId);
      }
      this.notifyListeners(event);
    });
    bridge.onCompletionError?.((event) => {
      for (const listener of this.completionErrorListeners) {
        listener(event);
      }
    });
  }

  listDialogs(): Promise<DialogSummary[]> {
    return this.bridge
      .listDialogs()
      .then((dialogs) =>
        dialogs.map((dialog) => DialogSummarySchema.parse(dialog)),
      );
  }

  createDialog(): Promise<DialogSummary> {
    return this.bridge
      .createDialog()
      .then((dialog) => DialogSummarySchema.parse(dialog));
  }

  getDialogMessages(dialogId: string): Promise<Message[]> {
    return this.bridge
      .getDialogMessages(dialogId)
      .then((messages) =>
        messages.map((message) => MessageSchema.parse(message)),
      );
  }

  deleteDialog(dialogId: string): Promise<void> {
    return this.bridge.deleteDialog(dialogId);
  }

  getContextInfo(): Promise<ContextInfo> {
    return this.bridge
      .getContextInfo()
      .then((contextInfo) => ContextInfoSchema.parse(contextInfo));
  }

  addMessage(dialogId: string, message: Message): Promise<void> {
    return this.mutex.runExclusive(async () => {
      const parsedMessage = MessageSchema.parse(message);
      const requestId = crypto.randomUUID();
      this.pendingRequests.add(requestId);

      this.notifyListeners({ dialogId, message: parsedMessage });
      try {
        const response = await this.bridge.addMessage({
          dialogId,
          message: parsedMessage,
          requestId,
        });
        const parsedResponse = MessageSchema.parse(response);
        if (!this.deliveredResponses.has(requestId)) {
          this.deliveredResponses.add(requestId);
          this.notifyListeners({ dialogId, message: parsedResponse });
        }
        setTimeout(() => this.deliveredResponses.delete(requestId), 60_000);
      } finally {
        this.pendingRequests.delete(requestId);
      }
    });
  }

  onAgentStream(listener: AgentStreamListener): void {
    this.streamListeners.add(listener);
  }

  onNewMessage(listener: NewMessageListener): void {
    this.listeners.add(listener);
  }

  onCompletionError(listener: CompletionErrorListener): void {
    this.completionErrorListeners.add(listener);
  }

  private notifyListeners(event: NewMessageEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

const createApi = (): Api => {
  if (typeof window === "undefined" || !window.daevox) {
    throw new Error("Electron API bridge is unavailable");
  }

  return new ElectronApi(window.daevox);
};

export { ElectronApi, createApi };
