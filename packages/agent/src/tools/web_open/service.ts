import {
  WebSearchClient,
  WebSearchClientError,
  WebSearchEndpoint,
} from "@daevox/external-clients";
import { WebOpenRequestSchema, type WebOpenRequest } from "./types.js";

const client = new WebSearchClient();

const webOpen = async (input: WebOpenRequest) => {
  const request = WebOpenRequestSchema.parse(input);

  try {
    return await client.request(WebSearchEndpoint.WebOpen, request);
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

export { webOpen };
