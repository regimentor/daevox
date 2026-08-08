import {
  type AgentStreamListener,
  MessageSchema,
  type Api,
  type Message,
  type NewMessageListener,
} from "@daevox/contracts";
import { Mutex } from "async-mutex";
import type { DaevoxBridge } from "./rpc.js";

class ElectronApi implements Api {
  private readonly messages: Message[] = [];
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

  addMessage(message: Message): Promise<void> {
    return this.mutex.runExclusive(async () => {
      const parsedMessage = MessageSchema.parse(message);
      const requestId = crypto.randomUUID();
      const history = [...this.messages];

      this.messages.push(parsedMessage);
      this.notifyListeners(parsedMessage);

      const response = await this.bridge.addMessage({
        history,
        message: parsedMessage,
        requestId,
      });
      const parsedResponse = MessageSchema.parse(response);

      this.messages.push(parsedResponse);
      this.notifyListeners(parsedResponse);
    });
  }

  onAgentStream(listener: AgentStreamListener): void {
    this.streamListeners.add(listener);
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
