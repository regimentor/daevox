import OpenAI from "openai";

type LocalDelta = {
  role?: string;
  content?: string | null;
  reasoning_content?: string | null;
};

type AgentArg = {
  onReasoningPipe?: (reasoning: string) => void;
  onResponsePipe?: (response: string) => void;
};

type CreateAgentArg = {
  systemPrompt: string;
  userPrompt: string;
  name: string;
};

const client = new OpenAI({
  baseURL: "http://localhost:8080/v1",
  apiKey: "YOUR_API_KEY",
});

function createAgent({ systemPrompt, userPrompt, name }: CreateAgentArg) {
  return async function ({ onReasoningPipe, onResponsePipe }: AgentArg) {
    console.log(`Agent ${name} is running...`);

    const completition = await client.chat.completions.create({
      model: "google/gemma-4-12B-it-qat-q4_0-gguf:Q4_0",
      reasoning_effort: "max",
      stream: true,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
    });

    const response: string[] = [];
    const reasoning: string[] = [];

    for await (const part of completition) {
      console.log(`Agent ${name} received part.`);
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
