import { z } from "zod";
import type { Message } from "./message.js";

const DialogSummarySchema = z.object({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

type DialogSummary = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
};

type NewMessageEvent = {
  dialogId: string;
  message: Message;
};

export { DialogSummarySchema };
export type { DialogSummary, NewMessageEvent };
