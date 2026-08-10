import {
  WebSearchClient,
  WebSearchClientError,
  WebSearchEndpoint,
} from "@daevox/external-clients";
import { WebSearchRequestSchema, type WebSearchRequest } from "./types.js";

const client = new WebSearchClient();

const webSearch = async (input: WebSearchRequest) => {
  const request = WebSearchRequestSchema.parse(input);

  try {
    return await client.request(WebSearchEndpoint.WebSearch, request);
  } catch (error) {
    if (error instanceof WebSearchClientError) {
      return { error: { message: error.message } };
    }

    if (error instanceof Error) {
      return { error: { message: error.message } };
    }

    return {
      error: {
        message: "Web search service is unavailable",
      },
    };
  }
};

export { webSearch };
