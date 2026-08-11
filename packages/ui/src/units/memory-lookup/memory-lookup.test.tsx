import { describe, expect, test } from "vitest";
import { render } from "../test-utils.js";
import { MemoryLookup } from "./memory-lookup.js";

const completeLookup = {
  status: "complete" as const,
  query: "Which GPU?",
  durationMs: 18,
  resultCount: 1,
  results: [{ title: "Hardware", path: "notes/hardware.md" }],
  error: "",
};

describe("MemoryLookup", () => {
  test("renders query, duration and note title/path separately from tools", async () => {
    const container = await render(
      <MemoryLookup lookup={completeLookup} isComplete />,
    );
    const details = container.querySelector<HTMLDetailsElement>(
      '[aria-label="Memory lookup"]',
    )!;

    expect(details.open).toBe(false);
    expect(details.textContent).toContain("Which GPU?");
    expect(details.textContent).toContain("18 ms");
    expect(details.textContent).toContain("Hardware");
    expect(details.textContent).toContain("notes/hardware.md");
  });

  test("marks running and error states accessibly", async () => {
    const running = await render(
      <MemoryLookup
        lookup={{
          ...completeLookup,
          status: "running",
          durationMs: 0,
          resultCount: 0,
          results: [],
        }}
      />,
    );
    const runningDetails = running.querySelector("details")!;
    expect(runningDetails.open).toBe(true);
    expect(runningDetails.getAttribute("aria-busy")).toBe("true");

    const error = await render(
      <MemoryLookup
        lookup={{
          ...completeLookup,
          status: "error",
          error: "Memory service is unavailable",
        }}
        isComplete
      />,
    );
    expect(error.querySelector("details")?.textContent).toContain(
      "Memory service is unavailable",
    );
    expect(error.querySelector("details")?.getAttribute("aria-busy")).toBe(
      "false",
    );
  });
});
