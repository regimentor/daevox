import { z } from "zod";
import type { Message } from "./message.js";
import { MessageSchema } from "./message.js";

type NewMessageListener = (message: Message) => void;

const NextCompletionSchema = z.object({
  history: z.array(MessageSchema),
  message: MessageSchema,
});

type NextCompletionRequest = z.infer<typeof NextCompletionSchema>;

const nextCompletionChannel = "next-completion";

interface Api {
  addMessage(message: Message): Promise<void>;
  onNewMessage(listener: NewMessageListener): void;
}

export { NextCompletionSchema, nextCompletionChannel };
export type { Api, NewMessageListener, NextCompletionRequest };
