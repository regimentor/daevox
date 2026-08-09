export { createAgent } from "./agent.js";
export { GenerationMetricsTracker, estimateTokenCount } from "./src/metrics.js";
export type { AgentGenerationMetrics } from "@daevox/contracts";
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
export type {
  AgentToolCall,
  ToolEventListener,
  ToolResultListener,
} from "./src/tools/logging.js";
export { WebOpenPayloadSchema } from "./src/clients/contracts.js";
export type { WebOpenPayload } from "./src/clients/contracts.js";
export { default as agentTestTaskPrompt } from "./prompts/agent-test-task.js";
export { default as architectPrompt } from "./prompts/architect.js";
export { default as plannerPrompt } from "./prompts/planner.js";
export { default as teamLeadPrompt } from "./prompts/team-lead.js";
export { default as webCitationsPrompt } from "./prompts/web-citations.js";
