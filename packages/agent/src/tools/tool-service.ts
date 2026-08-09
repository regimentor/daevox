import {
  ToolLogger,
  type ToolEventListener,
  type ToolResultListener,
} from "./logging.js";
import { createWebOpenTool } from "./web_open/tool.js";
import { createWebSearchTool } from "./web_search/tool.js";

class AgentToolService {
  readonly tools;

  constructor(
    onToolEvent?: ToolEventListener,
    onToolResult?: ToolResultListener,
  ) {
    const logger = new ToolLogger(onToolEvent, onToolResult);

    this.tools = [createWebSearchTool(logger), createWebOpenTool(logger)];
  }
}

export { AgentToolService };
