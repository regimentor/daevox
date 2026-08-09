import { allSettled, fork } from "effector";
import { describe, expect, test } from "vitest";
import {
  $agentStream,
  $messages,
  addMessage,
  receiveAgentStream,
  type ChatMessage,
} from "./chat.store.js";

const userMessage: ChatMessage = {
  actor: "user",
  type: "completion",
  content: "Hello",
  createdAt: new Date("2026-08-08T10:00:00.000Z"),
};

const agentMessage: ChatMessage = {
  actor: "agent",
  type: "completion",
  content: "Hi!",
  createdAt: new Date("2026-08-08T10:00:01.000Z"),
};

describe("chat store", () => {
  test("starts with an empty message list", () => {
    const scope = fork();

    expect(scope.getState($messages)).toEqual([]);
  });

  test("adds a message", async () => {
    const scope = fork();

    await allSettled(addMessage, { scope, params: userMessage });

    expect(scope.getState($messages)).toEqual([userMessage]);
  });

  test("keeps messages in insertion order", async () => {
    const scope = fork();

    await allSettled(addMessage, { scope, params: userMessage });
    await allSettled(addMessage, { scope, params: agentMessage });

    expect(scope.getState($messages)).toEqual([userMessage, agentMessage]);
  });

  test("accumulates reasoning and response chunks and completes on the agent message", async () => {
    const scope = fork();

    await allSettled(receiveAgentStream, {
      scope,
      params: {
        requestId: "request-1",
        type: "source",
        sourceId: "https://example.com/article",
        title: "Example article",
        url: "https://example.com/article",
        domain: "example.com",
      },
    });
    await allSettled(receiveAgentStream, {
      scope,
      params: {
        requestId: "request-1",
        type: "tool",
        toolCallId: "tool-1",
        name: "web_search",
        input: '{"query":"Daevox"}',
        status: "running",
        durationMs: 0,
        error: "",
      },
    });
    await allSettled(receiveAgentStream, {
      scope,
      params: {
        requestId: "request-1",
        type: "tool",
        toolCallId: "tool-1",
        name: "web_search",
        input: '{"query":"Daevox"}',
        status: "complete",
        durationMs: 12,
        error: "",
      },
    });

    await allSettled(receiveAgentStream, {
      scope,
      params: { requestId: "request-1", type: "reasoning", content: "Think " },
    });
    await allSettled(receiveAgentStream, {
      scope,
      params: { requestId: "request-1", type: "reasoning", content: "first" },
    });
    await allSettled(receiveAgentStream, {
      scope,
      params: { requestId: "request-1", type: "response", content: "Hello" },
    });
    expect(scope.getState($agentStream)).toEqual({
      requestId: "request-1",
      reasoning: "Think first",
      response: "Hello",
      tools: [
        {
          toolCallId: "tool-1",
          name: "web_search",
          input: '{"query":"Daevox"}',
          status: "complete",
          durationMs: 12,
          error: "",
        },
      ],
      sources: [
        {
          sourceId: "https://example.com/article",
          title: "Example article",
          url: "https://example.com/article",
          domain: "example.com",
        },
      ],
      status: "streaming",
    });

    await allSettled(addMessage, { scope, params: agentMessage });

    expect(scope.getState($agentStream)).toEqual({
      requestId: "request-1",
      reasoning: "Think first",
      response: "",
      tools: [
        {
          toolCallId: "tool-1",
          name: "web_search",
          input: '{"query":"Daevox"}',
          status: "complete",
          durationMs: 12,
          error: "",
        },
      ],
      sources: [
        {
          sourceId: "https://example.com/article",
          title: "Example article",
          url: "https://example.com/article",
          domain: "example.com",
        },
      ],
      status: "complete",
    });
  });
});
