import { z } from "zod";
import type { Message } from "./message.js";
import { MessageSchema } from "./message.js";

type NewMessageListener = (message: Message) => void;

const AgentStreamEventSchema = z.discriminatedUnion("type", [
  z.object({
    requestId: z.string(),
    type: z.literal("reasoning"),
    content: z.string(),
  }),
  z.object({
    requestId: z.string(),
    type: z.literal("response"),
    content: z.string(),
  }),
]);

type AgentStreamEvent = z.infer<typeof AgentStreamEventSchema>;
type AgentStreamListener = (event: AgentStreamEvent) => void;

const NextCompletionSchema = z.object({
  history: z.array(MessageSchema),
  message: MessageSchema,
});

const NextCompletionTransportRequestSchema = NextCompletionSchema.extend({
  requestId: z.string(),
});

type NextCompletionRequest = z.infer<typeof NextCompletionSchema>;
type NextCompletionTransportRequest = z.infer<
  typeof NextCompletionTransportRequestSchema
>;

const nextCompletionChannel = "next-completion";
const agentStreamChannel = "agent-stream";

interface Api {
  addMessage(message: Message): Promise<void>;
  onAgentStream(listener: AgentStreamListener): void;
  onNewMessage(listener: NewMessageListener): void;
}

export {
  AgentStreamEventSchema,
  NextCompletionSchema,
  NextCompletionTransportRequestSchema,
  agentStreamChannel,
  nextCompletionChannel,
};
export type {
  AgentStreamEvent,
  AgentStreamListener,
  Api,
  NewMessageListener,
  NextCompletionRequest,
  NextCompletionTransportRequest,
};
