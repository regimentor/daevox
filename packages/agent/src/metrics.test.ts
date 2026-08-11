import { describe, expect, test } from "vitest";
import { GenerationMetricsTracker, estimateTokenCount } from "./metrics.js";

describe("generation metrics", () => {
  test("estimates non-empty streamed text", () => {
    expect(estimateTokenCount("")).toBe(0);
    expect(estimateTokenCount("abcd")).toBe(1);
    expect(estimateTokenCount("abcdefgh")).toBe(2);
  });

  test("aggregates exact completion usage across model rounds", () => {
    const tracker = new GenerationMetricsTracker();

    tracker.observe(
      {
        id: "round-1",
        choices: [{ delta: { reasoning_content: "thinking" } }],
      },
      0,
    );
    tracker.observe(
      {
        id: "round-1",
        choices: [{ delta: { content: "tool call" } }],
      },
      100,
    );
    tracker.observe(
      {
        id: "round-2",
        choices: [{ delta: { content: "final answer" } }],
      },
      1_000,
    );
    tracker.observe(
      {
        id: "round-2",
        choices: [],
        usage: { completion_tokens: 42, prompt_tokens: 128 },
      },
      1_100,
    );

    expect(tracker.finalize(42)).toEqual({
      completionTokens: 42,
      promptTokens: 128,
      durationMs: 200,
      tokensPerSecond: 210,
      estimated: false,
    });

    expect(tracker.finalize(42, 128)).toEqual({
      completionTokens: 42,
      promptTokens: 128,
      durationMs: 200,
      tokensPerSecond: 210,
      estimated: false,
    });
  });

  test("falls back to estimated tokens when usage is unavailable", () => {
    const tracker = new GenerationMetricsTracker();

    tracker.observe(
      {
        id: "round-1",
        choices: [{ delta: { content: "abcdefgh" } }],
      },
      0,
    );
    tracker.observe(
      {
        id: "round-1",
        choices: [{ delta: { content: "abcd" } }],
      },
      100,
    );

    expect(tracker.finalize(0)).toEqual({
      completionTokens: 3,
      durationMs: 100,
      tokensPerSecond: 30,
      estimated: true,
    });

    expect(tracker.finalize(0, 128).promptTokens).toBe(128);
  });

  test("keeps the latest prompt usage instead of summing tool rounds", () => {
    const tracker = new GenerationMetricsTracker();

    tracker.observe({
      id: "round-1",
      choices: [],
      usage: { completion_tokens: 10, prompt_tokens: 512 },
    });
    tracker.observe({
      id: "round-2",
      choices: [],
      usage: { completion_tokens: 20, prompt_tokens: 768 },
    });

    expect(tracker.finalize(30).promptTokens).toBe(768);
  });
});
