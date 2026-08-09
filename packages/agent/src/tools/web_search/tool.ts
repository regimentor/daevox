import { zodFunction } from "openai/helpers/zod";
import { ToolLogger } from "../logging.js";
import { webSearch } from "./service.js";
import { WebSearchToolRequestSchema } from "./types.js";

const createWebSearchTool = (logger = new ToolLogger()) =>
  zodFunction({
    name: "web_search",
    description:
      "Search the public web for current or external information. Returns search results with titles, URLs and snippets. Use web_open to read selected results.",
    parameters: WebSearchToolRequestSchema,
    function: async (input) => {
      const request = {
        query: input.query,
        ...(input.max_results === null
          ? {}
          : { max_results: input.max_results }),
      };

      return logger.run("web_search", input, () => webSearch(request));
    },
  });

const webSearchTool = createWebSearchTool();

export { createWebSearchTool, webSearchTool };
