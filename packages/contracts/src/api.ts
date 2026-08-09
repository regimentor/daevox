import { z } from "zod";
import type {
  AgentGenerationMetrics,
  AgentToolCall,
  Message,
} from "./message.js";
import {
  AgentSourceSchema,
  AgentToolCallSchema,
  MessageSchema,
} from "./message.js";
import type { DialogSummary, NewMessageEvent } from "./dialogs.js";

type NewMessageListener = (event: NewMessageEvent) => void;

const AgentStreamEventSchema = z.discriminatedUnion("type", [
  z.object({
    dialogId: z.string(),
    requestId: z.string(),
    type: z.literal("reasoning"),
    content: z.string(),
  }),
  z.object({
    dialogId: z.string(),
    requestId: z.string(),
    type: z.literal("response"),
    content: z.string(),
  }),
  z
    .object({
      dialogId: z.string(),
      requestId: z.string(),
      type: z.literal("tool"),
    })
    .extend(AgentToolCallSchema.shape),
  z
    .object({
      dialogId: z.string(),
      requestId: z.string(),
      type: z.literal("source"),
    })
    .extend(AgentSourceSchema.shape),
]);

type AgentStreamEvent = z.infer<typeof AgentStreamEventSchema>;
type AgentStreamListener = (event: AgentStreamEvent) => void;

const NextCompletionSchema = z.object({
  history: z.array(MessageSchema),
  message: MessageSchema,
});

const NextCompletionTransportRequestSchema = z.object({
  dialogId: z.string(),
  message: MessageSchema,
  requestId: z.string(),
});

type NextCompletionRequest = z.infer<typeof NextCompletionSchema>;
type NextCompletionTransportRequest = z.infer<
  typeof NextCompletionTransportRequestSchema
>;

const nextCompletionChannel = "next-completion";
const agentStreamChannel = "agent-stream";
const listDialogsChannel = "list-dialogs";
const createDialogChannel = "create-dialog";
const getDialogMessagesChannel = "get-dialog-messages";
const deleteDialogChannel = "delete-dialog";

interface Api {
  listDialogs(): Promise<DialogSummary[]>;
  createDialog(): Promise<DialogSummary>;
  getDialogMessages(dialogId: string): Promise<Message[]>;
  deleteDialog(dialogId: string): Promise<void>;
  addMessage(dialogId: string, message: Message): Promise<void>;
  onAgentStream(listener: AgentStreamListener): void;
  onNewMessage(listener: NewMessageListener): void;
}

export {
  AgentStreamEventSchema,
  createDialogChannel,
  deleteDialogChannel,
  getDialogMessagesChannel,
  listDialogsChannel,
  NextCompletionSchema,
  NextCompletionTransportRequestSchema,
  agentStreamChannel,
  nextCompletionChannel,
};
export type {
  AgentStreamEvent,
  AgentGenerationMetrics,
  AgentStreamListener,
  Api,
  DialogSummary,
  NewMessageEvent,
  NewMessageListener,
  NextCompletionRequest,
  NextCompletionTransportRequest,
};
