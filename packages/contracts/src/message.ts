import { z } from "zod";

const AgentToolCallSchema = z.object({
  toolCallId: z.string(),
  name: z.string(),
  input: z.string(),
  status: z.enum(["running", "complete", "error"]),
  durationMs: z.number(),
  error: z.string(),
});

const MessageSchema = z.object({
  actor: z.enum(["user", "agent"]),
  type: z.literal(["completion", "user"]),
  content: z.string(),
  createdAt: z.date(),
  tools: z.array(AgentToolCallSchema).optional(),
});

type Message = z.infer<typeof MessageSchema>;
type AgentToolCall = z.infer<typeof AgentToolCallSchema>;

export { AgentToolCallSchema, MessageSchema };
export type { AgentToolCall, Message };
