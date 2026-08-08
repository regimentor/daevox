import {
  MessageSchema,
  type Api,
  type Message,
  type NewMessageListener,
} from "@daevox/contracts";

class InMemoryApi implements Api {
  private readonly messages: Message[] = [];
  private readonly listeners = new Set<NewMessageListener>();

  async addMessage(message: Message): Promise<void> {
    const parsedMessage = MessageSchema.parse(message);
    this.messages.push(parsedMessage);

    for (const listener of this.listeners) {
      listener(parsedMessage);
    }
  }

  onNewMessage(listener: NewMessageListener): void {
    this.listeners.add(listener);
  }
}

const createApi = (): Api => new InMemoryApi();

export { InMemoryApi, createApi };
