import { z } from "zod";
import type {
  AgentGenerationMetrics,
  AgentMemoryLookup,
  AgentToolCall,
  Message,
} from "./message.js";
import {
  AgentSourceSchema,
  AgentToolCallSchema,
  AgentMemoryLookupSchema,
  MessageSchema,
} from "./message.js";
import type { DialogSummary, NewMessageEvent } from "./dialogs.js";
import { DialogSummarySchema } from "./dialogs.js";

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
  z
    .object({
      dialogId: z.string(),
      requestId: z.string(),
      type: z.literal("memory"),
    })
    .extend(AgentMemoryLookupSchema.shape),
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

const SendMessageRequestSchema = z.object({
  message: MessageSchema,
  requestId: z.string().min(1),
});

const HealthResponseSchema = z.object({
  status: z.literal("ok"),
});

const ListDialogsResponseSchema = z.array(DialogSummarySchema);
const CreateDialogResponseSchema = DialogSummarySchema;
const GetDialogMessagesResponseSchema = z.array(MessageSchema);

const MessageCreatedEventSchema = z.object({
  dialogId: z.string(),
  requestId: z.string(),
  message: MessageSchema,
});

const OrchestratorEventSchema = z.discriminatedUnion("event", [
  z.object({
    event: z.literal("agent.stream"),
    data: AgentStreamEventSchema,
  }),
  z.object({
    event: z.literal("message.created"),
    data: MessageCreatedEventSchema,
  }),
]);

type SendMessageRequest = z.infer<typeof SendMessageRequestSchema>;
type HealthResponse = z.infer<typeof HealthResponseSchema>;
type ListDialogsResponse = z.infer<typeof ListDialogsResponseSchema>;
type CreateDialogResponse = z.infer<typeof CreateDialogResponseSchema>;
type GetDialogMessagesResponse = z.infer<typeof GetDialogMessagesResponseSchema>;
type MessageCreatedEvent = z.infer<typeof MessageCreatedEventSchema>;
type OrchestratorEvent = z.infer<typeof OrchestratorEventSchema>;

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
  SendMessageRequestSchema,
  HealthResponseSchema,
  ListDialogsResponseSchema,
  CreateDialogResponseSchema,
  GetDialogMessagesResponseSchema,
  MessageCreatedEventSchema,
  OrchestratorEventSchema,
  agentStreamChannel,
  nextCompletionChannel,
};
export type {
  AgentStreamEvent,
  AgentGenerationMetrics,
  AgentMemoryLookup,
  AgentStreamListener,
  Api,
  DialogSummary,
  NewMessageEvent,
  NewMessageListener,
  HealthResponse,
  ListDialogsResponse,
  CreateDialogResponse,
  GetDialogMessagesResponse,
  MessageCreatedEvent,
  OrchestratorEvent,
  SendMessageRequest,
  NextCompletionRequest,
  NextCompletionTransportRequest,
};
