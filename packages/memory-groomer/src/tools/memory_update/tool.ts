import { zodFunction } from "openai/helpers/zod";
import { ToolLogger } from "@daevox/shared";
import { defaultMemoryClient, type MemoryClientLike } from "../memory-client.js";
import { memoryUpdate } from "./service.js";
import { MemoryUpdateToolRequestSchema } from "./types.js";

const createMemoryUpdateTool = (
  logger = new ToolLogger({ namespace: "memory-groomer" }),
  client: MemoryClientLike = defaultMemoryClient,
) =>
  zodFunction({
    name: "memory_update",
    description: "Update a local Markdown memory note by its note ID.",
    parameters: MemoryUpdateToolRequestSchema,
    function: async (input) => {
      const request = {
        note_id: input.note_id,
        ...(input.path === null ? {} : { path: input.path }),
        ...(input.title === null ? {} : { title: input.title }),
        ...(input.content === null ? {} : { content: input.content }),
        ...(input.frontmatter === null
          ? {}
          : { frontmatter: input.frontmatter }),
      };

      return logger.run("memory_update", input, () => memoryUpdate(request, client));
    },
  });

const memoryUpdateTool = createMemoryUpdateTool();

export { createMemoryUpdateTool, memoryUpdateTool };
