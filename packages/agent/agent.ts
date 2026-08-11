import OpenAI from "openai";
import type { AgentToolCall } from "@daevox/shared";
import {
  estimateTokenCount,
  GenerationMetricsTracker,
} from "./src/metrics.js";
import { AgentToolService } from "./src/tools/index.js";

type LocalDelta = {
  role?: string;
  content?: string | null;
  reasoning_content?: string | null;
  tool_calls?: Array<{
    function?: {
      name?: string | null;
      arguments?: string | null;
    };
  }>;
};

type AgentArg = {
  onReasoningPipe?: (reasoning: string) => void;
  onResponsePipe?: (response: string) => void;
  onToolEvent?: (event: AgentToolCall) => void;
  onToolResult?: (toolName: string, result: unknown) => void;
};

type AgentMessage = {
  role: "user" | "assistant";
  content: string;
};

type CreateAgentArg = {
  systemPrompt: string;
  userPrompt?: string;
  messages?: AgentMessage[];
  name: string;
};

const client = new OpenAI({
  baseURL: "http://localhost:8080/v1",
  apiKey: "YOUR_API_KEY",
});

const model =
  process.env.DAEVOX_MODEL ?? "unsloth/GLM-4.7-Flash-GGUF:UD-Q4_K_XL";
const maxCompletionTokens = 36_000;
// One initial response, web_search, up to three web_open calls, and a final answer.
const maxToolRounds = 6;

function createAgent({
  systemPrompt,
  userPrompt,
  messages,
  name,
}: CreateAgentArg) {
  return async function ({
    onReasoningPipe,
    onResponsePipe,
    onToolEvent,
    onToolResult,
  }: AgentArg) {
    console.log(`Agent ${name} is running...`);

    const conversation = messages ?? [
      {
        role: "user" as const,
        content: userPrompt ?? "",
      },
    ];

    const completion = client.chat.completions.runTools(
      {
        model,
        reasoning_effort: "high",
        max_tokens: maxCompletionTokens,
        stream: true as const,
        stream_options: { include_usage: true },
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          ...conversation,
        ],
        tools: new AgentToolService(onToolEvent, onToolResult).tools,
      },
      // { maxChatCompletions: maxToolRounds },
    );

    const response: string[] = [];
    const reasoning: string[] = [];
    const metrics = new GenerationMetricsTracker();

    for await (const part of completion) {
      metrics.observe(part);

      const delta = part.choices[0]?.delta as LocalDelta;

      if (delta?.content) {
        response.push(delta.content);
        onResponsePipe?.(delta.content);
      }

      if (delta?.reasoning_content) {
        reasoning.push(delta.reasoning_content);
        onReasoningPipe?.(delta.reasoning_content);
      }
    }

    const usage = await completion.totalUsage();
    // totalUsage() sums every tool round. That is useful for billing/metrics,
    // but not for the context bar: tool results are transient and are not
    // stored in the dialog history. Use the first prompt of this turn, which
    // corresponds to the persisted conversation and stays comparable between
    // turns.
    const turnPromptTokens = [...completion.allChatCompletions()]
      .map((chatCompletion) => chatCompletion.usage?.prompt_tokens)
      .find(
        (tokens): tokens is number =>
          typeof tokens === "number" && tokens > 0,
      );
    const estimatedPromptTokens = estimateTokenCount(
      [
        { role: "system", content: systemPrompt },
        ...conversation,
      ]
        .map(({ role, content }) => `${role}: ${content}`)
        .join("\n"),
    );
    const finalMetrics = metrics.finalize(
      usage.completion_tokens,
      turnPromptTokens ?? estimatedPromptTokens,
    );

    return {
      response: response.join(""),
      reasoning: reasoning.join(""),
      metrics: finalMetrics,
    };
  };
}

export { createAgent };
export type { AgentMessage };
