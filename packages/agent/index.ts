export { createAgent } from "./agent.js";
export {
  AgentToolService,
  ToolLogger,
  webOpen,
  webOpenTool,
  webSearch,
  webSearchTool,
  WebOpenRequestSchema,
  WebOpenToolRequestSchema,
  WebSearchRequestSchema,
  WebSearchToolRequestSchema,
} from "./src/tools/index.js";
export type { WebOpenRequest, WebSearchRequest } from "./src/tools/index.js";
export type { AgentToolCall, ToolEventListener } from "./src/tools/logging.js";
export { default as agentTestTaskPrompt } from "./prompts/agent-test-task.js";
export { default as architectPrompt } from "./prompts/architect.js";
export { default as plannerPrompt } from "./prompts/planner.js";
export { default as teamLeadPrompt } from "./prompts/team-lead.js";
