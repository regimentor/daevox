import { act } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, test } from "vitest";
import { App } from "../app.js";
import chatStyles from "./chat.module.css";
import { Chat } from "./chat.js";
import { render } from "../units/test-utils.js";

const renderChatPage = async () =>
  render(
    <MemoryRouter initialEntries={["/dialogs/dialog-1"]}>
      <Routes>
        <Route path="/dialogs/:dialogId" element={<Chat />} />
      </Routes>
    </MemoryRouter>,
  );

describe("Chat page", () => {
  test("keeps the dialog sidebar local to the Chat page", async () => {
    const appContainer = await render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );

    expect(appContainer.querySelector("#dialogs-sidebar")).toBeNull();
  });

  test("opens the sidebar by default and toggles its layout state", async () => {
    const container = await renderChatPage();
    const page = container.querySelector(`.${chatStyles.page}`);
    const sidebar = container.querySelector("#dialogs-sidebar");
    const closeButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Hide dialogs"]',
    );

    expect(page?.classList.contains(chatStyles.pageWithSidebar!)).toBe(true);
    expect(sidebar?.getAttribute("aria-hidden")).toBe("false");
    expect(closeButton?.getAttribute("aria-expanded")).toBe("true");

    await act(async () => {
      closeButton?.click();
    });

    const openButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Show dialogs"]',
    );

    expect(page?.classList.contains(chatStyles.pageWithSidebar!)).toBe(false);
    expect(sidebar?.getAttribute("aria-hidden")).toBe("true");
    expect(openButton?.getAttribute("aria-expanded")).toBe("false");
    expect(openButton?.getAttribute("aria-controls")).toBe("dialogs-sidebar");
  });

  test("closes from the backdrop and Escape key", async () => {
    const container = await renderChatPage();
    const backdrop = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Close dialogs"]',
    );

    await act(async () => {
      backdrop?.click();
    });

    expect(
      container.querySelector('button[aria-label="Show dialogs"]'),
    ).not.toBeNull();

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="Show dialogs"]')
        ?.click();
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(
      container.querySelector('button[aria-label="Show dialogs"]'),
    ).not.toBeNull();
  });
});
