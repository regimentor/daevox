import {
  ToolLogger,
  type ToolEventListener,
  type ToolResultListener,
} from "@daevox/shared";
import { createWebOpenTool } from "./web_open/tool.js";
import { createWebSearchTool } from "./web_search/tool.js";
import { createRecallMemoryTool } from "./recall_memory/tool.js";

class AgentToolService {
  readonly tools;

  constructor(
    onToolEvent?: ToolEventListener,
    onToolResult?: ToolResultListener,
  ) {
    const logger = new ToolLogger({
      namespace: "agent",
      onToolEvent,
      onToolResult,
    });

    this.tools = [
      createWebSearchTool(logger),
      createWebOpenTool(logger),
      createRecallMemoryTool(logger),
    ];
  }
}

export { AgentToolService };
