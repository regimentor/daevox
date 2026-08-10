import { zodFunction } from "openai/helpers/zod";
import { ToolLogger } from "@daevox/shared";
import { defaultMemoryClient, type MemoryClientLike } from "../memory-client.js";
import { memoryCreate } from "./service.js";
import { MemoryCreateToolRequestSchema } from "./types.js";

const createMemoryCreateTool = (
  logger = new ToolLogger({ namespace: "memory-groomer" }),
  client: MemoryClientLike = defaultMemoryClient,
) =>
  zodFunction({
    name: "memory_create",
    description:
      "Create a Markdown note in the local memory vault. The path must be vault-relative and end in .md, for example nodejs/tech-stack.md.",
    parameters: MemoryCreateToolRequestSchema,
    function: async (input) => {
      const request = {
        path: input.path,
        ...(input.title === null ? {} : { title: input.title }),
        ...(input.content === null ? {} : { content: input.content }),
        ...(input.frontmatter === null
          ? {}
          : { frontmatter: input.frontmatter }),
      };

      return logger.run("memory_create", input, () => memoryCreate(request, client));
    },
  });

const memoryCreateTool = createMemoryCreateTool();

export { createMemoryCreateTool, memoryCreateTool };
