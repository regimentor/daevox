import {
  NoteCreateSchema,
  type NoteCreate,
} from "@daevox/external-clients";
import { z } from "zod";

const MemoryCreateToolRequestSchema = z
  .object({
    path: z
      .string()
      .min(1)
      .regex(/\.md$/i, "path must be a relative Markdown path ending in .md")
      .describe(
        "Vault-relative Markdown path ending in .md, for example nodejs/tech-stack.md.",
      ),
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
