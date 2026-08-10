import { z } from "zod";

const MemoryDeleteRequestSchema = z
  .object({ note_id: z.string() })
  .strict();
const MemoryDeleteToolRequestSchema = MemoryDeleteRequestSchema;

type MemoryDeleteRequest = z.infer<typeof MemoryDeleteRequestSchema>;
type MemoryDeleteToolRequest = z.infer<typeof MemoryDeleteToolRequestSchema>;

export { MemoryDeleteRequestSchema, MemoryDeleteToolRequestSchema };
export type { MemoryDeleteRequest, MemoryDeleteToolRequest };
