import { z } from "zod";
import type { Message } from "./message.js";

const DialogSummarySchema = z.object({
  id: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

type DialogSummary = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
};

type NewMessageEvent = {
  dialogId: string;
  requestId?: string;
  message: Message;
};

type MessageCreatedEvent = NewMessageEvent & { requestId: string };

export { DialogSummarySchema };
export type { DialogSummary, MessageCreatedEvent, NewMessageEvent };
