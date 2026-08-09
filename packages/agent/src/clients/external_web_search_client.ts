import type {
  ToolError,
  WebServicePayload,
  WebServiceRequestPayload,
} from "./contracts.js";
import {
  ToolErrorSchema,
  WebOpenPayloadSchema,
  WebSearchPayloadSchema,
} from "./contracts.js";

enum ExternalWebSearchEndpoint {
  WebSearch = "/v1/web_search",
  WebOpen = "/v1/web_open",
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Web search service is unavailable";

class ExternalWebSearchClient {
  private readonly serviceUrl = "http://127.0.0.1:9000";
  private readonly apiKey = process.env.WEB_SEARCH_API_KEY;

  async request(
    endpoint: ExternalWebSearchEndpoint.WebSearch,
    input: WebServiceRequestPayload["/v1/web_search"],
  ): Promise<WebServicePayload["/v1/web_search"] | ToolError>;
  async request(
    endpoint: ExternalWebSearchEndpoint.WebOpen,
    input: WebServiceRequestPayload["/v1/web_open"],
  ): Promise<WebServicePayload["/v1/web_open"] | ToolError>;
  async request(
    endpoint: ExternalWebSearchEndpoint,
    input: WebServiceRequestPayload[ExternalWebSearchEndpoint],
  ): Promise<WebServicePayload[ExternalWebSearchEndpoint] | ToolError> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };

    if (this.apiKey) {
      headers.authorization = `Bearer ${this.apiKey}`;
    }

    try {
      const response = await fetch(`${this.serviceUrl}${endpoint}`, {
        method: "POST",
        headers,
        body: JSON.stringify(input),
      });
      const payload: unknown = await response.json();

      if (!response.ok) {
        const errorPayload = ToolErrorSchema.safeParse(payload);

        return {
          error: {
            message: errorPayload.success
              ? errorPayload.data.error.message
              : `${endpoint.slice(4)} failed with status ${response.status}`,
          },
        };
      }

      if (endpoint === ExternalWebSearchEndpoint.WebSearch) {
        const parsedPayload = WebSearchPayloadSchema.safeParse(payload);

        if (!parsedPayload.success) {
          return {
            error: {
              message: `${endpoint.slice(4)} returned an invalid payload`,
            },
          };
        }

        return parsedPayload.data;
      }

      const parsedPayload = WebOpenPayloadSchema.safeParse(payload);

      if (!parsedPayload.success) {
        return {
          error: {
            message: `${endpoint.slice(4)} returned an invalid payload`,
          },
        };
      }

      return parsedPayload.data;
    } catch (error) {
      return { error: { message: errorMessage(error) } };
    }
  }
}

export { ExternalWebSearchClient, ExternalWebSearchEndpoint };
export type { ToolError } from "./contracts.js";
