import { MemoryRouter } from "react-router";
import { describe, expect, test, vi } from "vitest";
import { render } from "../test-utils.js";
import { DialogsList } from "./dialogs-list.js";

const dialogs = [
  {
    id: "dialog-1",
    createdAt: new Date("2026-08-09T09:00:00.000Z"),
    updatedAt: new Date("2026-08-09T09:00:00.000Z"),
  },
  {
    id: "dialog-2",
    createdAt: new Date("2026-08-09T10:00:00.000Z"),
    updatedAt: new Date("2026-08-09T10:00:00.000Z"),
  },
];

describe("DialogsList", () => {
  test("renders all dialogs and disables deletion while deleting", async () => {
    const container = await render(
      <MemoryRouter>
        <DialogsList dialogs={dialogs} isDeleting onDelete={vi.fn()} />
      </MemoryRouter>,
    );

    expect(container.querySelectorAll("a")).toHaveLength(dialogs.length);
    expect(container.querySelectorAll("button")).toHaveLength(dialogs.length);
    expect(
      [...container.querySelectorAll("button")].every(
        (button) => (button as HTMLButtonElement).disabled,
      ),
    ).toBe(true);
  });
});
