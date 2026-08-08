import type { Message } from "./message.js";

type NewMessageListener = (message: Message) => void;

interface Api {
  addMessage(message: Message): Promise<void>;
  onNewMessage(listener: NewMessageListener): void;
}

export type { Api, NewMessageListener };
