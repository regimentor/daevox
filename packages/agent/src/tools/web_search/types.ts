import { z } from "zod";

const WebSearchQuerySchema = z
  .string()
  .trim()
  .min(1, "query must be a non-empty string");
const WebSearchMaxResultsSchema = z.number().int().min(1).max(20);

const WebSearchRequestSchema = z
  .object({
    query: WebSearchQuerySchema,
    max_results: WebSearchMaxResultsSchema.optional(),
  })
  .strict();

const WebSearchToolRequestSchema = z
  .object({
    query: WebSearchQuerySchema,
    max_results: WebSearchMaxResultsSchema.nullable(),
  })
  .strict();

type WebSearchRequest = z.infer<typeof WebSearchRequestSchema>;

export { WebSearchRequestSchema, WebSearchToolRequestSchema };
export type { WebSearchRequest };
