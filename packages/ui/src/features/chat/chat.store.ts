import { createEvent, createStore } from "effector";

type ChatMessageActor = "user" | "agent";
type ChatMessageType = "completion";

type ChatMessage = {
  actor: ChatMessageActor;
  type: ChatMessageType;
  content: string;
  createdAt: Date;
};

const addMessage = createEvent<ChatMessage>();

const $messages = createStore<ChatMessage[]>([]).on(
  addMessage,
  (messages, message) => [...messages, message],
);

export { $messages, addMessage };
export type { ChatMessage, ChatMessageActor, ChatMessageType };
