import { describe, expect, test } from "vitest";
import { AgentStreamEventSchema, MessageSchema } from "./index.js";

const memory = {
  status: "complete" as const,
  query: "GPU",
  durationMs: 4,
  resultCount: 1,
  results: [{ title: "Hardware", path: "hardware.md" }],
  error: "",
};

describe("memory contracts", () => {
  test("accepts memory on messages and stream events", () => {
    const message = MessageSchema.parse({
      actor: "agent",
      type: "completion",
      content: "Answer",
      createdAt: new Date(),
      memory,
    });
    const event = AgentStreamEventSchema.parse({
      dialogId: "dialog-1",
      requestId: "request-1",
      type: "memory",
      ...memory,
    });

    expect(message.memory).toEqual(memory);
    expect(event.type).toBe("memory");
  });
});
