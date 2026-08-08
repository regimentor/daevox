import { allSettled, fork } from "effector";
import { describe, expect, test } from "vitest";
import { $messages, addMessage, type ChatMessage } from "./chat.store.js";

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
});
