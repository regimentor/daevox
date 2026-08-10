import {
  NoteUpdateSchema,
} from "@daevox/external-clients";
import { z } from "zod";

const MemoryUpdateRequestSchema = z
  .object({
    note_id: z.string(),
    path: z.string().nullable().optional(),
    title: z.string().nullable().optional(),
    content: z.string().nullable().optional(),
    frontmatter: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .strict();
const MemoryUpdateToolRequestSchema = z
  .object({
    note_id: z.string(),
    path: z.string().nullable(),
    title: z.string().nullable(),
    content: z.string().nullable(),
    // OpenAI strict schemas cannot express arbitrary object keys. The API
    // schema above still validates frontmatter as a JSON object before send.
    frontmatter: z.any().nullable(),
  })
  .strict();

type MemoryUpdateRequest = z.infer<typeof MemoryUpdateRequestSchema>;
type MemoryUpdateToolRequest = z.infer<typeof MemoryUpdateToolRequestSchema>;
type MemoryUpdatePayload = z.infer<typeof NoteUpdateSchema>;

export { MemoryUpdateRequestSchema, MemoryUpdateToolRequestSchema };
export type {
  MemoryUpdatePayload,
  MemoryUpdateRequest,
  MemoryUpdateToolRequest,
};
