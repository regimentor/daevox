import { z } from "zod";
import type { WebOpenRequest } from "../tools/web_open/types.js";
import type { WebSearchRequest } from "../tools/web_search/types.js";

const ToolErrorSchema = z.object({
  error: z.object({
    message: z.string(),
  }),
});

type ToolError = z.infer<typeof ToolErrorSchema>;

type WebSearchRequestPayload = WebSearchRequest;

type WebOpenRequestPayload = WebOpenRequest;

type WebServiceRequestPayload = {
  "/v1/web_search": WebSearchRequestPayload;
  "/v1/web_open": WebOpenRequestPayload;
};

const WebSearchResultSchema = z.object({
  position: z.number(),
  title: z.string(),
  url: z.string(),
  snippet: z.string(),
  source: z.string(),
});

const WebSearchPayloadSchema = z.object({
  query: z.string(),
  results: z.array(WebSearchResultSchema),
  meta: z.object({
    count: z.number(),
    elapsed_ms: z.number(),
  }),
});

const WebOpenPayloadSchema = z.object({
  url: z.string(),
  final_url: z.string(),
  canonical_url: z.string().nullable(),
  title: z.string(),
  content_type: z.string(),
  fetch_mode: z.enum(["http", "browser", "pdf"]),
  status_code: z.number(),
  content: z.string(),
  char_count: z.number(),
  original_char_count: z.number().nullable(),
  truncated: z.boolean(),
  meta: z.object({
    elapsed_ms: z.number(),
    requested_fragment: z.string().nullable(),
  }),
});

type WebSearchResult = z.infer<typeof WebSearchResultSchema>;
type WebSearchPayload = z.infer<typeof WebSearchPayloadSchema>;
type WebOpenPayload = z.infer<typeof WebOpenPayloadSchema>;

type WebServicePayload = {
  "/v1/web_search": WebSearchPayload;
  "/v1/web_open": WebOpenPayload;
};

export type {
  ToolError,
  WebOpenPayload,
  WebOpenRequestPayload,
  WebSearchPayload,
  WebSearchRequestPayload,
  WebSearchResult,
  WebServiceRequestPayload,
  WebServicePayload,
};
export {
  ToolErrorSchema,
  WebOpenPayloadSchema,
  WebSearchPayloadSchema,
  WebSearchResultSchema,
};
