import { z } from "zod";

const RecallMemoryModeSchema = z.enum(["keyword", "semantic", "hybrid"]);

const RecallMemoryRequestSchema = z
  .object({
    query: z.string().trim().min(1, "query must be a non-empty string"),
    mode: RecallMemoryModeSchema.default("hybrid"),
    limit: z.number().int().min(1).max(10).default(5),
    path_prefix: z.string().trim().min(1).optional(),
    tags: z.array(z.string().trim().min(1)).optional(),
    expand_links: z.boolean().optional(),
  })
  .strict();

// OpenAI strict tool schemas require every property to be present. Nullable
// values represent the optional API filters and are removed before search.
const RecallMemoryToolRequestSchema = z
  .object({
    query: z.string().trim().min(1, "query must be a non-empty string"),
    mode: RecallMemoryModeSchema.nullable(),
    limit: z.number().int().min(1).max(10).nullable(),
    path_prefix: z.string().trim().min(1).nullable(),
    tags: z.array(z.string().trim().min(1)).nullable(),
    expand_links: z.boolean().nullable(),
  })
  .strict();

type RecallMemoryRequest = z.output<typeof RecallMemoryRequestSchema>;
type RecallMemoryToolRequest = z.output<typeof RecallMemoryToolRequestSchema>;

export {
  RecallMemoryModeSchema,
  RecallMemoryRequestSchema,
  RecallMemoryToolRequestSchema,
};
export type { RecallMemoryRequest, RecallMemoryToolRequest };
