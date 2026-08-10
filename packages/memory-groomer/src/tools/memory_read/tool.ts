import { zodFunction } from "openai/helpers/zod";
import { ToolLogger } from "@daevox/shared";
import { defaultMemoryClient, type MemoryClientLike } from "../memory-client.js";
import { memoryRead } from "./service.js";
import { MemoryReadToolRequestSchema } from "./types.js";

const createMemoryReadTool = (
  logger = new ToolLogger({ namespace: "memory-groomer" }),
  client: MemoryClientLike = defaultMemoryClient,
) =>
  zodFunction({
    name: "memory_read",
    description: "Read a local Markdown memory note by its note ID.",
    parameters: MemoryReadToolRequestSchema,
    function: async (input) =>
      logger.run("memory_read", input, () => memoryRead(input, client)),
  });

const memoryReadTool = createMemoryReadTool();

export { createMemoryReadTool, memoryReadTool };
