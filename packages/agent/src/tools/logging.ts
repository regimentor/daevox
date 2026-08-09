import type { AgentToolCall } from "@daevox/contracts";

const maxLogValueLength = 1_000;

type ToolEventListener = (event: AgentToolCall) => void;
type ToolResultListener = (toolName: string, result: unknown) => void;

const formatLogValue = (value: unknown): string => {
  let serialized: string | undefined;

  try {
    serialized = typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    return "[unserializable]";
  }

  if (serialized === undefined) {
    return "undefined";
  }

  return serialized.length > maxLogValueLength
    ? `${serialized.slice(0, maxLogValueLength)}…`
    : serialized;
};

class ToolLogger {
  constructor(
    private readonly onToolEvent?: ToolEventListener,
    private readonly onToolResult?: ToolResultListener,
  ) {}

  async run<Result>(
    toolName: string,
    input: unknown,
    serviceCall: () => Result | Promise<Result>,
  ): Promise<Result> {
    const startedAt = performance.now();
    const toolCallId = crypto.randomUUID();
    const formattedInput = formatLogValue(input);

    this.onToolEvent?.({
      toolCallId,
      name: toolName,
      input: formattedInput,
      status: "running",
      durationMs: 0,
      error: "",
    });

    console.info("[agent] tool call", {
      event: "tool_call",
      tool: toolName,
      input: formattedInput,
    });

    try {
      const result = await serviceCall();
      this.onToolResult?.(toolName, result);

      console.info("[agent] tool result", {
        event: "tool_result",
        tool: toolName,
        duration_ms: Math.round(performance.now() - startedAt),
        result: formatLogValue(result),
      });

      this.onToolEvent?.({
        toolCallId,
        name: toolName,
        input: formattedInput,
        status: "complete",
        durationMs: Math.round(performance.now() - startedAt),
        error: "",
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error("[agent] tool error", {
        event: "tool_error",
        tool: toolName,
        duration_ms: Math.round(performance.now() - startedAt),
        error: errorMessage,
      });

      this.onToolEvent?.({
        toolCallId,
        name: toolName,
        input: formattedInput,
        status: "error",
        durationMs: Math.round(performance.now() - startedAt),
        error: errorMessage,
      });

      throw error;
    }
  }
}

export { ToolLogger };
export type { AgentToolCall, ToolEventListener, ToolResultListener };
