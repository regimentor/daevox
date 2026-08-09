import {
  ExternalWebSearchClient,
  ExternalWebSearchEndpoint,
} from "../../clients/external_web_search_client.js";
import {
  ToolErrorSchema,
  WebOpenPayloadSchema,
} from "../../clients/contracts.js";
import { WebOpenRequestSchema, type WebOpenRequest } from "./types.js";

const client = new ExternalWebSearchClient();

const webOpen = async (input: WebOpenRequest) => {
  const response = await client.request(
    ExternalWebSearchEndpoint.WebOpen,
    WebOpenRequestSchema.parse(input),
  );
  const parsedPayload = WebOpenPayloadSchema.safeParse(response);

  if (parsedPayload.success) {
    return parsedPayload.data;
  }

  const parsedError = ToolErrorSchema.safeParse(response);

  if (parsedError.success) {
    return parsedError.data;
  }

  return {
    error: {
      message: "web_open returned an invalid payload",
    },
  };
};

export { webOpen };
