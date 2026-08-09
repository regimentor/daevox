import { MemoryRouter } from "react-router";
import { describe, expect, test, vi } from "vitest";
import { render } from "../test-utils.js";
import { DialogItem } from "./dialog-item.js";

const dialog = {
  id: "dialog-1",
  createdAt: new Date("2026-08-09T09:00:00.000Z"),
  updatedAt: new Date("2026-08-09T09:00:00.000Z"),
};

describe("DialogItem", () => {
  test("renders a dialog link and calls delete with its id", async () => {
    const onDelete = vi.fn();
    const container = await render(
      <MemoryRouter initialEntries={["/dialogs/dialog-1"]}>
        <DialogItem dialog={dialog} onDelete={onDelete} />
      </MemoryRouter>,
    );

    const link = container.querySelector("a");
    const deleteButton = container.querySelector("button");

    expect(link?.getAttribute("href")).toBe("/dialogs/dialog-1");
    expect(link?.textContent).toContain("Dialog");
    expect(container.querySelector("time")?.dateTime).toBe(
      dialog.createdAt.toISOString(),
    );
    expect(deleteButton?.textContent).toBe("");
    expect(deleteButton?.getAttribute("aria-label")).toContain(
      "Delete dialog from",
    );

    deleteButton?.click();
    expect(onDelete).toHaveBeenCalledWith(dialog.id);
  });

  test("disables the delete action when disabled", async () => {
    const container = await render(
      <MemoryRouter>
        <DialogItem dialog={dialog} disabled onDelete={vi.fn()} />
      </MemoryRouter>,
    );

    expect(
      (container.querySelector("button") as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});
