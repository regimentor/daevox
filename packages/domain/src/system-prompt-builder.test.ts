import { describe, expect, test } from "vitest";
import { SystemPromptBuilder } from "./system-prompt-builder.js";

describe("SystemPromptBuilder", () => {
  test("builds sections in chain order", () => {
    expect(new SystemPromptBuilder().add("first").add("second").build()).toBe(
      "first\n\nsecond",
    );
  });

  test("returns the current builder from add", () => {
    const builder = new SystemPromptBuilder();

    expect(builder.add("section")).toBe(builder);
  });

  test("skips empty and whitespace-only sections", () => {
    expect(
      new SystemPromptBuilder().add("").add("  \n\t").add("kept").build(),
    ).toBe("kept");
  });

  test("builds an empty string without sections", () => {
    expect(new SystemPromptBuilder().build()).toBe("");
  });
});
