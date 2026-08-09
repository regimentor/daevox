import OpenAI from "openai";
import type { AgentToolCall } from "@daevox/contracts";
import { AgentToolService } from "./src/tools/index.js";

type LocalDelta = {
  role?: string;
  content?: string | null;
  reasoning_content?: string | null;
};

type AgentArg = {
  onReasoningPipe?: (reasoning: string) => void;
  onResponsePipe?: (response: string) => void;
  onToolEvent?: (event: AgentToolCall) => void;
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

const model = process.env.DAEVOX_MODEL ?? "qwen3.6-35b-a3b";
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
        reasoning_effort: "low",
        max_tokens: maxCompletionTokens,
        stream: true as const,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          ...conversation,
        ],
        tools: new AgentToolService(onToolEvent).tools,
      },
      { maxChatCompletions: maxToolRounds },
    );

    const response: string[] = [];
    const reasoning: string[] = [];

    for await (const part of completion) {
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

    return {
      response: response.join(""),
      reasoning: reasoning.join(""),
    };
  };
}

export { createAgent };
export type { AgentMessage };
