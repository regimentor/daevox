import { zodFunction } from "openai/helpers/zod";
import { ToolLogger } from "../logging.js";
import { webOpen } from "./service.js";
import { WebOpenToolRequestSchema } from "./types.js";

const createWebOpenTool = (logger = new ToolLogger()) =>
  zodFunction({
    name: "web_open",
    description:
      "Open a public HTTP/HTTPS URL and return its readable content as Markdown. Use browser rendering when JavaScript execution is required.",
    parameters: WebOpenToolRequestSchema,
    function: async (input) => {
      const request = {
        url: input.url,
        ...(input.render === null ? {} : { render: input.render }),
        ...(input.max_chars === null ? {} : { max_chars: input.max_chars }),
      };

      return logger.run("web_open", input, () => webOpen(request));
    },
  });

const webOpenTool = createWebOpenTool();

export { createWebOpenTool, webOpenTool };
