import { z } from "zod";

const ToolErrorSchema = z.object({
  error: z.object({
    message: z.string(),
  }),
});

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

const WebOpenUrlSchema = z
  .string()
  .trim()
  .min(1, "url must be a non-empty string");
const WebOpenRenderSchema = z.enum(["auto", "http", "browser"]);
const WebOpenMaxCharsSchema = z.number().int().min(1000).max(200_000);

const WebOpenRequestSchema = z
  .object({
    url: WebOpenUrlSchema,
    render: WebOpenRenderSchema.optional(),
    max_chars: WebOpenMaxCharsSchema.optional(),
  })
  .strict();

const WebOpenToolRequestSchema = z
  .object({
    url: WebOpenUrlSchema,
    render: WebOpenRenderSchema.nullable(),
    max_chars: WebOpenMaxCharsSchema.nullable(),
  })
  .strict();

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

type ToolError = z.infer<typeof ToolErrorSchema>;
type WebSearchRequest = z.infer<typeof WebSearchRequestSchema>;
type WebSearchToolRequest = z.infer<typeof WebSearchToolRequestSchema>;
type WebOpenRequest = z.infer<typeof WebOpenRequestSchema>;
type WebOpenToolRequest = z.infer<typeof WebOpenToolRequestSchema>;
type WebSearchRequestPayload = WebSearchRequest;
type WebOpenRequestPayload = WebOpenRequest;
type WebSearchResult = z.infer<typeof WebSearchResultSchema>;
type WebSearchPayload = z.infer<typeof WebSearchPayloadSchema>;
type WebOpenPayload = z.infer<typeof WebOpenPayloadSchema>;

enum WebSearchEndpoint {
  WebSearch = "/v1/web_search",
  WebOpen = "/v1/web_open",
}

type WebServiceRequestPayload = {
  [WebSearchEndpoint.WebSearch]: WebSearchRequest;
  [WebSearchEndpoint.WebOpen]: WebOpenRequest;
};

type WebServicePayload = {
  [WebSearchEndpoint.WebSearch]: WebSearchPayload;
  [WebSearchEndpoint.WebOpen]: WebOpenPayload;
};

interface WebSearchClientErrorOptions {
  endpoint: string;
  status?: number;
  payload?: unknown;
  errorResponse?: ToolError;
  cause?: unknown;
}

class WebSearchClientError extends Error {
  readonly endpoint: string;
  readonly status?: number;
  readonly payload?: unknown;
  readonly errorResponse?: ToolError;

  constructor(message: string, options: WebSearchClientErrorOptions) {
    super(message, { cause: options.cause });
    this.name = "WebSearchClientError";
    this.endpoint = options.endpoint;
    if (options.status !== undefined) this.status = options.status;
    if (options.payload !== undefined) this.payload = options.payload;
    if (options.errorResponse !== undefined) {
      this.errorResponse = options.errorResponse;
    }
  }
}

async function readPayload(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;

  try {
    return await response.json();
  } catch {
    if (typeof response.text === "function") {
      try {
        const text = await response.text();
        if (text.length === 0) return undefined;
        try {
          return JSON.parse(text) as unknown;
        } catch {
          return text;
        }
      } catch {
        return undefined;
      }
    }
    return undefined;
  }
}

const defaultBaseUrl = `http://${process.env.WEB_SEARCH_HOST ?? "127.0.0.1"}:${process.env.WEB_SEARCH_PORT ?? "9000"}`;

class WebSearchClient {
  private readonly baseUrl: string;
  private readonly apiKey = process.env.WEB_SEARCH_API_KEY;

  constructor(baseUrl = defaultBaseUrl) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  request(
    endpoint: WebSearchEndpoint.WebSearch,
    input: WebServiceRequestPayload[WebSearchEndpoint.WebSearch],
  ): Promise<WebServicePayload[WebSearchEndpoint.WebSearch]>;
  request(
    endpoint: WebSearchEndpoint.WebOpen,
    input: WebServiceRequestPayload[WebSearchEndpoint.WebOpen],
  ): Promise<WebServicePayload[WebSearchEndpoint.WebOpen]>;
  async request(
    endpoint: WebSearchEndpoint,
    input: WebServiceRequestPayload[WebSearchEndpoint],
  ): Promise<WebServicePayload[WebSearchEndpoint]> {
    const parsedInput =
      endpoint === WebSearchEndpoint.WebSearch
        ? WebSearchRequestSchema.parse(input)
        : WebOpenRequestSchema.parse(input);
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };

    if (this.apiKey) {
      headers.authorization = `Bearer ${this.apiKey}`;
    }

    let response: Response;
    try {
      response = await globalThis.fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(parsedInput),
      });
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Web search service is unavailable";
      throw new WebSearchClientError(message, { endpoint: url, cause });
    }

    const payload = await readPayload(response);
    const ok = response.ok ?? (response.status >= 200 && response.status < 300);

    if (!ok) {
      const parsedError = ToolErrorSchema.safeParse(payload);
      const errorResponse = parsedError.success ? parsedError.data : undefined;
      const message =
        errorResponse?.error.message ??
        `${endpoint.slice(4)} failed with status ${response.status}`;
      const options: WebSearchClientErrorOptions = {
        endpoint: url,
        status: response.status,
        payload,
      };
      if (errorResponse !== undefined) options.errorResponse = errorResponse;
      throw new WebSearchClientError(message, options);
    }

    const schema =
      endpoint === WebSearchEndpoint.WebSearch
        ? WebSearchPayloadSchema
        : WebOpenPayloadSchema;
    const parsedPayload = schema.safeParse(payload);
    if (!parsedPayload.success) {
      throw new WebSearchClientError(
        `${endpoint.slice(4)} returned an invalid payload`,
        {
          endpoint: url,
          status: response.status,
          payload,
          cause: parsedPayload.error,
        },
      );
    }

    return parsedPayload.data as WebServicePayload[WebSearchEndpoint];
  }

  webSearch(input: WebSearchRequest): Promise<WebSearchPayload> {
    return this.request(WebSearchEndpoint.WebSearch, input);
  }

  webOpen(input: WebOpenRequest): Promise<WebOpenPayload> {
    return this.request(WebSearchEndpoint.WebOpen, input);
  }
}

export {
  ToolErrorSchema,
  WebOpenMaxCharsSchema,
  WebOpenPayloadSchema,
  WebOpenRenderSchema,
  WebOpenRequestSchema,
  WebOpenToolRequestSchema,
  WebOpenUrlSchema,
  WebSearchClient,
  WebSearchClientError,
  WebSearchEndpoint,
  WebSearchMaxResultsSchema,
  WebSearchPayloadSchema,
  WebSearchQuerySchema,
  WebSearchRequestSchema,
  WebSearchResultSchema,
  WebSearchToolRequestSchema,
};
export type {
  ToolError,
  WebOpenPayload,
  WebOpenRequest,
  WebOpenRequestPayload,
  WebOpenToolRequest,
  WebSearchPayload,
  WebSearchRequest,
  WebSearchRequestPayload,
  WebSearchResult,
  WebSearchToolRequest,
  WebServicePayload,
  WebServiceRequestPayload,
};
