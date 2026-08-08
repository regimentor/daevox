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
});
