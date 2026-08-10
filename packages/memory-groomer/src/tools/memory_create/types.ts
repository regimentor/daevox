import {
  NoteCreateSchema,
  type NoteCreate,
} from "@daevox/external-clients";
import { z } from "zod";

const MemoryCreateToolRequestSchema = z
  .object({
    path: z.string(),
    title: z.string().nullable(),
    content: z.string().nullable(),
    // OpenAI strict schemas cannot express arbitrary object keys. The API
    // schema below still validates frontmatter as a JSON object before send.
    frontmatter: z.any().nullable(),
  })
  .strict();

const MemoryCreateRequestSchema = NoteCreateSchema;

type MemoryCreateRequest = NoteCreate;
type MemoryCreateToolRequest = z.infer<typeof MemoryCreateToolRequestSchema>;

export { MemoryCreateRequestSchema, MemoryCreateToolRequestSchema };
export type { MemoryCreateRequest, MemoryCreateToolRequest };
