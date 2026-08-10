import { afterEach, describe, expect, test, vi } from "vitest";
import { ToolLogger } from "./logging.js";

describe("ToolLogger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("reports running and complete events and the successful result", async () => {
    const events: unknown[] = [];
    const results: unknown[] = [];
    const logger = new ToolLogger({
      namespace: "agent",
      onToolEvent: (event) => events.push(event),
      onToolResult: (toolName, result) => results.push([toolName, result]),
    });

    await expect(logger.run("demo", { value: 1 }, () => ({ ok: true }))).resolves.toEqual({
      ok: true,
    });

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      name: "demo",
      input: '{"value":1}',
      status: "running",
      durationMs: 0,
      error: "",
    });
    expect(events[1]).toMatchObject({
      name: "demo",
      input: '{"value":1}',
      status: "complete",
      error: "",
    });
    expect((events[0] as { toolCallId: string }).toolCallId).toBe(
      (events[1] as { toolCallId: string }).toolCallId,
    );
    expect(results).toEqual([["demo", { ok: true }]]);
  });

  test("reports service errors and rethrows them", async () => {
    const events: unknown[] = [];
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const logger = new ToolLogger({
      namespace: "memory-groomer",
      onToolEvent: (event) => events.push(event),
    });
    const error = new Error("service failed");

    await expect(logger.run("demo", undefined, () => Promise.reject(error))).rejects.toBe(
      error,
    );

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ status: "running", input: "undefined" });
    expect(events[1]).toMatchObject({
      status: "error",
      error: "service failed",
      input: "undefined",
    });
    expect(errorLog.mock.calls[0]?.[0]).toBe("[memory-groomer] tool error");
  });

  test("serializes values, handles cycles, truncates long values, and preserves namespace", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const logger = new ToolLogger({ namespace: "memory-groomer" });
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;

    await logger.run("values", "hello", () => undefined);
    await logger.run("undefined", {}, () => undefined);
    await logger.run("cyclic", cyclic, () => undefined);
    await logger.run("long", "x".repeat(1_001), () => undefined);

    expect(info.mock.calls[0]?.[0]).toBe("[memory-groomer] tool call");
    expect(info.mock.calls[1]?.[0]).toBe("[memory-groomer] tool result");
    expect(info.mock.calls[2]?.[1]).toMatchObject({ input: "{}" });
    expect(info.mock.calls[3]?.[1]).toMatchObject({ result: "undefined" });
    expect(info.mock.calls[4]?.[1]).toMatchObject({
      input: "[unserializable]",
    });
    expect(info.mock.calls[6]?.[1]).toMatchObject({
      input: `${"x".repeat(1_000)}…`,
    });
    expect(info.mock.calls[7]?.[1]).toMatchObject({ result: "undefined" });
    expect(errorLog).not.toHaveBeenCalled();
  });
});
