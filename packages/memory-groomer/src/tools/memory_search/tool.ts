import { zodFunction } from "openai/helpers/zod";
import { ToolLogger } from "@daevox/shared";
import { defaultMemoryClient, type MemoryClientLike } from "../memory-client.js";
import { memorySearch } from "./service.js";
import { MemorySearchToolRequestSchema } from "./types.js";

const createMemorySearchTool = (
  logger = new ToolLogger({ namespace: "memory-groomer" }),
  client: MemoryClientLike = defaultMemoryClient,
) =>
  zodFunction({
    name: "memory_search",
    description:
      "Search the local Markdown memory using keyword, semantic, or hybrid retrieval.",
    parameters: MemorySearchToolRequestSchema,
    function: async (input) => {
      const request = {
        query: input.query,
        ...(input.mode === null ? {} : { mode: input.mode }),
        ...(input.limit === null ? {} : { limit: input.limit }),
        ...(input.path_prefix === null ? {} : { path_prefix: input.path_prefix }),
        ...(input.tags === null ? {} : { tags: input.tags }),
        ...(input.expand_links === null ? {} : { expand_links: input.expand_links }),
      };

      return logger.run("memory_search", input, () => memorySearch(request, client));
    },
  });

const memorySearchTool = createMemorySearchTool();

export { createMemorySearchTool, memorySearchTool };
