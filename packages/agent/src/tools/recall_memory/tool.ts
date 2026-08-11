import { ToolLogger } from "@daevox/shared";
import { zodFunction } from "openai/helpers/zod";
import { defaultMemoryClient, type MemoryClientLike } from "./memory-client.js";
import { recallMemory } from "./service.js";
import { RecallMemoryToolRequestSchema } from "./types.js";

const createRecallMemoryTool = (
  logger = new ToolLogger({ namespace: "agent" }),
  client: MemoryClientLike = defaultMemoryClient,
) =>
  zodFunction({
    name: "recall_memory",
    description:
      "Search long-term user memory and return relevant notes with their full contents. Use it for user preferences, prior context, and durable facts; memory may be outdated or incorrect. Call it before recommendations or technical answers that could depend on the user's projects, stack, hardware, local AI models, offline-first setup, or previous experiments.",
    parameters: RecallMemoryToolRequestSchema,
    function: async (input) => {
      const pathPrefix =
        input.path_prefix === null || input.path_prefix.toLowerCase() === "null"
          ? undefined
          : input.path_prefix;
      const request = {
        query: input.query,
        ...(input.mode === null ? {} : { mode: input.mode }),
        ...(input.limit === null ? {} : { limit: input.limit }),
        ...(pathPrefix === undefined ? {} : { path_prefix: pathPrefix }),
        ...(input.tags === null ? {} : { tags: input.tags }),
        ...(input.expand_links === null
          ? {}
          : { expand_links: input.expand_links }),
      };

      return logger.run("recall_memory", input, () =>
        recallMemory(request, client),
      );
    },
  });

const recallMemoryTool = createRecallMemoryTool();

export { createRecallMemoryTool, recallMemoryTool };
