import {
  MessageSchema,
  type Api,
  type Message,
  type NewMessageListener,
} from "@daevox/contracts";
import { Mutex } from "async-mutex";
import type { DaevoxBridge } from "./rpc.js";

class ElectronApi implements Api {
  private readonly messages: Message[] = [];
  private readonly listeners = new Set<NewMessageListener>();
  private readonly mutex = new Mutex();

  constructor(private readonly bridge: DaevoxBridge) {}

  addMessage(message: Message): Promise<void> {
    return this.mutex.runExclusive(async () => {
      const parsedMessage = MessageSchema.parse(message);
      const response = await this.bridge.addMessage({
        history: [...this.messages],
        message: parsedMessage,
      });
      const parsedResponse = MessageSchema.parse(response);

      this.messages.push(parsedMessage, parsedResponse);
      this.notifyListeners(parsedMessage);
      this.notifyListeners(parsedResponse);
    });
  }

  onNewMessage(listener: NewMessageListener): void {
    this.listeners.add(listener);
  }

  private notifyListeners(message: Message): void {
    for (const listener of this.listeners) {
      listener(message);
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
