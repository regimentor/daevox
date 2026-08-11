import type { AgentGenerationMetrics } from "@daevox/contracts";

type StreamPart = {
  id?: string;
  choices?: Array<{
    delta?: {
      content?: string | null;
      reasoning_content?: string | null;
      tool_calls?: Array<{
        function?: {
          name?: string | null;
          arguments?: string | null;
        };
      }>;
    };
  }>;
  usage?: {
    completion_tokens: number;
    prompt_tokens?: number;
  } | null;
};

const estimateTokenCount = (text: string): number => {
  if (!text) {
    return 0;
  }

  // The model tokenizer is not available in the renderer. This estimate is
  // replaced by provider usage when the stream ends.
  return Math.max(1, Math.ceil(Array.from(text).length / 4));
};

const tokensPerSecond = (tokens: number, durationMs: number) =>
  durationMs > 0 ? (tokens * 1000) / durationMs : 0;

class GenerationMetricsTracker {
  private currentStreamId: string | null = null;
  private lastChunkAt: number | null = null;
  private durationMs = 0;
  private estimatedTokens = 0;
  private hasUsage = false;
  private observedPromptTokens: number | undefined;

  observe(part: StreamPart, now = performance.now()): void {
    if (part.id !== this.currentStreamId) {
      this.currentStreamId = part.id ?? null;
      this.lastChunkAt = null;
    }

    if (this.lastChunkAt !== null) {
      this.durationMs += Math.max(0, now - this.lastChunkAt);
    }
    this.lastChunkAt = now;

    if (part.usage) {
      this.hasUsage = true;
      if (part.usage.prompt_tokens !== undefined) {
        // Keep the latest request's prompt size. Summing prompt usage across
        // tool rounds measures total work, not the current context window.
        this.observedPromptTokens = part.usage.prompt_tokens;
      }
    }

    const delta = part.choices?.[0]?.delta;
    const toolText = (delta?.tool_calls ?? [])
      .flatMap((toolCall) => [
        toolCall.function?.name ?? "",
        toolCall.function?.arguments ?? "",
      ])
      .join("");

    this.estimatedTokens += estimateTokenCount(
      [delta?.content ?? "", delta?.reasoning_content ?? "", toolText].join(""),
    );
  }

  finalize(
    completionTokens: number,
    promptTokens?: number,
  ): AgentGenerationMetrics {
    const durationMs = Math.round(this.durationMs);
    const exact = this.hasUsage;
    const tokens = exact ? completionTokens : this.estimatedTokens;
    const exactPromptTokens = promptTokens ?? this.observedPromptTokens;

    return {
      completionTokens: tokens,
      ...(exactPromptTokens !== undefined
        ? { promptTokens: exactPromptTokens }
        : {}),
      durationMs,
      tokensPerSecond: tokensPerSecond(tokens, durationMs),
      estimated: !exact,
    };
  }
}

export { GenerationMetricsTracker, estimateTokenCount };
export type { StreamPart };
