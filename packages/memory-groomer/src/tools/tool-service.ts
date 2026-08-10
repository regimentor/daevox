import {
  ToolLogger,
  type ToolEventListener,
  type ToolResultListener,
} from "@daevox/shared";
import { defaultMemoryClient, type MemoryClientLike } from "./memory-client.js";
import { createMemoryCreateTool } from "./memory_create/tool.js";
import { createMemoryDeleteTool } from "./memory_delete/tool.js";
import { createMemoryReadTool } from "./memory_read/tool.js";
import { createMemorySearchTool } from "./memory_search/tool.js";
import { createMemoryUpdateTool } from "./memory_update/tool.js";

class MemoryGroomerToolService {
  readonly tools;

  constructor(
    onToolEvent?: ToolEventListener,
    onToolResult?: ToolResultListener,
    client: MemoryClientLike = defaultMemoryClient,
  ) {
    const logger = new ToolLogger({
      namespace: "memory-groomer",
      onToolEvent,
      onToolResult,
    });

    this.tools = [
      createMemorySearchTool(logger, client),
      createMemoryReadTool(logger, client),
      createMemoryCreateTool(logger, client),
      createMemoryUpdateTool(logger, client),
      createMemoryDeleteTool(logger, client),
    ];
  }
}

export { MemoryGroomerToolService };
