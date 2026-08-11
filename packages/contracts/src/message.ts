import { z } from "zod";

const AgentToolCallSchema = z.object({
  toolCallId: z.string(),
  name: z.string(),
  input: z.string(),
  status: z.enum(["running", "complete", "error"]),
  durationMs: z.number(),
  error: z.string(),
});

const AgentSourceSchema = z.object({
  sourceId: z.string().min(1),
  title: z.string().min(1),
  url: z.string().url(),
  domain: z.string().min(1),
});

const AgentGenerationMetricsSchema = z.object({
  completionTokens: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
  tokensPerSecond: z.number().nonnegative(),
  estimated: z.boolean(),
});

const AgentMemoryLookupResultSchema = z.object({
  title: z.string(),
  path: z.string(),
});

const AgentMemoryLookupSchema = z.object({
  status: z.enum(["running", "complete", "error"]),
  query: z.string(),
  durationMs: z.number().int().nonnegative(),
  resultCount: z.number().int().nonnegative(),
  results: z.array(AgentMemoryLookupResultSchema),
  error: z.string(),
});

const MessageSchema = z.object({
  actor: z.enum(["user", "agent"]),
  type: z.literal(["completion", "user"]),
  content: z.string(),
  // JSON transports encode dates as ISO strings; coercion keeps the domain
  // model typed as Date while allowing the same schema on both sides.
  createdAt: z.coerce.date(),
  tools: z.array(AgentToolCallSchema).optional(),
  sources: z.array(AgentSourceSchema).optional(),
  metrics: AgentGenerationMetricsSchema.optional(),
  memory: AgentMemoryLookupSchema.optional(),
});

type Message = z.infer<typeof MessageSchema>;
type AgentToolCall = z.infer<typeof AgentToolCallSchema>;
type AgentSource = z.infer<typeof AgentSourceSchema>;
type AgentGenerationMetrics = z.infer<typeof AgentGenerationMetricsSchema>;
type AgentMemoryLookupResult = z.infer<typeof AgentMemoryLookupResultSchema>;
type AgentMemoryLookup = z.infer<typeof AgentMemoryLookupSchema>;

export {
  AgentGenerationMetricsSchema,
  AgentMemoryLookupResultSchema,
  AgentMemoryLookupSchema,
  AgentSourceSchema,
  AgentToolCallSchema,
  MessageSchema,
};
export type {
  AgentGenerationMetrics,
  AgentMemoryLookup,
  AgentMemoryLookupResult,
  AgentSource,
  AgentToolCall,
  Message,
};
