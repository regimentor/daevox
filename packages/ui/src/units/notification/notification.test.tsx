import { describe, expect, test, vi } from "vitest";
import styles from "./notification.module.css";
import {
  CompletionErrorNotification,
  getCompletionErrorMessage,
} from "./notification.js";
import { render } from "../test-utils.js";

describe("CompletionErrorNotification", () => {
  test.each([
    ["network-timeout", "Проверьте подключение"],
    ["response-too-long", "превысил допустимый лимит"],
    ["unknown", "Не удалось получить ответ"],
  ] as const)("renders the %s message", (code, expectedText) => {
    expect(getCompletionErrorMessage(code)).toContain(expectedText);
  });

  test("renders an accessible notification and dismisses it", async () => {
    const onDismiss = vi.fn();
    const container = await render(
      <CompletionErrorNotification
        event={{
          dialogId: "dialog-1",
          requestId: "request-1",
          code: "network-timeout",
        }}
        onDismiss={onDismiss}
      />,
    );

    const notification = container.querySelector('[role="alert"]');
    expect(notification?.classList.contains(styles.root!)).toBe(true);
    expect(notification?.textContent).toContain("Ошибка ответа");
    expect(notification?.textContent).toContain("Проверьте подключение");

    container.querySelector<HTMLButtonElement>("button")?.click();
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  test("does not render without an error", async () => {
    const container = await render(
      <CompletionErrorNotification event={null} onDismiss={vi.fn()} />,
    );

    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
});
