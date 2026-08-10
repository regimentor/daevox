import { z } from "zod";

const MemoryReadRequestSchema = z
  .object({ note_id: z.string() })
  .strict();
const MemoryReadToolRequestSchema = MemoryReadRequestSchema;

type MemoryReadRequest = z.infer<typeof MemoryReadRequestSchema>;
type MemoryReadToolRequest = z.infer<typeof MemoryReadToolRequestSchema>;

export { MemoryReadRequestSchema, MemoryReadToolRequestSchema };
export type { MemoryReadRequest, MemoryReadToolRequest };
