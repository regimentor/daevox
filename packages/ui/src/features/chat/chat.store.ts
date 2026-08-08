import { MessageSchema, type Message } from "@daevox/contracts";
import { createEvent, createStore } from "effector";
import { uiApi } from "../../api.js";

const addMessage = createEvent<Message>();

const $messages = createStore<Message[]>([]).on(
  addMessage,
  (messages, message) => [...messages, MessageSchema.parse(message)],
);

uiApi.onNewMessage(addMessage);

type ChatMessage = Message;
type ChatMessageActor = Message["actor"];
type ChatMessageType = Message["type"];

export { $messages, addMessage };
export type { ChatMessage, ChatMessageActor, ChatMessageType, Message };
