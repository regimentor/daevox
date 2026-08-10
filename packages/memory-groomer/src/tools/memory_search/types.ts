import {
  SearchRequestSchema,
  type SearchRequest,
} from "@daevox/external-clients";
import { z } from "zod";

const MemorySearchToolRequestSchema = z
  .object({
    query: z.string().min(1),
    mode: z.enum(["keyword", "semantic", "hybrid"]).nullable(),
    limit: z.number().int().min(1).max(100).nullable(),
    path_prefix: z.string().nullable(),
    tags: z.array(z.string()).nullable(),
    expand_links: z.boolean().nullable(),
  })
  .strict();

const MemorySearchRequestSchema = SearchRequestSchema;

type MemorySearchRequest = SearchRequest;
type MemorySearchToolRequest = z.infer<typeof MemorySearchToolRequestSchema>;

export {
  MemorySearchRequestSchema,
  MemorySearchToolRequestSchema,
};
export type { MemorySearchRequest, MemorySearchToolRequest };
