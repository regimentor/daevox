import { zodFunction } from "openai/helpers/zod";
import { ToolLogger } from "@daevox/shared";
import { defaultMemoryClient, type MemoryClientLike } from "../memory-client.js";
import { memoryDelete } from "./service.js";
import { MemoryDeleteToolRequestSchema } from "./types.js";

const createMemoryDeleteTool = (
  logger = new ToolLogger({ namespace: "memory-groomer" }),
  client: MemoryClientLike = defaultMemoryClient,
) =>
  zodFunction({
    name: "memory_delete",
    description: "Delete a local Markdown memory note by its note ID.",
    parameters: MemoryDeleteToolRequestSchema,
    function: async (input) =>
      logger.run("memory_delete", input, () => memoryDelete(input, client)),
  });

const memoryDeleteTool = createMemoryDeleteTool();

export { createMemoryDeleteTool, memoryDeleteTool };
