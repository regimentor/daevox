import { ToolLogger, type ToolEventListener } from "./logging.js";
import { createWebOpenTool } from "./web_open/tool.js";
import { createWebSearchTool } from "./web_search/tool.js";

class AgentToolService {
  readonly tools;

  constructor(onToolEvent?: ToolEventListener) {
    const logger = new ToolLogger(onToolEvent);

    this.tools = [createWebSearchTool(logger), createWebOpenTool(logger)];
  }
}

export { AgentToolService };
