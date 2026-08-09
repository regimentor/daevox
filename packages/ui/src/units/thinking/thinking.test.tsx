import { act, useState } from "react";
import { describe, expect, test } from "vitest";
import { render } from "../test-utils.js";
import { Thinking } from "./thinking.js";

const ThinkingHarness = () => {
  const [content, setContent] = useState<string | undefined>(
    "Persistent reasoning",
  );

  return (
    <>
      <button type="button" onClick={() => setContent(undefined)}>
        Finish
      </button>
      <Thinking {...(content === undefined ? {} : { content })} />
    </>
  );
};

const CompletionHarness = () => {
  const [isComplete, setIsComplete] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setIsComplete(true)}>
        Complete
      </button>
      <Thinking content="Reasoning" isComplete={isComplete} />
    </>
  );
};

describe("Thinking", () => {
  test("keeps its content when the stream no longer provides it", async () => {
    const container = await render(<ThinkingHarness />);
    const finish = container.querySelector("button")!;

    await act(async () => {
      finish.click();
    });

    expect(container.querySelector("details")?.textContent).toContain(
      "Persistent reasoning",
    );
  });

  test("keeps open state locally", async () => {
    const container = await render(<Thinking content="Reasoning" />);
    const details = container.querySelector<HTMLDetailsElement>("details")!;

    expect(details.open).toBe(true);

    await act(async () => {
      details.querySelector("summary")?.click();
    });

    expect(details.open).toBe(false);
  });

  test("marks the block as active until thinking is complete", async () => {
    const container = await render(<CompletionHarness />);
    const details = container.querySelector<HTMLDetailsElement>("details")!;
    const complete = container.querySelector("button")!;

    expect(details.getAttribute("aria-busy")).toBe("true");

    await act(async () => {
      complete.click();
    });

    expect(details.getAttribute("aria-busy")).toBe("false");
  });
});
