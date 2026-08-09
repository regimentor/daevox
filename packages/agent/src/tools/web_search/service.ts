import {
  ExternalWebSearchClient,
  ExternalWebSearchEndpoint,
} from "../../clients/external_web_search_client.js";
import {
  ToolErrorSchema,
  WebSearchPayloadSchema,
} from "../../clients/contracts.js";
import { WebSearchRequestSchema, type WebSearchRequest } from "./types.js";

const client = new ExternalWebSearchClient();

const webSearch = async (input: WebSearchRequest) => {
  const response = await client.request(
    ExternalWebSearchEndpoint.WebSearch,
    WebSearchRequestSchema.parse(input),
  );
  const parsedPayload = WebSearchPayloadSchema.safeParse(response);

  if (parsedPayload.success) {
    return parsedPayload.data;
  }

  const parsedError = ToolErrorSchema.safeParse(response);

  if (parsedError.success) {
    return parsedError.data;
  }

  return {
    error: {
      message: "web_search returned an invalid payload",
    },
  };
};

export { webSearch };
