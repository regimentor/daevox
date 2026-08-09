import { describe, expect, test, vi } from "vitest";
import { render } from "../test-utils.js";
import { DialogsHeader } from "./dialogs-header.js";

describe("DialogsHeader", () => {
  test("renders an icon-only create action while loading", async () => {
    const onCreate = vi.fn();
    const container = await render(
      <DialogsHeader isCreating onCreate={onCreate} />,
    );

    const button = container.querySelector("button") as HTMLButtonElement;

    expect(button.textContent).toBe("");
    expect(button.getAttribute("aria-label")).toBe("Creating dialog");
    expect(button.title).toBe("Creating dialog");
    expect(button.disabled).toBe(true);
  });
});
