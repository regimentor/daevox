import { act } from "react";
import { describe, expect, test, vi } from "vitest";
import { render } from "../test-utils.js";
import styles from "./sidebar.module.css";
import { Sidebar } from "./sidebar.js";

describe("Sidebar", () => {
  test("renders the main component and closes from its controls", async () => {
    const onClose = vi.fn();
    const container = await render(
      <Sidebar
        id="test-sidebar"
        ariaLabel="Test sidebar"
        closeLabel="Close test sidebar"
        isOpen
        onClose={onClose}
        mainComponent={() => <p>Sidebar content</p>}
      />,
    );

    const sidebar = container.querySelector("#test-sidebar");
    const backdrop = container.querySelector<HTMLButtonElement>(
      `.${styles.backdrop}`,
    );

    expect(sidebar?.getAttribute("aria-label")).toBe("Test sidebar");
    expect(sidebar?.textContent).toContain("Sidebar content");
    expect(sidebar?.getAttribute("aria-hidden")).toBe("false");

    await act(async () => {
      backdrop?.click();
    });

    expect(onClose).toHaveBeenCalledOnce();
  });

  test("closes on Escape and becomes inert when hidden", async () => {
    const onClose = vi.fn();
    const container = await render(
      <Sidebar isOpen={false} onClose={onClose} mainComponent={() => null} />,
    );

    const sidebar = container.querySelector("aside");

    expect(sidebar?.getAttribute("aria-hidden")).toBe("true");
    expect(sidebar?.hasAttribute("inert")).toBe(true);

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(onClose).not.toHaveBeenCalled();
  });
});
