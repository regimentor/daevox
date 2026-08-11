import { act } from "react";
import { describe, expect, test, vi } from "vitest";
import messageInputStyles from "./message-input.module.css";
import contextProgressStyles from "../../../units/context-progress/context-progress.module.css";
import { ContextProgress } from "../../../units/context-progress/index.js";
import { MessageInput } from "./message-input.js";
import { render } from "../../../units/test-utils.js";

const changeContent = async (textarea: HTMLTextAreaElement, value: string) => {
  await act(async () => {
    const setValue = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )?.set;
    setValue?.call(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
};

describe("MessageInput", () => {
  test("does not render context usage without a context window", async () => {
    const container = await render(<MessageInput promptTokens={250} />);

    expect(container.querySelector('[role="progressbar"]')).toBeNull();
  });

  test("renders an empty context usage bar before the first response", async () => {
    const container = await render(
      <MessageInput contextWindowTokens={1000} promptTokens={0} />,
    );

    expect(container.textContent).toContain("Контекст: 0 / 1000 токенов");
    expect(
      container.querySelector<HTMLElement>('[role="progressbar"]')?.style.width,
    ).toBe("0%");
  });

  test("renders normal context usage with accessible values", async () => {
    const container = await render(
      <MessageInput promptTokens={250} contextWindowTokens={1000} />,
    );
    const progress = container.querySelector<HTMLElement>(
      '[role="progressbar"]',
    );

    expect(container.textContent).toContain("Контекст: 250 / 1000 токенов");
    expect(
      progress?.classList.contains(
        contextProgressStyles.contextProgressNormal!,
      ),
    ).toBe(true);
    expect(progress?.getAttribute("aria-valuenow")).toBe("25");
    expect(progress?.getAttribute("aria-valuemin")).toBe("0");
    expect(progress?.getAttribute("aria-valuemax")).toBe("100");
    expect(progress?.style.width).toBe("25%");
  });

  test("changes color near the context limit", async () => {
    const warning = await render(
      <ContextProgress promptTokens={800} contextWindowTokens={1000} />,
    );
    expect(
      warning
        .querySelector('[role="progressbar"]')
        ?.classList.contains(contextProgressStyles.contextProgressWarning!),
    ).toBe(true);

    const danger = await render(
      <ContextProgress promptTokens={950} contextWindowTokens={1000} />,
    );
    expect(
      danger
        .querySelector('[role="progressbar"]')
        ?.classList.contains(contextProgressStyles.contextProgressDanger!),
    ).toBe(true);
  });

  test("clamps the progress bar when prompt usage exceeds the limit", async () => {
    const container = await render(
      <ContextProgress promptTokens={1200} contextWindowTokens={1000} />,
    );
    const progress = container.querySelector<HTMLElement>(
      '[role="progressbar"]',
    );

    expect(container.textContent).toContain("Контекст: 1200 / 1000 токенов");
    expect(progress?.style.width).toBe("100%");
    expect(progress?.getAttribute("aria-valuenow")).toBe("100");
    expect(
      progress?.classList.contains(
        contextProgressStyles.contextProgressDanger!,
      ),
    ).toBe(true);
  });

  test("renders an empty, disabled form", async () => {
    const container = await render(<MessageInput />);
    const form = container.querySelector("form");
    const textarea = container.querySelector<HTMLTextAreaElement>("textarea");
    const submit = container.querySelector<HTMLButtonElement>("button");

    expect(form?.classList.contains(messageInputStyles.root!)).toBe(true);
    expect(textarea?.getAttribute("aria-label")).toBe("Message");
    expect(textarea?.placeholder).toBe("Write a message...");
    expect(textarea?.value).toBe("");
    expect(submit?.classList.contains(messageInputStyles.submit!)).toBe(true);
    expect(submit?.textContent).toBe("Send");
    expect(submit?.disabled).toBe(true);
  });

  test("trims submitted content and clears the input", async () => {
    const onSubmit = vi.fn();
    const container = await render(<MessageInput onSubmit={onSubmit} />);
    const textarea = container.querySelector<HTMLTextAreaElement>("textarea")!;
    const submit = container.querySelector<HTMLButtonElement>("button")!;

    await changeContent(textarea, "  Hello there  ");
    expect(submit.disabled).toBe(false);

    await act(async () => {
      submit.click();
    });

    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit).toHaveBeenCalledWith("Hello there");
    expect(textarea.value).toBe("");
    expect(submit.disabled).toBe(true);
  });

  test("keeps whitespace-only content without submitting it", async () => {
    const onSubmit = vi.fn();
    const container = await render(<MessageInput onSubmit={onSubmit} />);
    const textarea = container.querySelector<HTMLTextAreaElement>("textarea")!;
    const form = container.querySelector("form")!;

    await changeContent(textarea, "   ");
    await act(async () => {
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(textarea.value).toBe("   ");
  });

  test("does not submit or clear content when no handler is supplied", async () => {
    const container = await render(<MessageInput />);
    const textarea = container.querySelector<HTMLTextAreaElement>("textarea")!;
    const form = container.querySelector("form")!;

    await changeContent(textarea, "A message");
    await act(async () => {
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });

    expect(textarea.value).toBe("A message");
  });

  test("submits with Ctrl+Enter and keeps Enter for new lines", async () => {
    const onSubmit = vi.fn();
    const container = await render(<MessageInput onSubmit={onSubmit} />);
    const textarea = container.querySelector<HTMLTextAreaElement>("textarea")!;

    await changeContent(textarea, "A message");
    await act(async () => {
      textarea.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          cancelable: true,
          key: "Enter",
        }),
      );
    });
    expect(onSubmit).not.toHaveBeenCalled();

    await act(async () => {
      textarea.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
          key: "Enter",
        }),
      );
    });

    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit).toHaveBeenCalledWith("A message");
    expect(textarea.value).toBe("");
  });

  test("does not send while an agent response is in progress but keeps the draft editable", async () => {
    const onSubmit = vi.fn();
    const container = await render(
      <MessageInput onSubmit={onSubmit} isSending />,
    );
    const textarea = container.querySelector<HTMLTextAreaElement>("textarea")!;
    const submit = container.querySelector<HTMLButtonElement>("button")!;

    expect(
      textarea.parentElement?.classList.contains(messageInputStyles.sending!),
    ).toBe(true);

    await changeContent(textarea, "Keep this draft");
    expect(submit.disabled).toBe(true);

    await act(async () => {
      container
        .querySelector("form")
        ?.dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        );
    });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(textarea.value).toBe("Keep this draft");
  });

  test("keeps the draft when submit fails", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("Agent unavailable"));
    const container = await render(<MessageInput onSubmit={onSubmit} />);
    const textarea = container.querySelector<HTMLTextAreaElement>("textarea")!;

    await changeContent(textarea, "Retry this message");
    await act(async () => {
      container.querySelector<HTMLButtonElement>("button")?.click();
    });

    expect(onSubmit).toHaveBeenCalledWith("Retry this message");
    expect(textarea.value).toBe("Retry this message");
  });
});
