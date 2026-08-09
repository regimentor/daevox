import {
  type AgentStreamListener,
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
  private readonly mutex = new Mutex();

  constructor(private readonly bridge: DaevoxBridge) {
    bridge.onAgentStream((event) => {
      for (const listener of this.streamListeners) {
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

  addMessage(dialogId: string, message: Message): Promise<void> {
    return this.mutex.runExclusive(async () => {
      const parsedMessage = MessageSchema.parse(message);
      const requestId = crypto.randomUUID();

      this.notifyListeners({ dialogId, message: parsedMessage });

      const response = await this.bridge.addMessage({
        dialogId,
        message: parsedMessage,
        requestId,
      });
      const parsedResponse = MessageSchema.parse(response);

      this.notifyListeners({ dialogId, message: parsedResponse });
    });
  }

  onAgentStream(listener: AgentStreamListener): void {
    this.streamListeners.add(listener);
  }

  onNewMessage(listener: NewMessageListener): void {
    this.listeners.add(listener);
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
